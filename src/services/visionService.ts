/**
 * Vision Service for EyePlay
 * Handles client-side face landmarker inference via MediaPipe Tasks Vision,
 * four-feature extraction, head-pose checks, and eye-openness quality checks.
 */

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { HeadPose, TrackingQualityState } from '../types';
import { cameraService } from './cameraService';
import { extractFourEyeFeatures, type FourEyeFeatures } from './socialRobotGazeFeatures';

export interface VisionResult {
  valid: boolean;
  x: number;
  y: number;
  rawX: number;
  rawY: number;
  confidence: number;
  headPose: HeadPose;
  ear: number;
  eyeFeatures?: FourEyeFeatures | null;
  quality: TrackingQualityState;
  backendUsed: 'browser_mediapipe' | 'python_service' | 'none';
}

const LEFT_CORNERS = [33, 133];
const RIGHT_CORNERS = [362, 263];
const LEFT_TOP = 159;
const LEFT_BOTTOM = 145;
const RIGHT_TOP = 386;
const RIGHT_BOTTOM = 374;

class VisionService {
  private landmarker: FaceLandmarker | null = null;
  private mirroredCanvas: HTMLCanvasElement | null = null;
  private isInitializing: boolean = false;
  private initializationError: string | null = null;
  private lastInferenceTime: number = 0;
  private fpsBuffer: number[] = [];
  public currentFps: number = 0;

  public async initialize(): Promise<boolean> {
    if (this.landmarker) return true;
    if (this.isInitializing) return false;
    this.isInitializing = true;

    try {
      // Offline-first: only use bundled local WASM and model assets. Never fall back to a CDN.
      const fileset = await FilesetResolver.forVisionTasks('/wasm');
      const modelAssetPath = '/models/face_landmarker.task';
      const modelCheck = await fetch(modelAssetPath, { method: 'HEAD' });
      if (!modelCheck.ok) {
        throw new Error(`Local face-landmarker model is unavailable at ${modelAssetPath} (HTTP ${modelCheck.status}). Reinstall the bundled model asset.`);
      }

      try {
        this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFacialTransformationMatrixes: true,
        });
        console.log('[VisionService] GPU FaceLandmarker initialized.');
      } catch (gpuError) {
        console.warn('[VisionService] GPU face tracking unavailable; retrying with CPU:', gpuError);
        this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFacialTransformationMatrixes: true,
        });
        console.info('[VisionService] FaceLandmarker initialized with the CPU delegate.');
      }

      this.initializationError = null;
      return true;
    } catch (err) {
      this.landmarker?.close();
      this.landmarker = null;
      this.initializationError = err instanceof Error ? err.message : 'Unknown face-tracking initialization error.';
      console.error('[VisionService] Could not initialize gaze tracking:', err);
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  public getInitializationError(): string | null {
    return this.initializationError;
  }

  public isReady(): boolean {
    return this.landmarker !== null;
  }

  /**
   * Process a single video frame for eye landmarks and gaze features
   */
  public processVideoFrame(
    video: HTMLVideoElement
  ): VisionResult {
    const now = performance.now();
    if (this.lastInferenceTime > 0) {
      const dt = (now - this.lastInferenceTime) / 1000;
      if (dt > 0.001) {
        this.fpsBuffer.push(1 / dt);
        if (this.fpsBuffer.length > 20) this.fpsBuffer.shift();
        this.currentFps = Math.round(this.fpsBuffer.reduce((a, b) => a + b, 0) / this.fpsBuffer.length);
      }
    }
    this.lastInferenceTime = now;

    // Evaluate room lighting
    const { lighting } = cameraService.evaluateLighting(video);

    const defaultQuality: TrackingQualityState = {
      faceDetected: false,
      faceConfidence: 0,
      trackingConfidence: 0,
      eyeOpenness: 0,
      isBlinking: false,
      headPose: { yaw: 0, pitch: 0, roll: 0, distanceCm: 50, isStable: true, isGated: false },
      lightingQuality: lighting,
      fps: this.currentFps,
    };

    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      return {
        valid: false,
        x: 0,
        y: 0,
        rawX: 0,
        rawY: 0,
        confidence: 0,
        headPose: defaultQuality.headPose,
        ear: 0,
        quality: {
          ...defaultQuality,
          qualityIssue: 'NO_FACE',
          actionableFeedback: 'Bao cannot see your camera yet. Please wait a moment.',
        },
        backendUsed: this.isReady() ? 'browser_mediapipe' : 'none',
      };
    }

    if (!this.landmarker) {
      // If landmarker is not yet loaded, return cleanly with unavailable status
      return {
        valid: false,
        x: 0,
        y: 0,
        rawX: 0,
        rawY: 0,
        confidence: 0,
        headPose: defaultQuality.headPose,
        ear: 0,
        quality: {
          ...defaultQuality,
          qualityIssue: 'NO_FACE',
          actionableFeedback: 'Initializing face tracking…',
        },
        backendUsed: 'none',
      };
    }

    let detection;
    try {
      if (!this.mirroredCanvas) this.mirroredCanvas = document.createElement('canvas');
      this.mirroredCanvas.width = video.videoWidth;
      this.mirroredCanvas.height = video.videoHeight;
      const context = this.mirroredCanvas.getContext('2d');
      if (!context) throw new Error('Could not create the camera frame canvas.');
      context.setTransform(-1, 0, 0, 1, video.videoWidth, 0);
      context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      detection = this.landmarker.detectForVideo(this.mirroredCanvas, now);
    } catch (e) {
      console.warn('[VisionService] Detection error:', e);
      return {
        valid: false,
        x: 0,
        y: 0,
        rawX: 0,
        rawY: 0,
        confidence: 0,
        headPose: defaultQuality.headPose,
        ear: 0,
        quality: defaultQuality,
        backendUsed: 'browser_mediapipe',
      };
    }

    if (!detection || !detection.faceLandmarks || detection.faceLandmarks.length === 0) {
      return {
        valid: false,
        x: 0,
        y: 0,
        rawX: 0,
        rawY: 0,
        confidence: 0,
        headPose: defaultQuality.headPose,
        ear: 0,
        quality: {
          ...defaultQuality,
          faceDetected: false,
          qualityIssue: 'NO_FACE',
          actionableFeedback: 'Bao cannot see your face. Move closer or face the camera directly.',
        },
        backendUsed: 'browser_mediapipe',
      };
    }

    const landmarks = detection.faceLandmarks[0];
    const eyeFeatures = extractFourEyeFeatures(landmarks);

    // Compute head pose from transformation matrix or nose/cheek anchor landmarks
    let yaw = 0;
    let pitch = 0;
    let roll = 0;
    let distanceCm = 50;

    if (detection.facialTransformationMatrixes && detection.facialTransformationMatrixes.length > 0) {
      const mat = detection.facialTransformationMatrixes[0].data;
      if (mat && mat.length >= 16) {
        // Rotation elements
        const r00 = mat[0];
        const r10 = mat[1];
        const r20 = mat[2];
        const r21 = mat[6];
        const r22 = mat[10];
        yaw = (Math.atan2(r10, r00) * 180) / Math.PI;
        pitch = (Math.atan2(-r20, Math.hypot(r00, r10)) * 180) / Math.PI;
        roll = (Math.atan2(r21, r22) * 180) / Math.PI;
        const tz = Math.abs(mat[14]);
        if (tz > 10) distanceCm = Math.round(tz / 10);
      }
    } else {
      // Fallback geometric estimation from nose tip (4), chin (152), left cheek (234), right cheek (454)
      const nose = landmarks[4];
      const chin = landmarks[152];
      const leftCheek = landmarks[234];
      const rightCheek = landmarks[454];
      const cheekMidX = (leftCheek.x + rightCheek.x) / 2;
      yaw = (nose.x - cheekMidX) * 120;
      pitch = (nose.y - (chin.y + nose.y) / 2) * 80;
    }

    // Eye Aspect Ratio (EAR)
    const leftEar = this.computeEar(landmarks, LEFT_TOP, LEFT_BOTTOM, LEFT_CORNERS);
    const rightEar = this.computeEar(landmarks, RIGHT_TOP, RIGHT_BOTTOM, RIGHT_CORNERS);
    const ear = (leftEar + rightEar) / 2;
    const isBlinking = ear < 0.16;

    // Gating on extreme head pose
    const isHeadGated = Math.abs(yaw) > 30 || Math.abs(pitch) > 30;

    const headScore = 1 - Math.min(1, (Math.abs(yaw) + Math.abs(pitch)) / 50);
    const opennessScore = Math.min(1, Math.max(0, (ear - 0.1) / 0.25));

    const trackingConfidence = Math.max(
      0.1,
      Math.min(1.0, 0.7 * opennessScore + 0.3 * headScore)
    );

    let qualityIssue: TrackingQualityState['qualityIssue'] = undefined;
    let actionableFeedback: string | undefined = undefined;

    if (isHeadGated) {
      qualityIssue = 'HEAD_TURNED';
      actionableFeedback = 'Please face the camera directly to help Bao guide you.';
    } else if (isBlinking) {
      qualityIssue = 'EYES_CLOSED';
    } else if (lighting === 'low') {
      qualityIssue = 'POOR_LIGHTING';
      actionableFeedback = 'A little more warm room lighting will help Bao track your eyes.';
    } else if (trackingConfidence < 0.35) {
      qualityIssue = 'MOTION_BLUR';
      actionableFeedback = 'Keep your head steady and comfortable.';
    }

    const qualityState: TrackingQualityState = {
      faceDetected: true,
      faceConfidence: 0.95,
      trackingConfidence,
      eyeOpenness: ear,
      isBlinking,
      headPose: {
        yaw: Math.round(yaw * 10) / 10,
        pitch: Math.round(pitch * 10) / 10,
        roll: Math.round(roll * 10) / 10,
        distanceCm,
        isStable: !isHeadGated && Math.abs(yaw) < 15,
        isGated: isHeadGated,
      },
      lightingQuality: lighting,
      qualityIssue,
      actionableFeedback,
      fps: this.currentFps,
    };

    const isValid = !isHeadGated && !isBlinking && trackingConfidence >= 0.35;

    return {
      valid: isValid,
      x: 0,
      y: 0,
      rawX: 0,
      rawY: 0,
      confidence: trackingConfidence,
      headPose: qualityState.headPose,
      ear,
      eyeFeatures,
      quality: qualityState,
      backendUsed: 'python_service',
    };
  }

  private computeEar(landmarks: any[], topIdx: number, bottomIdx: number, cornerIndices: number[]): number {
    const top = landmarks[topIdx];
    const bottom = landmarks[bottomIdx];
    const c1 = landmarks[cornerIndices[0]];
    const c2 = landmarks[cornerIndices[1]];
    const vert = Math.hypot(top.x - bottom.x, top.y - bottom.y);
    const horiz = Math.hypot(c1.x - c2.x, c1.y - c2.y);
    return horiz > 0.001 ? vert / horiz : 0;
  }

  public release() {
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch {
        // Ignore
      }
      this.landmarker = null;
    }
    this.mirroredCanvas = null;
  }
}

export const visionService = new VisionService();
