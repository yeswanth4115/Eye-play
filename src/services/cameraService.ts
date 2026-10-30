/**
 * Camera Service for EyePlay
 * Manages webcam streams, permission discovery, lighting quality checks,
 * resolution constraints, and lifecycle cleanup.
 */

export interface CameraStatus {
  available: boolean;
  permission: 'prompt' | 'granted' | 'denied' | 'unsupported';
  active: boolean;
  deviceId?: string;
  label?: string;
  width: number;
  height: number;
  lighting: 'good' | 'low' | 'harsh' | 'unknown';
  luminance: number; // 0 - 255
  errorMessage?: string;
}

export type CameraStatusListener = (status: CameraStatus) => void;

class CameraService {
  private currentStream: MediaStream | null = null;
  private attachedVideo: HTMLVideoElement | null = null;
  private listeners: Set<CameraStatusListener> = new Set();
  private lightingCanvas: HTMLCanvasElement | null = null;
  private lightingCtx: CanvasRenderingContext2D | null = null;

  public status: CameraStatus = {
    available: false,
    permission: 'prompt',
    active: false,
    width: 640,
    height: 480,
    lighting: 'unknown',
    luminance: 120,
  };

  constructor() {
    this.checkAvailability();
    if (typeof window !== 'undefined') {
      navigator.mediaDevices?.addEventListener('devicechange', () => this.checkAvailability());
      document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    }
  }

  public subscribe(listener: CameraStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.status));
  }

  public async checkAvailability(): Promise<CameraStatus> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.status = {
        ...this.status,
        available: false,
        permission: 'unsupported',
        errorMessage: 'Camera API is not supported on this browser or platform.',
      };
      this.notify();
      return this.status;
    }

    try {
      if (navigator.permissions?.query) {
        try {
          const perm = await navigator.permissions.query({ name: 'camera' as PermissionName });
          this.status.permission = perm.state;
          perm.onchange = () => {
            this.status.permission = perm.state;
            this.notify();
          };
        } catch {
          // Some browsers do not support { name: 'camera' } in permissions.query
        }
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      this.status.available = videoDevices.length > 0;
      if (!this.status.available) {
        this.status.errorMessage = 'No camera device found on this system.';
      }
    } catch (err) {
      this.status.available = false;
      this.status.errorMessage = (err as Error).message;
    }

    this.notify();
    return this.status;
  }

  public async requestCamera(videoElement?: HTMLVideoElement | null): Promise<MediaStream> {
    await this.checkAvailability();

    if (!this.status.available && this.status.permission === 'unsupported') {
      throw new Error(this.status.errorMessage || 'Camera is not supported.');
    }

    // Stop any existing stream
    this.releaseCamera();

    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user',
        frameRate: { ideal: 30, max: 30 },
      },
      audio: false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentStream = stream;
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings();

      this.status = {
        ...this.status,
        permission: 'granted',
        active: true,
        width: settings?.width || 640,
        height: settings?.height || 480,
        deviceId: settings?.deviceId,
        label: track?.label,
        errorMessage: undefined,
      };

      track.onended = () => {
        this.status.active = false;
        this.status.errorMessage = 'Camera stream was interrupted or disconnected.';
        this.notify();
      };

      if (videoElement) {
        this.attachToVideo(videoElement);
      }

      this.notify();
      return stream;
    } catch (err: unknown) {
      const error = err as Error;
      let permissionState: CameraStatus['permission'] = 'prompt';
      let message = 'Unable to access camera.';

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        permissionState = 'denied';
        message = 'Camera permission was denied. Please allow camera access in browser settings.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        message = 'No camera found. Please connect a webcam or enable your device camera.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        message = 'Camera is already in use by another application.';
      }

      this.status = {
        ...this.status,
        permission: permissionState,
        active: false,
        errorMessage: message,
      };
      this.notify();
      throw new Error(message);
    }
  }

  public attachToVideo(video: HTMLVideoElement) {
    this.attachedVideo = video;
    if (this.currentStream) {
      video.srcObject = this.currentStream;
      video.play().catch(() => {
        // Autoplay policy fallback
      });
    }
  }

  public getVideoElement(): HTMLVideoElement | null {
    return this.attachedVideo;
  }

  public getStream(): MediaStream | null {
    return this.currentStream;
  }

  /**
   * Sample video frame luminance to detect poor or harsh lighting
   */
  public evaluateLighting(video: HTMLVideoElement): { lighting: CameraStatus['lighting']; luminance: number } {
    if (!video || video.readyState < 2) {
      return { lighting: 'unknown', luminance: 120 };
    }

    if (!this.lightingCanvas) {
      this.lightingCanvas = document.createElement('canvas');
      this.lightingCanvas.width = 64;
      this.lightingCanvas.height = 48;
      this.lightingCtx = this.lightingCanvas.getContext('2d', { willReadFrequently: true });
    }

    if (!this.lightingCtx) {
      return { lighting: 'unknown', luminance: 120 };
    }

    try {
      this.lightingCtx.drawImage(video, 0, 0, 64, 48);
      const imgData = this.lightingCtx.getImageData(0, 0, 64, 48).data;
      let totalLuma = 0;
      const count = imgData.length / 4;

      for (let i = 0; i < imgData.length; i += 4) {
        // ITU-R BT.601 luminance
        const luma = 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
        totalLuma += luma;
      }

      const avgLuminance = Math.round(totalLuma / count);
      let lighting: CameraStatus['lighting'] = 'good';

      if (avgLuminance < 45) {
        lighting = 'low';
      } else if (avgLuminance > 225) {
        lighting = 'harsh';
      }

      this.status.lighting = lighting;
      this.status.luminance = avgLuminance;
      return { lighting, luminance: avgLuminance };
    } catch {
      return { lighting: 'unknown', luminance: 120 };
    }
  }

  public releaseCamera() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((track) => track.stop());
      this.currentStream = null;
    }
    if (this.attachedVideo) {
      this.attachedVideo.srcObject = null;
    }
    this.status.active = false;
    this.notify();
  }

  private handleVisibilityChange() {
    if (document.hidden && this.status.active) {
      // Browser tab hidden: camera can be paused or throttled
    }
  }
}

export const cameraService = new CameraService();
