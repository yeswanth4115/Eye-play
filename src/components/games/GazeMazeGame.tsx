import React, { useState, useEffect, useRef } from 'react';
import { AOIRegion, GazePoint, TrialMetric } from '../../types';
import { PandaMascot } from '../mascot/PandaMascot';
import { soundService } from '../../services/soundEffects';

interface GazeMazeGameProps {
  currentGaze: GazePoint | null;
  onTrialComplete: (metric: TrialMetric) => void;
  onUpdateAOIs: (aois: AOIRegion[]) => void;
}

export const GazeMazeGame: React.FC<GazeMazeGameProps> = ({
  currentGaze,
  onTrialComplete,
  onUpdateAOIs,
}) => {
  const [berryPos, setBerryPos] = useState({ x: 250, y: 450 });
  const [basketPos, setBasketPos] = useState({ x: 1100, y: 450 });
  const [hasReached, setHasReached] = useState(false);
  const [speech, setSpeech] = useState('Look at the strawberry to say hello.');
  const [isAttached, setIsAttached] = useState(false);
  const [pathProgress, setPathProgress] = useState(0);
  const attachStartedAtRef = useRef<number | null>(null);
  const pathStartXRef = useRef(0);
  const pathEndXRef = useRef(0);
  const pathYRef = useRef(0);

  const startTimeRef = useRef(Date.now());
  const trialNoRef = useRef(1);
  const gazePointsRef = useRef<GazePoint[]>([]);

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const startX = width * 0.2;
    const endX = width * 0.82;
    const pathY = height * 0.55;
    pathStartXRef.current = startX;
    pathEndXRef.current = endX;
    pathYRef.current = pathY;
    setBerryPos({ x: startX, y: pathY });
    setBasketPos({ x: endX, y: pathY });
    setIsAttached(false);
    setPathProgress(0);
    attachStartedAtRef.current = null;
    onUpdateAOIs([
      {
        id: 'picnic_basket',
        label: 'Picnic basket',
        type: 'TARGET',
        x: endX,
        y: pathY,
        radius: 120,
      },
    ]);
    setHasReached(false);
    startTimeRef.current = Date.now();
    gazePointsRef.current = [];
  }, [onUpdateAOIs]);

  // The berry starts at the left marker. A steady look attaches it; after that it
  // advances only along the fixed horizontal meadow lane (never free-floats).
  useEffect(() => {
    if (!currentGaze || !currentGaze.isValid || hasReached) return;
    gazePointsRef.current.push(currentGaze);
    const now = currentGaze.timestamp || Date.now();
    const start = { x: pathStartXRef.current, y: pathYRef.current };
    if (!isAttached) {
      const nearStart = Math.hypot(currentGaze.x - start.x, currentGaze.y - start.y) <= 125;
      if (nearStart) {
        if (attachStartedAtRef.current === null) attachStartedAtRef.current = now;
        if (now - attachStartedAtRef.current >= 450) {
          setIsAttached(true);
          setSpeech('You found the strawberry! Follow the path to the basket.');
          soundService.playStarChime(1.05);
        }
      } else attachStartedAtRef.current = null;
      return;
    }
    // Only forward gaze along the lane moves the berry. Vertical eye movement is
    // intentionally ignored so the child sees a predictable, parallel path.
    const laneX = Math.max(pathStartXRef.current, Math.min(pathEndXRef.current, currentGaze.x));
    const nextProgress = Math.max(pathProgress, (laneX - pathStartXRef.current) / (pathEndXRef.current - pathStartXRef.current));
    setPathProgress(nextProgress);
    const x = pathStartXRef.current + nextProgress * (pathEndXRef.current - pathStartXRef.current);
    const y = pathYRef.current;
    setBerryPos({ x, y });

    if (Math.hypot(x - basketPos.x, y - basketPos.y) < 100) {
      setHasReached(true);
      soundService.playSuccessSparkle();
      setSpeech('Mmm delicious! Bao loves berries!');

      const now = Date.now();
      const metric: TrialMetric = {
        gameId: 'MAZE',
        trialNumber: trialNoRef.current,
        startTime: startTimeRef.current,
        endTime: now,
        durationMs: now - startTimeRef.current,
        success: true,
        timeToFirstFixationMs: null,
        dwellTimeMs: null,
        targetHitCount: 1,
        distractorFixationCount: null,
        avgEngagement: null,
        gazePoints: [...gazePointsRef.current],
      };

      onTrialComplete(metric);
      trialNoRef.current += 1;
    }
  }, [currentGaze, basketPos, hasReached, isAttached, pathProgress, onTrialComplete]);

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      {/* Top Banner */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-2xl bg-white/90 px-6 py-2.5 shadow-md backdrop-blur-md border border-emerald-100">
        <span className="text-2xl">🍓</span>
        <div>
          <h2 className="text-sm font-bold text-slate-800 font-['Quicksand']">Picnic Berry Trail</h2>
          <p className="text-xs text-slate-500">{isAttached ? 'Follow the straight path with your eyes.' : 'Look steadily at the strawberry to connect.'}</p>
        </div>
      </div>

      {/* Fixed straight meadow lane */}
      <svg className="absolute inset-0 h-full w-full pointer-events-none">
        <path
          d={`M ${pathStartXRef.current} ${pathYRef.current} L ${pathEndXRef.current} ${pathYRef.current}`}
          fill="none"
          stroke="#D1FAE5"
          strokeWidth="68"
          strokeLinecap="round"
          opacity="0.8"
        />
        <path
          d={`M ${pathStartXRef.current} ${pathYRef.current} L ${pathEndXRef.current} ${pathYRef.current}`}
          fill="none"
          stroke="#A7F3D0"
          strokeWidth="4"
          strokeDasharray="12,12"
          strokeLinecap="round"
        />
      </svg>

      {/* Fixed-path strawberry: it only moves after a steady gaze attaches it. */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 flex h-20 w-20 items-center justify-center rounded-full bg-rose-400/20 backdrop-blur-xs transition-[left,top] duration-500 ease-out shadow-lg"
        style={{ left: `${berryPos.x}px`, top: `${berryPos.y}px` }}
      >
        <span className="text-5xl filter drop-shadow">🍓</span>
        {!isAttached && <span className="absolute -bottom-7 whitespace-nowrap rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-rose-700 shadow">Look here to connect</span>}
      </div>

      {/* Bao the panda waits at the picnic basket */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
        style={{ left: `${basketPos.x}px`, top: `${basketPos.y}px` }}
      >
        <PandaMascot expression={hasReached ? 'celebrating' : 'happy'} speechText={speech} size="md" />
        <div className="mt-2 flex items-center gap-1 rounded-xl bg-amber-100/90 px-3 py-1 shadow-xs border border-amber-200">
          <span className="text-xl">🧺</span>
          <span className="text-xs font-bold text-amber-900">Picnic Basket</span>
        </div>
      </div>
    </div>
  );
};
