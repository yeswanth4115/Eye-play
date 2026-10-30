import React, { useState, useEffect, useRef } from 'react';
import { TrackingQualityState, InteractionMode } from '../../types';
import { cameraService, CameraStatus } from '../../services/cameraService';
import { visionService } from '../../services/visionService';
import { socialRobotGazeService } from '../../services/socialRobotGazeService';
import { voiceGuidance, STANDARD_VOICE_STEPS } from '../../services/voiceGuidanceService';
import { soundService } from '../../services/soundEffects';
import { PandaMascot } from '../mascot/PandaMascot';

interface ReadinessCheckScreenProps {
  onProceedToCalibration: () => void;
  onCalibrateNow?: () => void;
  savedCalibrationAvailable?: boolean;
  onProceedToTouchPlay: () => void;
  onBack: () => void;
  onCameraReady: (stream: MediaStream) => void;
}

export const ReadinessCheckScreen: React.FC<ReadinessCheckScreenProps> = ({
  onProceedToCalibration,
  onCalibrateNow,
  savedCalibrationAvailable = false,
  onProceedToTouchPlay,
  onBack,
  onCameraReady,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>(cameraService.status);
  const [qualityState, setQualityState] = useState<TrackingQualityState | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [visionInitialized, setVisionInitialized] = useState(false);
  const [visionError, setVisionError] = useState<string | null>(null);
  const [gazeServiceReady, setGazeServiceReady] = useState(false);
  const [hasGazePrediction, setHasGazePrediction] = useState(false);
  const [gazeServiceError, setGazeServiceError] = useState<string | null>(null);

  useEffect(() => {
    const unsubCamera = cameraService.subscribe(setCameraStatus);
    voiceGuidance.speak(
      'Let’s get ready to play. Sit comfortably and look toward the screen.'
    );

    // Initialize vision model in background
    visionService.initialize().then((ready) => {
      setVisionInitialized(ready);
      setVisionError(ready ? null : visionService.getInitializationError());
    });
    socialRobotGazeService.checkHealth().then((ready) => {
      setGazeServiceReady(ready);
      setGazeServiceError(ready ? null : socialRobotGazeService.getError());
    });

    return () => {
      unsubCamera();
    };
  }, []);

  // Request camera when user taps or auto-request if permission already granted
  const handleRequestCamera = async () => {
    setIsRequesting(true);
    try {
      const stream = await cameraService.requestCamera(videoRef.current);
      onCameraReady(stream);
      soundService.playStarChime(1.2);
    } catch (err) {
      console.warn('[Readiness] Camera request error:', err);
    } finally {
      setIsRequesting(false);
    }
  };

  // Inference loop for live preview feedback
  useEffect(() => {
    let animId: number;
    let isActive = true;
    let lastInferenceTime = 0;

    const checkLoop = () => {
      if (!isActive) return;
      const video = videoRef.current;
      const now = performance.now();
      if (
        video &&
        video.readyState >= 2 &&
        visionService.isReady() &&
        !socialRobotGazeService.isInferenceInFlight() &&
        now - lastInferenceTime >= 50
      ) {
        lastInferenceTime = now;
        const result = visionService.processVideoFrame(video);
        setQualityState(result.quality);
        if (result.valid && result.eyeFeatures) {
          void socialRobotGazeService
            .submitFeatures(
              result.eyeFeatures,
              window.innerWidth,
              window.innerHeight,
              result.confidence
            )
            .then((prediction) => {
              setHasGazePrediction(prediction !== null);
              setGazeServiceError(socialRobotGazeService.getError());
            });
        } else {
          setHasGazePrediction(false);
        }
      }
      animId = requestAnimationFrame(checkLoop);
    };

    if (cameraStatus.active) {
      animId = requestAnimationFrame(checkLoop);
    }

    return () => {
      isActive = false;
      cancelAnimationFrame(animId);
    };
  }, [cameraStatus.active, visionInitialized]);

  const isReadyForCalibration =
    cameraStatus.active &&
    gazeServiceReady &&
    hasGazePrediction &&
    qualityState?.faceDetected &&
    !qualityState.isBlinking &&
    !qualityState.headPose.isGated &&
    qualityState.trackingConfidence > 0.4;

  return (
    <div className="relative z-10 flex h-full w-full flex-col items-center justify-center p-4 sm:p-6 text-center select-none overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white/95 p-6 sm:p-8 shadow-xl backdrop-blur-md border border-emerald-100 flex flex-col items-center my-auto text-left">
        {/* Header */}
        <div className="flex items-center justify-between w-full border-b border-emerald-100 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-xl font-bold text-sky-700">
              📷
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-emerald-950 font-['Quicksand']">
                Camera & Environment Check
              </h2>
              <p className="text-xs text-slate-500">Checking room lighting, face position, and gaze tracking readiness</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            ← Back
          </button>
        </div>

        {/* Video Preview and Positioning Guide */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-4">
          {/* Live Camera View Box */}
          <div className="relative aspect-4/3 w-full rounded-2xl bg-slate-900 overflow-hidden flex items-center justify-center border-2 border-emerald-200">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`h-full w-full object-cover scale-x-[-1] ${cameraStatus.active ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* If camera is not yet active */}
            {!cameraStatus.active && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-800 text-white">
                <span className="text-4xl mb-2">📸</span>
                <p className="text-sm font-bold">Camera is resting</p>
                <p className="text-xs text-slate-300 mt-1 max-w-xs">
                  Face and eye tracking run locally in your browser. Only four normalized eye features are sent to the local gaze model; camera images are not uploaded or stored.
                </p>
                <button
                  type="button"
                  onClick={handleRequestCamera}
                  disabled={isRequesting}
                  className="mt-4 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isRequesting ? 'Connecting…' : 'Enable Camera'}
                </button>
              </div>
            )}

            {/* Face Oval Positioning Overlay when camera is active */}
            {cameraStatus.active && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className={`h-48 w-36 rounded-[50%] border-2 border-dashed transition-colors duration-300 ${
                    qualityState?.faceDetected ? 'border-emerald-400 bg-emerald-400/10' : 'border-amber-400 bg-amber-400/10'
                  }`}
                />
              </div>
            )}
          </div>

          {/* Environmental Readiness Checklist */}
          <div className="flex flex-col justify-between space-y-2.5">
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Readiness Indicators
              </span>

              {/* 1. Camera Access */}
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-200 text-xs">
                <span className="font-semibold text-slate-700">Camera Stream:</span>
                <span
                  className={`font-bold ${
                    cameraStatus.active ? 'text-emerald-600' : cameraStatus.permission === 'denied' ? 'text-rose-600' : 'text-amber-600'
                  }`}
                >
                  {cameraStatus.active ? '✓ Active (640x480)' : cameraStatus.permission === 'denied' ? 'Denied' : 'Waiting'}
                </span>
              </div>

              {/* 2. Room Lighting */}
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-200 text-xs">
                <span className="font-semibold text-slate-700">Room Lighting:</span>
                <span
                  className={`font-bold ${
                    qualityState?.lightingQuality === 'good'
                      ? 'text-emerald-600'
                      : qualityState?.lightingQuality === 'low'
                      ? 'text-amber-600'
                      : 'text-slate-500'
                  }`}
                >
                  {qualityState?.lightingQuality === 'good'
                    ? '✓ Good Warm Light'
                    : qualityState?.lightingQuality === 'low'
                    ? 'Low Light'
                    : 'Checking…'}
                </span>
              </div>

              {/* 3. Face Presence */}
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-200 text-xs">
                <span className="font-semibold text-slate-700">Face Detected:</span>
                <span className={`font-bold ${qualityState?.faceDetected ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {qualityState?.faceDetected ? '✓ Face Centered' : 'Looking for child…'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-200 text-xs">
                <span className="font-semibold text-slate-700">Four-feature Gaze Model:</span>
                <span className={`font-bold ${hasGazePrediction ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {hasGazePrediction ? '✓ Tracking' : gazeServiceReady ? 'Waiting for gaze…' : 'Service unavailable'}
                </span>
              </div>

              {/* 4. Head Angle / Stability */}
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-200 text-xs">
                <span className="font-semibold text-slate-700">Head Pose:</span>
                <span
                  className={`font-bold ${
                    qualityState?.headPose.isStable ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {qualityState ? `Yaw: ${qualityState.headPose.yaw}° · Pitch: ${qualityState.headPose.pitch}°` : 'Measuring…'}
                </span>
              </div>
            </div>

            {/* Actionable reassuring message from Bao */}
            {visionError && (
              <div role="alert" className="rounded-2xl bg-rose-50 p-3 border border-rose-200 text-xs text-rose-900">
                Face tracking could not start: {visionError} Try refreshing the page or switch to Touch Mode.
              </div>
            )}
            {gazeServiceError && (
              <div role="alert" className="rounded-2xl bg-rose-50 p-3 border border-rose-200 text-xs text-rose-900">
                {gazeServiceError} Start the local four-feature gaze service as described in README.md, then refresh this page.
              </div>
            )}
            <div className="rounded-2xl bg-amber-50 p-3 border border-amber-200 flex items-start gap-2 text-xs text-amber-950">
              <span className="text-base shrink-0">💡</span>
              <p className="leading-snug">
                {qualityState?.actionableFeedback ||
                  (visionError
                    ? 'Touch Mode is available if camera tracking is not supported on this device.'
                    : cameraStatus.active
                    ? 'Center your face in the oval and keep your eyes gently on Bao!'
                    : 'Enable your camera to start gaze tracking.')}
              </p>
            </div>
          </div>
        </div>

        {/* Buttons / Options */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onProceedToTouchPlay}
            className="text-xs font-semibold text-amber-800 underline underline-offset-4 hover:text-amber-950 cursor-pointer"
          >
            Camera trouble? Switch to Touch Mode (Accessible)
          </button>

          <button
            type="button"
            onClick={() => {
              soundService.playStarChime(1.2);
              onProceedToCalibration();
            }}
            disabled={!isReadyForCalibration}
            className={`flex items-center gap-2 rounded-xl py-3 px-6 text-sm font-extrabold text-white shadow-md transition-all cursor-pointer ${
              isReadyForCalibration
                ? 'bg-emerald-600 hover:bg-emerald-500 hover:scale-102'
                : 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'
            }`}
          >
            <span>{savedCalibrationAvailable ? 'Start Play with Saved Setup →' : 'Start Play with Pre-trained Model →'}</span>
          </button>
        </div>
        {!savedCalibrationAvailable && (
          <div className="mt-3 w-full rounded-xl bg-sky-50 border border-sky-100 p-3 text-xs text-sky-950">
            <p>The pre-trained gaze model can start without calibration. Its screen estimates may be less precise. An adult can optionally run a short eye setup to improve the screen mapping.</p>
            {onCalibrateNow && (
              <button type="button" onClick={onCalibrateNow} className="mt-2 font-bold underline underline-offset-2 hover:text-sky-700">
                Optional: improve the screen mapping
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
