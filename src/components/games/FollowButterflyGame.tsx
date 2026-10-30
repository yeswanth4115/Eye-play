import React, { useState, useEffect, useRef } from 'react';
import { GazePoint, InteractionMode, TrialMetric } from '../../types';
import { soundService } from '../../services/soundEffects';
import { gazePipeline } from '../../services/gazePipeline';

interface FollowButterflyGameProps {
  currentGaze: GazePoint | null;
  onTrialComplete: (metric: TrialMetric) => void;
  sensorySafe?: boolean;
  interactionMode: InteractionMode;
}

export const FollowButterflyGame: React.FC<FollowButterflyGameProps> = ({
  currentGaze,
  onTrialComplete,
  sensorySafe = false,
  interactionMode,
}) => {
  const [stage] = useState<'linear' | 'sinusoidal' | 'figure8'>('sinusoidal');
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number }[]>([]);
  // Position of butterfly target
  const targetPosRef = useRef({ x: 500, y: 300 });
  const [targetDisplay, setTargetDisplay] = useState({ x: 500, y: 300 });

  // Tracking metrics
  const errorHistoryRef = useRef<number[]>([]);
  const gazeHistoryRef = useRef<GazePoint[]>([]);
  const butterflyTraceRef = useRef<{ timestamp: number; targetX: number; targetY: number; gazeX: number; gazeY: number; confidence: number }[]>([]);
  const gainHistoryRef = useRef<number[]>([]);
  const nearTargetSamplesRef = useRef(0);
  const sampleCountRef = useRef(0);
  const completedRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const trialNoRef = useRef(1);

  // Adaptive difficulty (target speed & radius)
  const [speedMultiplier] = useState(1.0);
  const targetRadius = Math.max(50, Math.min(85, 75 / speedMultiplier));

  useEffect(() => {
    startTimeRef.current = Date.now();
    errorHistoryRef.current = [];
    gazeHistoryRef.current = [];
    butterflyTraceRef.current = [];
    gainHistoryRef.current = [];
    nearTargetSamplesRef.current = 0;
    sampleCountRef.current = 0;
    completedRef.current = false;

    let animId: number;
    let t = 0;

    const animate = () => {
      t += 0.016 * speedMultiplier;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const cx = width / 2;
      const cy = height / 2;

      let x = cx;
      let y = cy;

      if (stage === 'linear') {
        const amplitude = width * 0.35;
        x = cx + Math.sin(t * 0.8) * amplitude;
        y = cy + Math.sin(t * 0.2) * (height * 0.15);
      } else if (stage === 'sinusoidal') {
        x = cx + Math.sin(t * 0.7) * (width * 0.35);
        y = cy + Math.sin(t * 1.4) * (height * 0.25);
      } else {
        // Figure-8 (Lissajous)
        x = cx + Math.sin(t * 0.6) * (width * 0.32);
        y = cy + Math.sin(t * 1.2) * (height * 0.26);
      }

      targetPosRef.current = { x, y };
      setTargetDisplay({ x, y });

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [stage, speedMultiplier]);

  // Evaluate gaze relative to butterfly target
  useEffect(() => {
    if (!currentGaze || !currentGaze.isValid) return;

    sampleCountRef.current += 1;
    if (interactionMode === 'GAZE') {
      gazeHistoryRef.current.push(currentGaze);
      const target = targetPosRef.current;
      butterflyTraceRef.current.push({
        timestamp: currentGaze.timestamp, targetX: target.x, targetY: target.y,
        gazeX: currentGaze.x, gazeY: currentGaze.y, confidence: currentGaze.confidence,
      });
      if (butterflyTraceRef.current.length > 1800) butterflyTraceRef.current.shift();
    }
    const { x, y } = targetPosRef.current;
    const isNearTarget = gazePipeline.isGazeInAOI(currentGaze.x, currentGaze.y, x, y, targetRadius);
    const dist = Math.hypot(currentGaze.x - x, currentGaze.y - y);
    errorHistoryRef.current.push(dist);

    // If child is smoothly tracking within tolerant target radius
    if (isNearTarget) {
      nearTargetSamplesRef.current += 1;
      if (Math.random() < 0.25 && !sensorySafe) {
        soundService.playStarChime(1.1);
        setSparkles((prev) => [
          ...prev.slice(-8),
          { id: Date.now() + Math.random(), x: targetPosRef.current.x, y: targetPosRef.current.y },
        ]);
      }
    }
  }, [currentGaze, interactionMode, targetRadius, sensorySafe]);

  // Give a child who is following the butterfly more time to continue.
  useEffect(() => {
    const completeTrial = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      const now = Date.now();
      const errors = errorHistoryRef.current;
      const meanError = errors.length > 0 ? errors.reduce((a, b) => a + b, 0) / errors.length : null;
      const gazeFollowPercent = interactionMode === 'GAZE' && sampleCountRef.current > 0
        ? Math.round((nearTargetSamplesRef.current / sampleCountRef.current) * 100)
        : null;

      const trialMetric: TrialMetric = {
        gameId: 'BUTTERFLY',
        trialNumber: trialNoRef.current,
        startTime: startTimeRef.current,
        endTime: now,
        durationMs: now - startTimeRef.current,
        success: sampleCountRef.current > 0 &&
          nearTargetSamplesRef.current / sampleCountRef.current >= 0.2,
        timeToFirstFixationMs: null,
        dwellTimeMs: null,
        targetHitCount: nearTargetSamplesRef.current,
        distractorFixationCount: null,
        pursuitGain: null,
        pursuitLagMs: null,
        pursuitRmsErrorPx: meanError,
        gazeFollowPercent,
        avgEngagement: gazeFollowPercent === null ? null : gazeFollowPercent / 100,
        gazePoints: [...gazeHistoryRef.current],
        butterflyTrace: [...butterflyTraceRef.current],
      };

      onTrialComplete(trialMetric);
      trialNoRef.current += 1;

    };

    let extensionTimer: number | null = null;
    const initialTimer = window.setTimeout(() => {
      const followPercent = sampleCountRef.current > 0
        ? nearTargetSamplesRef.current / sampleCountRef.current
        : 0;
      if (followPercent >= 0.2) {
        extensionTimer = window.setTimeout(completeTrial, 15_000);
      } else {
        completeTrial();
      }
    }, 30_000);

    return () => {
      window.clearTimeout(initialTimer);
      if (extensionTimer !== null) window.clearTimeout(extensionTimer);
    };
  }, [interactionMode, onTrialComplete]);

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      {/* Sparkles Trail */}
      {sparkles.map((sp) => (
        <div
          key={sp.id}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-ping text-xl text-amber-300 opacity-75"
          style={{ left: sp.x, top: sp.y }}
        >
          ✨
        </div>
      ))}

      {/* Butterfly Target */}
      <div
        onPointerDown={() => {
          soundService.playStarChime(1.1);
        }}
        className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 ease-out cursor-pointer hover:scale-110 active:scale-95"
        style={{
          left: `${targetDisplay.x}px`,
          top: `${targetDisplay.y}px`,
          width: `${targetRadius * 2}px`,
          height: `${targetRadius * 2}px`,
        }}
      >
        {/* Soft target glow */}
        <div className="absolute inset-0 rounded-full bg-violet-400/20 blur-md animate-pulse" />

        {/* Butterfly SVG */}
        <svg viewBox="0 0 100 100" className="h-full w-full filter drop-shadow-md">
          {/* Top Wings */}
          <path
            d="M 50 48 C 25 15, 5 35, 20 60 C 35 75, 48 55, 50 50 Z"
            fill="#C084FC"
            opacity="0.9"
            stroke="#A855F7"
            strokeWidth="1.5"
          />
          <path
            d="M 50 48 C 75 15, 95 35, 80 60 C 65 75, 52 55, 50 50 Z"
            fill="#C084FC"
            opacity="0.9"
            stroke="#A855F7"
            strokeWidth="1.5"
          />

          {/* Lower Wings */}
          <path d="M 50 52 C 30 55, 22 75, 35 85 C 45 92, 48 65, 50 56 Z" fill="#93C5FD" opacity="0.85" />
          <path d="M 50 52 C 70 55, 78 75, 65 85 C 55 92, 52 65, 50 56 Z" fill="#93C5FD" opacity="0.85" />

          {/* Body */}
          <ellipse cx="50" cy="54" rx="4" ry="18" fill="#4C1D95" />
          <circle cx="50" cy="34" r="5" fill="#4C1D95" />

          {/* Antennae with stars */}
          <path d="M 49 32 Q 44 22 40 24" fill="none" stroke="#4C1D95" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 51 32 Q 56 22 60 24" fill="none" stroke="#4C1D95" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="40" cy="24" r="2" fill="#FDE047" />
          <circle cx="60" cy="24" r="2" fill="#FDE047" />

          {/* Soft Friendly Eyes */}
          <circle cx="48" cy="33" r="1.2" fill="#FFFFFF" />
          <circle cx="52" cy="33" r="1.2" fill="#FFFFFF" />
        </svg>
      </div>
    </div>
  );
};
