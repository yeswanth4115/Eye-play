import React, { useState, useEffect, useRef } from 'react';
import { GazePoint, TrialMetric, AOIRegion } from '../../types';
import { PandaMascot } from '../mascot/PandaMascot';
import { voiceGuidance } from '../../services/voiceGuidanceService';
import { VOICE_PROMPTS, VoicePrompt } from '../../services/speechService';
import { soundService } from '../../services/soundEffects';
import { gazePipeline } from '../../services/gazePipeline';

interface ListenDoGameProps {
  currentGaze: GazePoint | null;
  onTrialComplete: (metric: TrialMetric) => void;
  onUpdateAOIs: (aois: AOIRegion[]) => void;
  language?: 'en' | 'ta';
  audioConsent?: boolean;
}

export const ListenDoGame: React.FC<ListenDoGameProps> = ({
  currentGaze,
  onTrialComplete,
  onUpdateAOIs,
  language = 'en',
  audioConsent = true,
}) => {
  const [promptIndex, setPromptIndex] = useState(0);
  const [promptState, setPromptState] = useState<'SPEAKING' | 'LISTENING' | 'SUCCESS'>('SPEAKING');
  const [repeatCount, setRepeatCount] = useState(0);

  const prompt = VOICE_PROMPTS[promptIndex % VOICE_PROMPTS.length];
  const startTimeRef = useRef(Date.now());
  const trialNoRef = useRef(1);
  const gazePointsRef = useRef<GazePoint[]>([]);

  // On-screen objects for visual listening commands
  const [targets, setTargets] = useState<{ id: string; emoji: string; label: string; x: number; y: number }[]>([]);

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const items = [
      { id: 'flower_red', emoji: '🌺', label: 'Red Flower', x: width * 0.25, y: height * 0.4 },
      { id: 'dog_balloon', emoji: '🐶', label: 'Puppy Balloon', x: width * 0.75, y: height * 0.4 },
      { id: 'bunny_balloon', emoji: '🐰', label: 'Bunny', x: width * 0.5, y: height * 0.75 },
    ];
    setTargets(items);

    const aois: AOIRegion[] = items.map((i) => ({
      id: i.id,
      label: i.label,
      type: 'TARGET',
      x: i.x,
      y: i.y,
      radius: 80,
    }));
    onUpdateAOIs(aois);
  }, [onUpdateAOIs]);

  // Deliver voice instruction using unified voiceGuidanceService
  const deliverPrompt = () => {
    setPromptState('SPEAKING');
    startTimeRef.current = Date.now();
    gazePointsRef.current = [];

    const instructionText = language === 'ta' ? prompt.textTa : prompt.textEn;
    voiceGuidance.speak(instructionText, {
      onEnd: () => setPromptState('LISTENING'),
      onError: () => setPromptState('LISTENING'),
    });
  };

  useEffect(() => {
    deliverPrompt();
    return () => {
      voiceGuidance.stop();
    };
  }, [promptIndex]);

  // Check gaze response for on-screen target
  useEffect(() => {
    if (!currentGaze || !currentGaze.isValid || promptState !== 'LISTENING') return;

    gazePointsRef.current.push(currentGaze);

    if (prompt.category === 'ON_SCREEN' && prompt.targetAoiId) {
      const match = targets.find((t) => t.id === prompt.targetAoiId);
      if (match) {
        if (gazePipeline.isGazeInAOI(currentGaze.x, currentGaze.y, match.x, match.y, 80)) {
          handleSuccess();
        }
      }
    }
  }, [currentGaze, prompt, promptState, targets]);

  const handleSuccess = () => {
    if (promptState === 'SUCCESS') return;

    setPromptState('SUCCESS');
    soundService.playStarChime(1.3);

    const now = Date.now();
    const latency = now - startTimeRef.current;

    const metric: TrialMetric = {
      gameId: 'LISTEN_DO',
      trialNumber: trialNoRef.current,
      startTime: startTimeRef.current,
      endTime: now,
      durationMs: latency,
      success: true,
      timeToFirstFixationMs: null,
      dwellTimeMs: null,
      targetHitCount: 1,
      distractorFixationCount: null,
      audioLatencyMs: null,
      audioAccuracy: null,
      promptRepeats: repeatCount,
      avgEngagement: null,
      gazePoints: [...gazePointsRef.current],
    };

    onTrialComplete(metric);
    trialNoRef.current += 1;

    setTimeout(() => {
      setRepeatCount(0);
      setPromptIndex((prev) => prev + 1);
    }, 1800);
  };

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      {/* Bao the Panda with the spoken instruction */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
        <PandaMascot
          expression={promptState === 'SUCCESS' ? 'celebrating' : 'happy'}
          speechText={language === 'ta' ? prompt.textTa : prompt.textEn}
          size="md"
        />

        {/* Replay voice button */}
        <button
          onClick={() => {
            setRepeatCount((r) => r + 1);
            deliverPrompt();
          }}
          className="mt-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-1 text-xs font-semibold text-emerald-800 shadow-sm hover:bg-white transition-colors cursor-pointer border border-emerald-200"
        >
          <span>🔊</span>
          <span>Hear Again</span>
        </button>
      </div>

      {/* On-screen Visual Targets */}
      {prompt.category === 'ON_SCREEN' &&
        targets.map((item) => {
          const isTarget = item.id === prompt.targetAoiId;
          return (
            <div
              key={item.id}
              onClick={() => {
                if (isTarget && promptState === 'LISTENING') {
                  handleSuccess();
                }
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-300 cursor-pointer"
              style={{ left: `${item.x}px`, top: `${item.y}px` }}
            >
              <div
                className={`flex h-24 w-24 items-center justify-center rounded-3xl bg-white/90 shadow-md border-2 transition-all ${
                  isTarget && promptState === 'SUCCESS'
                    ? 'border-amber-400 scale-110 bg-amber-50'
                    : 'border-emerald-200 hover:scale-105 active:scale-95'
                }`}
              >
                <span className="text-4xl">{item.emoji}</span>
              </div>
              <span className="mt-2 rounded-lg bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-slate-700 shadow-2xs">
                {item.label}
              </span>
            </div>
          );
        })}

      {/* Action / Real-World Toy Caregiver Confirmation */}
      {(prompt.category === 'ACTION' || prompt.category === 'REAL_WORLD_TOY') && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center rounded-3xl bg-white/95 p-6 shadow-xl border border-emerald-100 max-w-md text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
            {prompt.category === 'REAL_WORLD_TOY' ? 'Real-World Toy Prompt' : 'Child Action Prompt'}
          </p>
          <p className="mb-4 text-sm font-semibold text-slate-800 font-['Quicksand']">
            {language === 'ta' ? prompt.textTa : prompt.textEn}
          </p>
          <button
            onClick={handleSuccess}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-500 transition-colors cursor-pointer"
          >
            <span>Caregiver Confirmed Success</span>
            <span>✓</span>
          </button>
        </div>
      )}
    </div>
  );
};
