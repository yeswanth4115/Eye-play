import React, { useState, useEffect, useRef } from 'react';
import { GazePoint, TrialMetric, AOIRegion } from '../../types';
import { PandaMascot } from '../mascot/PandaMascot';
import { soundService } from '../../services/soundEffects';
import { gazePipeline } from '../../services/gazePipeline';

interface JointAttentionGameProps {
  currentGaze: GazePoint | null;
  onTrialComplete: (metric: TrialMetric) => void;
  onUpdateAOIs: (aois: AOIRegion[]) => void;
}

export const JointAttentionGame: React.FC<JointAttentionGameProps> = ({
  currentGaze,
  onTrialComplete,
  onUpdateAOIs,
}) => {
  const [mode, setMode] = useState<'JOINT_GAZE' | 'SOCIAL_PREFERENCE'>('JOINT_GAZE');
  const [lookDirection, setLookDirection] = useState<'looking_left' | 'looking_right'>('looking_right');
  const [targetFound, setTargetFound] = useState(false);
  const [speechText, setSpeechText] = useState('Look where Bao is looking!');

  // Social preference timers
  const [socialTimeMs, setSocialTimeMs] = useState(0);
  const [objectTimeMs, setObjectTimeMs] = useState(0);

  const trialStartTimeRef = useRef(Date.now());
  const trialNoRef = useRef(1);
  const gazePointsRef = useRef<GazePoint[]>([]);
  const firstFixationRef = useRef<number | null>(null);

  // Position setup
  const [positions, setPositions] = useState({
    mascotX: 720,
    mascotY: 420,
    targetX: 1100,
    targetY: 420,
    objectX: 340,
    objectY: 420,
  });

  const setupTrial = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const cx = width / 2;
    const cy = height / 2;

    const dir = Math.random() > 0.5 ? 'looking_right' : 'looking_left';
    setLookDirection(dir);
    setTargetFound(false);

    const targetX = dir === 'looking_right' ? cx + width * 0.3 : cx - width * 0.3;
    const targetY = cy;
    const objectX = dir === 'looking_right' ? cx - width * 0.3 : cx + width * 0.3;

    setPositions({
      mascotX: cx,
      mascotY: cy,
      targetX,
      targetY,
      objectX,
      objectY: cy,
    });

    trialStartTimeRef.current = Date.now();
    firstFixationRef.current = null;
    gazePointsRef.current = [];

    // Register AOIs
    const aois: AOIRegion[] = [
      { id: 'bao_face', label: 'Bao the Panda', type: 'FACE', x: cx, y: cy, radius: 90 },
      { id: 'target_meadow_friend', label: 'Meadow Friend', type: 'TARGET', x: targetX, y: targetY, radius: 75 },
      { id: 'distractor_object', label: 'Toy Train', type: 'OBJECT', x: objectX, y: targetY, radius: 75 },
    ];
    onUpdateAOIs(aois);
  };

  useEffect(() => {
    setupTrial();
  }, []);

  // Track child's gaze
  useEffect(() => {
    if (!currentGaze || !currentGaze.isValid) return;

    gazePointsRef.current.push(currentGaze);
    const now = Date.now();

    // Check hit on the target Bao is looking at
    const distBao = Math.hypot(currentGaze.x - positions.mascotX, currentGaze.y - positions.mascotY);
    const distObject = Math.hypot(currentGaze.x - positions.objectX, currentGaze.y - positions.objectY);

    if (distBao <= 90) {
      setSocialTimeMs((prev) => prev + 33);
    }
    if (distObject <= 75) {
      setObjectTimeMs((prev) => prev + 33);
    }

    if (gazePipeline.isGazeInAOI(currentGaze.x, currentGaze.y, positions.targetX, positions.targetY, 75) && !targetFound) {
      if (firstFixationRef.current === null) {
        firstFixationRef.current = now - trialStartTimeRef.current;
      }

      setTargetFound(true);
      soundService.playStarChime(1.3);
      setSpeechText('You found it! Great teamwork!');

      const metric: TrialMetric = {
        gameId: 'LOOK_HERE',
        trialNumber: trialNoRef.current,
        startTime: trialStartTimeRef.current,
        endTime: now,
        durationMs: now - trialStartTimeRef.current,
        success: true,
        timeToFirstFixationMs: null,
        dwellTimeMs: null,
        targetHitCount: 1,
        distractorFixationCount: null,
        socialLookingPercent: null,
        avgEngagement: null,
        gazePoints: [...gazePointsRef.current],
      };

      onTrialComplete(metric);
      trialNoRef.current += 1;

      setTimeout(() => {
        setSpeechText('Look where Bao is looking!');
        setupTrial();
      }, 1600);
    }
  }, [currentGaze, positions, targetFound, onTrialComplete, socialTimeMs, objectTimeMs]);

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      {/* Top Banner */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-2xl bg-white/90 px-6 py-2.5 shadow-md backdrop-blur-md border border-emerald-100">
        <span className="text-2xl">👀</span>
        <div>
          <h2 className="text-sm font-bold text-slate-800 font-['Quicksand']">Look Here, Look There!</h2>
          <p className="text-xs text-slate-500">Notice where Bao is looking and discover the friend.</p>
        </div>
      </div>

      {/* Bao the panda looks toward the target */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
        style={{ left: `${positions.mascotX}px`, top: `${positions.mascotY}px` }}
      >
        <PandaMascot expression={lookDirection} speechText={speechText} size="lg" />
      </div>

      {/* Target meadow friend where Bao is looking */}
      <div
        onClick={() => {
          if (!targetFound) {
            setTargetFound(true);
            soundService.playStarChime(1.3);
            setSpeechText('You found it! Great teamwork!');
            const now = Date.now();
            const metric: TrialMetric = {
              gameId: 'LOOK_HERE',
              trialNumber: trialNoRef.current,
              startTime: trialStartTimeRef.current,
              endTime: now,
              durationMs: now - trialStartTimeRef.current,
              success: true,
              timeToFirstFixationMs: null,
              dwellTimeMs: null,
              targetHitCount: 1,
              distractorFixationCount: null,
              socialLookingPercent: null,
              avgEngagement: null,
              gazePoints: [...gazePointsRef.current],
            };
            onTrialComplete(metric);
            trialNoRef.current += 1;
            setTimeout(() => {
              setSpeechText('Look where Bao is looking!');
              setupTrial();
            }, 1600);
          }
        }}
        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-500 cursor-pointer"
        style={{ left: `${positions.targetX}px`, top: `${positions.targetY}px` }}
      >
        <div
          className={`flex h-24 w-24 items-center justify-center rounded-3xl bg-amber-100/80 shadow-md border-2 border-amber-300 transition-all ${
            targetFound ? 'scale-125 bg-amber-200 border-amber-400' : 'hover:scale-105 active:scale-95'
          }`}
        >
          <span className="text-4xl">{targetFound ? '🌟' : '🐞'}</span>
        </div>
        <span className="mt-2 text-xs font-semibold text-emerald-900 bg-white/80 px-2 py-0.5 rounded-md shadow-xs">
          {targetFound ? 'Yay!' : 'Meadow Ladybug'}
        </span>
      </div>

      {/* Non-social toy object on opposite side */}
      <div
        onClick={() => {
          setObjectTimeMs((prev) => prev + 300);
          soundService.playGentlePop();
        }}
        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center opacity-85 transition-all duration-500 cursor-pointer"
        style={{ left: `${positions.objectX}px`, top: `${positions.objectY}px` }}
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-100 shadow-md border border-slate-200 hover:scale-105 active:scale-95">
          <span className="text-4xl">🚂</span>
        </div>
        <span className="mt-2 text-xs font-semibold text-slate-700 bg-white/80 px-2 py-0.5 rounded-md shadow-xs">
          Toy Train
        </span>
      </div>
    </div>
  );
};
