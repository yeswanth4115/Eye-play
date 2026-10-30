import React, { useState, useEffect, useRef } from 'react';
import { GazePoint, TrialMetric, AOIRegion } from '../../types';
import { soundService } from '../../services/soundEffects';
import { gazePipeline } from '../../services/gazePipeline';

interface SpotItGameProps {
  currentGaze: GazePoint | null;
  onTrialComplete: (metric: TrialMetric) => void;
  onUpdateAOIs: (aois: AOIRegion[]) => void;
  dwellTimeMs?: number;
}

interface Balloon {
  id: string;
  x: number;
  y: number;
  isTarget: boolean;
  color: string;
  emoji: string;
  label: string;
  popped: boolean;
}

export const SpotItGame: React.FC<SpotItGameProps> = ({
  currentGaze,
  onTrialComplete,
  onUpdateAOIs,
  dwellTimeMs = 500, // 400-800 ms adaptive dwell time
}) => {
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [targetBalloon, setTargetBalloon] = useState<Balloon | null>(null);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [score, setScore] = useState(0);

  const trialStartTimeRef = useRef(Date.now());
  const trialNoRef = useRef(1);
  const firstFixationTimeRef = useRef<number | null>(null);
  const distractorLooksRef = useRef(0);
  const dwellAccumulatorRef = useRef(0);
  const lastCheckTimeRef = useRef(Date.now());
  const gazePointsRef = useRef<GazePoint[]>([]);

  // Spawn new balloon trial layout
  const spawnTrial = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const padding = 120;

    const balloonTypes = [
      { emoji: '🐰', label: 'Smiling Bunny', color: 'from-pink-300 to-rose-200' },
      { emoji: '🐶', label: 'Playful Puppy', color: 'from-emerald-300 to-teal-200' },
      { emoji: '🐻', label: 'Cozy Bear', color: 'from-amber-300 to-yellow-200' },
      { emoji: '🐱', label: 'Gentle Kitty', color: 'from-sky-300 to-blue-200' },
      { emoji: '⭐', label: 'Shining Star', color: 'from-amber-200 to-orange-200' },
      { emoji: '🌸', label: 'Spring Flower', color: 'from-purple-300 to-pink-200' },
    ];

    const count = 5;
    const generated: Balloon[] = [];
    const minDistance = 160;

    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      let safe = false;
      let attempts = 0;

      while (!safe && attempts < 100) {
        attempts++;
        x = padding + Math.random() * (width - padding * 2);
        y = padding + Math.random() * (height - padding * 2.2);

        safe = generated.every((b) => Math.hypot(b.x - x, b.y - y) > minDistance);
      }

      const type = balloonTypes[i % balloonTypes.length];
      generated.push({
        id: `balloon_${i}`,
        x,
        y,
        isTarget: false,
        color: type.color,
        emoji: type.emoji,
        label: type.label,
        popped: false,
      });
    }

    // Pick 1 as target (e.g. smiling bunny)
    const targetIdx = Math.floor(Math.random() * generated.length);
    generated[targetIdx].isTarget = true;
    generated[targetIdx].emoji = '🐰';
    generated[targetIdx].label = 'Smiling Bunny';
    generated[targetIdx].color = 'from-pink-300 to-rose-300';

    setBalloons(generated);
    setTargetBalloon(generated[targetIdx]);
    setDwellProgress(0);

    trialStartTimeRef.current = Date.now();
    firstFixationTimeRef.current = null;
    distractorLooksRef.current = 0;
    dwellAccumulatorRef.current = 0;
    gazePointsRef.current = [];

    // Notify AOI regions to Engagement calculator
    const aois: AOIRegion[] = generated.map((b) => ({
      id: b.id,
      label: b.label,
      type: b.isTarget ? 'TARGET' : 'DISTRACTOR',
      x: b.x,
      y: b.y,
      radius: 65,
    }));
    onUpdateAOIs(aois);
  };

  useEffect(() => {
    spawnTrial();
  }, []);

  // Check gaze collisions with balloons
  useEffect(() => {
    if (!currentGaze || !currentGaze.isValid || !targetBalloon) return;

    gazePointsRef.current.push(currentGaze);
    const now = Date.now();
    const dt = now - lastCheckTimeRef.current;
    lastCheckTimeRef.current = now;

    // Check hit against target balloon
    const targetHit = gazePipeline.isGazeInAOI(
      currentGaze.x,
      currentGaze.y,
      targetBalloon.x,
      targetBalloon.y,
      65
    );

    if (targetHit) {
      if (firstFixationTimeRef.current === null) {
        firstFixationTimeRef.current = now - trialStartTimeRef.current;
      }
      dwellAccumulatorRef.current += dt;
      const progress = Math.min(100, Math.round((dwellAccumulatorRef.current / dwellTimeMs) * 100));
      setDwellProgress(progress);

      // Successfully popped with sustained gaze dwell!
      if (dwellAccumulatorRef.current >= dwellTimeMs) {
        soundService.playGentlePop();
        soundService.playStarChime(1.2);
        setScore((prev) => prev + 1);

        // Record trial metric
        const trialMetric: TrialMetric = {
          gameId: 'SPOT_IT',
          trialNumber: trialNoRef.current,
          startTime: trialStartTimeRef.current,
          endTime: now,
          durationMs: now - trialStartTimeRef.current,
          success: true,
          timeToFirstFixationMs: null,
          dwellTimeMs: dwellAccumulatorRef.current,
          targetHitCount: 1,
          distractorFixationCount: distractorLooksRef.current,
          avgEngagement: null,
          gazePoints: [...gazePointsRef.current],
        };

        onTrialComplete(trialMetric);
        trialNoRef.current += 1;

        // Briefly mark popped, then spawn next trial
        setBalloons((prev) => prev.map((b) => (b.id === targetBalloon.id ? { ...b, popped: true } : b)));

        setTimeout(() => {
          spawnTrial();
        }, 600);
      }
    } else {
      // Decay dwell if looking away to avoid accidental midas-touch triggers
      dwellAccumulatorRef.current = Math.max(0, dwellAccumulatorRef.current - dt * 0.8);
      setDwellProgress(Math.round((dwellAccumulatorRef.current / dwellTimeMs) * 100));

      // Check if looking at a distractor balloon
      const distractorHit = balloons.some(
        (b) =>
          !b.isTarget &&
          !b.popped &&
          gazePipeline.isGazeInAOI(currentGaze.x, currentGaze.y, b.x, b.y, 65)
      );
      if (distractorHit) {
        distractorLooksRef.current += 1;
      }
    }
  }, [currentGaze, targetBalloon, dwellTimeMs, balloons, onTrialComplete]);

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      {/* Top Instruction Banner */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-2xl bg-white/90 px-6 py-2.5 shadow-md backdrop-blur-md border border-emerald-100">
        <span className="text-2xl">🐰</span>
        <div>
          <h2 className="text-sm font-bold text-slate-800 font-['Quicksand']">Look at the Smiling Bunny Balloon!</h2>
          <p className="text-xs text-slate-500">Hold your eyes on the bunny to gently pop it.</p>
        </div>
        <div className="ml-4 flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
          <span>⭐</span>
          <span className="tabular-nums">{score}</span>
        </div>
      </div>

      {/* Balloons field */}
      {balloons.map((balloon) => {
        if (balloon.popped) {
          return (
            <div
              key={balloon.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-3xl animate-ping"
              style={{ left: balloon.x, top: balloon.y }}
            >
              ✨
            </div>
          );
        }

        const isTarget = balloon.isTarget;

        return (
          <div
            key={balloon.id}
            onClick={() => {
              if (isTarget) {
                dwellAccumulatorRef.current = dwellTimeMs;
                setDwellProgress(100);
              } else {
                distractorLooksRef.current += 1;
                soundService.playGentlePop();
              }
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-300 cursor-pointer"
            style={{ left: balloon.x, top: balloon.y }}
          >
            {/* Balloon Body with dwell progress ring if targeted */}
            <div className="relative flex h-24 w-20 items-center justify-center">
              {isTarget && dwellProgress > 0 && (
                <svg className="absolute -inset-2.5 h-28 w-28 -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="44"
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="5"
                    strokeDasharray="276.4"
                    strokeDashoffset={276.4 - (276.4 * dwellProgress) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-75"
                  />
                </svg>
              )}

              <div
                className={`relative flex h-full w-full items-center justify-center rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-gradient-to-b ${balloon.color} shadow-lg transition-transform duration-200 hover:scale-105`}
              >
                {/* Highlight gleam */}
                <div className="absolute top-3 left-3 h-5 w-3.5 rounded-full bg-white/60 -rotate-45" />

                <span className="text-3xl filter drop-shadow-sm select-none">{balloon.emoji}</span>
              </div>
            </div>

            {/* Balloon string */}
            <div className="h-6 w-0.5 bg-slate-400/60" />
          </div>
        );
      })}
    </div>
  );
};
