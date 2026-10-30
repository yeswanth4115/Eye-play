import React, { useState, useEffect, useRef } from 'react';
import { PandaMascot } from '../mascot/PandaMascot';
import { gazePipeline } from '../../services/gazePipeline';
import { soundService } from '../../services/soundEffects';
import { voiceGuidance, STANDARD_VOICE_STEPS } from '../../services/voiceGuidanceService';
import { CalibrationModel, GazePoint, TrackingQualityState, InteractionMode } from '../../types';

interface CalibrationGameProps {
  currentGaze: GazePoint | null;
  trackingQuality: TrackingQualityState | null;
  interactionMode: InteractionMode;
  onComplete: (model: CalibrationModel) => void;
  onCancel: () => void;
  onSwitchToTouch: () => void;
  pointCount?: 9 | 13;
}

interface Target {
  id: number;
  xPercent: number;
  yPercent: number;
  isHoldout: boolean;
}

const CALIBRATION_TARGETS: Target[] = [
  { id: 1, xPercent: 50, yPercent: 50, isHoldout: false },
  { id: 2, xPercent: 20, yPercent: 20, isHoldout: false },
  { id: 3, xPercent: 50, yPercent: 20, isHoldout: false },
  { id: 4, xPercent: 80, yPercent: 20, isHoldout: false },
  { id: 5, xPercent: 80, yPercent: 50, isHoldout: false },
  { id: 6, xPercent: 80, yPercent: 80, isHoldout: false },
  { id: 7, xPercent: 50, yPercent: 80, isHoldout: false },
  { id: 8, xPercent: 20, yPercent: 80, isHoldout: false },
  { id: 9, xPercent: 20, yPercent: 50, isHoldout: false },
  { id: 10, xPercent: 35, yPercent: 35, isHoldout: true },
  { id: 11, xPercent: 65, yPercent: 35, isHoldout: true },
  { id: 12, xPercent: 65, yPercent: 65, isHoldout: true },
  { id: 13, xPercent: 35, yPercent: 65, isHoldout: true },
];

export const CalibrationGame: React.FC<CalibrationGameProps> = ({
  currentGaze,
  trackingQuality,
  interactionMode,
  onComplete,
  onCancel,
  onSwitchToTouch,
  pointCount = 9,
}) => {
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);
  const [dwellMs, setDwellMs] = useState(0);
  const [starsCollected, setStarsCollected] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Look at the twinkling star with Bao!');
  const [isDone, setIsDone] = useState(false);
  const [validationReport, setValidationReport] = useState<CalibrationModel | null>(null);
  const [hasEnoughCalibrationSamples, setHasEnoughCalibrationSamples] = useState(false);
  const [showGazePointer, setShowGazePointer] = useState(true);

  const targets = pointCount === 9 ? CALIBRATION_TARGETS.slice(0, 9) : CALIBRATION_TARGETS;
  const currentTarget = targets[currentTargetIndex];
  const samplesRef = useRef<
    { targetX: number; targetY: number; rawX: number; rawY: number; yaw: number; pitch: number; isHoldout: boolean }[]
  >([]);
  const dwellStartedAtRef = useRef<number | null>(null);
  const lastGazeTimestampRef = useRef<number | null>(null);
  const targetSamplesRef = useRef<{ x: number; y: number }[]>([]);
  const lastPointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const pointerMovedForTargetRef = useRef(true);
  const lastPointerMovementAtRef = useRef(performance.now());
  const dwellRequired = 500;
  const targetTimeoutMs = 1100;

  useEffect(() => {
    voiceGuidance.speak('Let’s find the stars together. Look at each star and keep your eyes there until it sparkles.');
  }, []);

  useEffect(() => {
    lastPointerMovementAtRef.current = performance.now();
    if (currentTargetIndex > 0) pointerMovedForTargetRef.current = false;
    setShowGazePointer(true);
  }, [currentTargetIndex]);

  useEffect(() => {
    if (isDone || interactionMode !== 'GAZE' || !currentTarget || !currentGaze) return;
    const previousTimestamp = lastGazeTimestampRef.current;
    if (previousTimestamp === currentGaze.timestamp) return;
    lastGazeTimestampRef.current = currentGaze.timestamp;

    const resetDwell = () => {
      dwellStartedAtRef.current = null;
      targetSamplesRef.current = [];
      setDwellMs((previous) => (previous === 0 ? previous : 0));
    };
    const isFresh = performance.now() - currentGaze.timestamp <= 400;
    const hasTrackingGap = previousTimestamp !== null && currentGaze.timestamp - previousTimestamp > 250;
    if (
      !currentGaze.isValid ||
      !isFresh ||
      !trackingQuality?.faceDetected ||
      trackingQuality.isBlinking ||
      trackingQuality.headPose.isGated
    ) {
      resetDwell();
      setStatusMessage('Keep your face toward the camera and try the star again.');
      return;
    }
    if (hasTrackingGap) resetDwell();

    const previousPosition = lastPointerPositionRef.current;
    const pointerMoved =
      !previousPosition || Math.hypot(currentGaze.x - previousPosition.x, currentGaze.y - previousPosition.y) >= 3;
    if (pointerMoved) {
      lastPointerPositionRef.current = { x: currentGaze.x, y: currentGaze.y };
      lastPointerMovementAtRef.current = performance.now();
      pointerMovedForTargetRef.current = true;
      setShowGazePointer(true);
    } else if (performance.now() - lastPointerMovementAtRef.current >= 650) {
      setShowGazePointer(false);
    }

    const targetX = (currentTarget.xPercent / 100) * window.innerWidth;
    const targetY = (currentTarget.yPercent / 100) * window.innerHeight;
    const acquisitionRadius = Math.max(150, Math.min(240, Math.min(window.innerWidth, window.innerHeight) * 0.25));
    if (!pointerMovedForTargetRef.current) {
      resetDwell();
      setStatusMessage('Look toward the next star.');
      return;
    }
    if (Math.hypot(currentGaze.x - targetX, currentGaze.y - targetY) > acquisitionRadius) {
      resetDwell();
      setStatusMessage('Move the gaze dot onto the star, then keep looking.');
      return;
    }

    if (dwellStartedAtRef.current === null) {
      dwellStartedAtRef.current = currentGaze.timestamp;
    }
    targetSamplesRef.current.push({ x: currentGaze.rawX, y: currentGaze.rawY });
    const elapsed = currentGaze.timestamp - (dwellStartedAtRef.current ?? currentGaze.timestamp);
    setDwellMs(Math.min(dwellRequired, Math.max(0, elapsed)));
    setStatusMessage(currentTarget.isHoldout ? 'Hold steady while Bao checks this star…' : 'Keep looking at the star…');

    if (elapsed >= dwellRequired && targetSamplesRef.current.length >= 4) {
      const median = (values: number[]) => {
        const sorted = [...values].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      };
      samplesRef.current.push({
        targetX,
        targetY,
        rawX: median(targetSamplesRef.current.map((sample) => sample.x)),
        rawY: median(targetSamplesRef.current.map((sample) => sample.y)),
        yaw: 0,
        pitch: 0,
        isHoldout: currentTarget.isHoldout,
      });
      soundService.playStarChime(1.0 + currentTargetIndex * 0.08);
      setStarsCollected((count) => count + 1);
      if (currentTargetIndex + 1 < targets.length) {
        setCurrentTargetIndex((index) => index + 1);
        setStatusMessage(currentTarget.isHoldout ? 'Checking our meadow stars…' : 'Yum! Bao collected a star!');
        resetDwell();
      } else {
        finishCalibration();
      }
    } else if (elapsed >= dwellRequired) {
      setStatusMessage('Hold your gaze a little longer so Bao can get a steady reading.');
    }
  }, [currentGaze, currentTarget, currentTargetIndex, interactionMode, isDone, targets.length, trackingQuality]);

  const finishCalibration = () => {
    setIsDone(true);
    soundService.playSuccessSparkle();

    if (interactionMode === 'TOUCH') {
      const touchModel: CalibrationModel = {
        polyCoeffsX: [window.innerWidth / 2, 500, 0, 5, 0, 5],
        polyCoeffsY: [window.innerHeight / 2, 0, 500, 0, 5, 5],
        headPoseWeightX: 0,
        headPoseWeightY: 0,
        meanAngularErrorDeg: 0,
        medianAngularErrorDeg: 0,
        meanPixelError: 0,
        isValidated: true,
        timestamp: Date.now(),
      };
      setValidationReport(touchModel);
      return;
    }

    const trainingSamples = samplesRef.current.filter((s) => !s.isHoldout);
    const holdouts = samplesRef.current.filter((s) => s.isHoldout);

    const model = gazePipeline.fitCalibrationModel(trainingSamples, holdouts);
    setValidationReport(model);

    setHasEnoughCalibrationSamples(trainingSamples.length >= 5 && holdouts.length >= 2);
    if (model.isValidated) {
      voiceGuidance.speak('You did it! The stars are ready. Let’s play!');
    } else {
      voiceGuidance.speak(
        'That was tricky, and that’s okay. We can try again or play using touch.'
      );
    }
  };

  useEffect(() => {
    if (isDone || interactionMode !== 'GAZE') return;
    const timeoutId = window.setTimeout(() => {
      targetSamplesRef.current = [];
      dwellStartedAtRef.current = null;
      if (currentTargetIndex + 1 < targets.length) {
        setCurrentTargetIndex((index) => index + 1);
        setDwellMs(0);
        setStatusMessage('Let’s try the next star.');
      } else {
        finishCalibration();
      }
    }, targetTimeoutMs);
    return () => window.clearTimeout(timeoutId);
  }, [currentTargetIndex, interactionMode, isDone, targets.length]);

  const advanceTouchTarget = () => {
    soundService.playStarChime(1.0 + currentTargetIndex * 0.08);
    setStarsCollected((count) => count + 1);
    if (currentTargetIndex + 1 < targets.length) {
      setCurrentTargetIndex((index) => index + 1);
      setDwellMs(0);
    } else {
      finishCalibration();
    }
  };

  const progressPercent = Math.min(100, Math.round((dwellMs / dwellRequired) * 100));

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gradient-to-b from-sky-100 via-emerald-50 to-emerald-100 select-none">
      {/* Top Friendly Header */}
      <div className="absolute top-6 left-6 right-6 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-xl font-bold text-amber-950 shadow-sm">
            ⭐
          </span>
          <div>
            <h1 className="text-xl font-bold text-emerald-950 font-['Quicksand']">Star Catcher Calibration</h1>
            <p className="text-xs text-emerald-800">
              Star {Math.min(currentTargetIndex + 1, targets.length)} of {targets.length} ·{' '}
              {interactionMode === 'TOUCH' ? 'Touch & Tap Mode' : 'Eye Gaze Tracking'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSwitchToTouch}
            className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 shadow-xs hover:bg-amber-100 cursor-pointer"
          >
            Switch to Touch Mode
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-emerald-300 bg-white/80 px-4 py-2 text-xs font-semibold text-emerald-900 shadow-xs hover:bg-white transition-colors cursor-pointer"
          >
            Skip (Esc)
          </button>
        </div>
      </div>

      {/* Target Star and Mascot */}
      {!isDone && currentTarget && (
        <div
          onClick={() => {
            if (interactionMode === 'TOUCH') advanceTouchTarget();
          }}
          className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-all duration-150 ease-out cursor-pointer"
          style={{
            left: `${currentTarget.xPercent}%`,
            top: `${currentTarget.yPercent}%`,
          }}
        >
          {/* Circular Progress Ring */}
          <div className="relative flex h-24 w-24 items-center justify-center">
            <svg className="absolute h-full w-full -rotate-90">
              <circle cx="48" cy="48" r="40" fill="none" stroke="#E2E8F0" strokeWidth="6" opacity="0.4" />
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="6"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * progressPercent) / 100}
                strokeLinecap="round"
                className="transition-all duration-75"
              />
            </svg>

            {/* Glowing Star Target */}
            <div className="animate-pulse text-4xl filter drop-shadow">⭐</div>
          </div>

          <PandaMascot expression="happy" speechText={statusMessage} size="sm" className="mt-1" />
        </div>
      )}

      {interactionMode === 'GAZE' && currentGaze?.isValid &&
        showGazePointer && performance.now() - currentGaze.timestamp <= 400 && (
          <div
            className="pointer-events-none fixed z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.25)]"
            style={{
              left: currentGaze.x,
              top: currentGaze.y,
              transition: 'left 70ms linear, top 70ms linear, opacity 180ms ease-out',
            }}
            aria-label="Live gaze position"
          />
        )}

      {/* Finished Summary / Validation Gate */}
      {isDone && validationReport && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-emerald-950/80 p-6 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl border border-emerald-100">
            <div className="mb-3 text-4xl">{validationReport.isValidated ? '🎉' : '⚠️'}</div>
            <h2 className="text-2xl font-bold text-slate-900 font-['Quicksand']">
              {validationReport.isValidated
                ? 'Calibration Complete!'
                : hasEnoughCalibrationSamples
                ? 'Gaze check needs another try'
                : 'Not enough steady readings yet'}
            </h2>
            <p className="mb-4 text-xs text-slate-600">
              {validationReport.isValidated
                ? `Bao collected ${starsCollected} stars and the gaze check passed.`
                : hasEnoughCalibrationSamples
                ? 'The camera gaze positions did not match enough stars. Try again with steady lighting, or use Touch Mode.'
                : `Bao collected ${starsCollected} steady readings. Try again with your face centered, or use Touch Mode.`}
            </p>

            {/* Quality Report Metrics */}
            {hasEnoughCalibrationSamples && (
              <div className="mb-5 rounded-2xl bg-slate-50 p-4 text-left border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Validation Quality</span>
                  <span
                    className={`text-xs font-bold ${
                      validationReport.isValidated ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {validationReport.isValidated ? 'Acceptable (<3.8°)' : 'High Discrepancy'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-700">
                  <div>
                    <span className="text-slate-400 block">Mean Angular Error:</span>
                    <span className="font-semibold text-sm tabular-nums">{validationReport.meanAngularErrorDeg}°</span>
                    <span className="text-slate-400 text-[10px] ml-1">({validationReport.meanPixelError} px)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Median Error:</span>
                    <span className="font-semibold text-sm tabular-nums">{validationReport.medianAngularErrorDeg}°</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => onComplete(validationReport)}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-500 transition-colors cursor-pointer"
              >
                {validationReport.isValidated ? 'Start Play Session →' : 'Continue with gaze (may be inaccurate)'}
              </button>

              {!validationReport.isValidated && (
                <button
                  type="button"
                  onClick={onSwitchToTouch}
                  className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-amber-400 transition-colors cursor-pointer"
                >
                  Switch to Touch Mode (Recommended for accuracy)
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  gazePipeline.resetCalibration();
                  setIsDone(false);
                  setCurrentTargetIndex(0);
                  setDwellMs(0);
                  setStarsCollected(0);
                  setHasEnoughCalibrationSamples(false);
                  setShowGazePointer(true);
                  lastPointerPositionRef.current = null;
                  pointerMovedForTargetRef.current = true;
                  lastPointerMovementAtRef.current = performance.now();
                  lastGazeTimestampRef.current = null;
                  dwellStartedAtRef.current = null;
                  targetSamplesRef.current = [];
                  samplesRef.current = [];
                }}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Recalibrate Stars
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
