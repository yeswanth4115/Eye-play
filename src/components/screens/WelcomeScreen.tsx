import React, { useEffect } from 'react';
import { PandaMascot } from '../mascot/PandaMascot';
import { voiceGuidance, STANDARD_VOICE_STEPS } from '../../services/voiceGuidanceService';
import { soundService } from '../../services/soundEffects';
import { InteractionMode } from '../../types';

interface WelcomeScreenProps {
  onStartSession: () => void;
  onOpenDashboard: () => void;
  onOpenSettings: () => void;
  onOpenPrivacy: () => void;
  interactionMode: InteractionMode;
  onToggleInteractionMode: (mode: InteractionMode) => void;
  participantName: string;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStartSession,
  onOpenDashboard,
  onOpenSettings,
  onOpenPrivacy,
  interactionMode,
  onToggleInteractionMode,
  participantName,
}) => {
  useEffect(() => {
    voiceGuidance.speak(STANDARD_VOICE_STEPS.WELCOME);
  }, []);

  const handleStart = () => {
    soundService.playStarChime(1.1);
    onStartSession();
  };

  return (
    <div className="relative z-10 flex h-full w-full flex-col items-center justify-center p-4 sm:p-6 text-center select-none overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white/95 p-6 sm:p-8 shadow-xl backdrop-blur-md border border-emerald-100 flex flex-col items-center my-auto">
        <PandaMascot
          expression="happy"
          speechText={
            participantName
              ? `Hello ${participantName}! Welcome back to Eye-play!`
              : 'Hello friend! Welcome to Eye-play!'
          }
          size="lg"
          onClick={() => {
            soundService.playGentlePop();
            voiceGuidance.replayCurrent();
          }}
        />

        <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-emerald-950 font-['Quicksand'] tracking-tight">
          Eye-play
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-lg leading-relaxed">
          A gentle, sensory-friendly visual exploration space. Follow friendly butterflies, pop colorful balloons, and
          play with Bao the friendly panda!
        </p>

        {/* Mode Selector Pill: Camera Gaze vs Touch Accessible */}
        <div className="my-5 w-full max-w-md rounded-2xl bg-emerald-50/80 p-1.5 border border-emerald-200 flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggleInteractionMode('GAZE')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              interactionMode === 'GAZE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-900/80 hover:text-emerald-950 hover:bg-emerald-100/60'
            }`}
          >
            <span>👀</span>
            <span>Camera Eye Gaze</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleInteractionMode('TOUCH')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              interactionMode === 'TOUCH'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-900/80 hover:text-amber-950 hover:bg-amber-100/60'
            }`}
          >
            <span>👆</span>
            <span>Touch & Mouse (Accessible)</span>
          </button>
        </div>

        {/* Primary Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md">
          <button
            type="button"
            onClick={handleStart}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 px-6 text-base font-extrabold text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 hover:scale-102 active:scale-98 transition-all cursor-pointer focus:outline-hidden focus:ring-4 focus:ring-emerald-300"
          >
            <span>Let&apos;s Play Together!</span>
            <span className="text-xl">⭐</span>
          </button>

          <button
            type="button"
            onClick={onOpenDashboard}
            className="w-full sm:w-auto rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer focus:outline-hidden focus:ring-4 focus:ring-slate-200"
          >
            Adult Dashboard 📊
          </button>
        </div>

        {/* Quick Links Row */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-emerald-900">
          <button
            type="button"
            onClick={() => voiceGuidance.replayCurrent()}
            className="flex items-center gap-1.5 hover:underline cursor-pointer"
          >
            <span>🔊</span>
            <span>Hear Bao Again</span>
          </button>
          <span className="text-slate-300">·</span>
          <button type="button" onClick={onOpenSettings} className="hover:underline cursor-pointer">
            ⚙️ Settings & Comfort
          </button>
          <span className="text-slate-300">·</span>
          <button type="button" onClick={onOpenPrivacy} className="hover:underline cursor-pointer">
            🛡️ Privacy & Research Assent
          </button>
        </div>

        {/* Honest Scientific / Research Disclaimer */}
        <p className="mt-6 text-[11px] text-slate-400 max-w-md leading-normal">
          Research & play interaction tool · Uses on-device browser and local Python processing · Not a medical or
          diagnostic tool.
        </p>
      </div>
    </div>
  );
};
