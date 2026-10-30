import React, { useEffect, useState } from 'react';
import { PandaMascot } from '../mascot/PandaMascot';
import { soundService } from '../../services/soundEffects';
import { voiceGuidance, STANDARD_VOICE_STEPS } from '../../services/voiceGuidanceService';

interface RestScreenOverlayProps {
  reason: 'SESSION_TIMEOUT' | 'CAREGIVER_PAUSE';
  onContinue: () => void;
  onRecalibrate: () => void;
  onEndSession: () => void;
  restDurationSec?: number;
  voiceEnabled?: boolean;
  allowRecalibration?: boolean;
}

export const RestScreenOverlay: React.FC<RestScreenOverlayProps> = ({
  reason,
  onContinue,
  onRecalibrate,
  onEndSession,
  restDurationSec = 15,
  voiceEnabled = true,
  allowRecalibration = false,
}) => {
  const [countdown, setCountdown] = useState(restDurationSec);
  const [breathePhase, setBreathePhase] = useState<'breathe_in' | 'breathe_out'>('breathe_in');

  useEffect(() => {
    soundService.startRestAmbient();
    if (voiceEnabled) {
      voiceGuidance.speak(
        'Let’s take a little break. Relax and take a slow breath. You can play again when you are ready.'
      );
    }

    const breatheInterval = setInterval(() => {
      setBreathePhase((prev) => (prev === 'breathe_in' ? 'breathe_out' : 'breathe_in'));
    }, 4000);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      voiceGuidance.stop();
      clearInterval(breatheInterval);
      clearInterval(timer);
      soundService.stopRestAmbient();
    };
  }, [voiceEnabled]);

  const titleText = reason === 'SESSION_TIMEOUT' ? 'Great Play Today! Rest Time' : 'Session Paused';
  const subtitleText =
    reason === 'SESSION_TIMEOUT'
      ? 'Your planned play time is complete. Take a gentle break.'
      : 'A caregiver paused the session. Resume whenever you are ready.';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-emerald-950/85 p-6 backdrop-blur-md transition-opacity duration-700">
      <div className="flex max-w-lg flex-col items-center text-center">
        {/* Soft breathing bubble animation */}
        <div className="relative mb-6 flex h-48 w-48 items-center justify-center">
          <div
            className={`absolute rounded-full bg-emerald-400/20 transition-all duration-[4000ms] ease-in-out ${
              breathePhase === 'breathe_in' ? 'h-44 w-44 scale-125 bg-emerald-300/30' : 'h-28 w-28 scale-100'
            }`}
          />
          <div
            className={`absolute rounded-full border border-emerald-300/40 transition-all duration-[4000ms] ease-in-out ${
              breathePhase === 'breathe_in' ? 'h-36 w-36 scale-110' : 'h-24 w-24 scale-95'
            }`}
          />
          <PandaMascot expression="happy" size="md" />
        </div>

        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-300">
          {breathePhase === 'breathe_in' ? 'Breathe in slowly...' : 'Breathe out gently...'}
        </p>

        <h2 className="mb-2 text-2xl font-bold text-white font-['Quicksand']">{titleText}</h2>
        <p className="mb-6 text-sm text-emerald-100/90 leading-relaxed max-w-sm">{subtitleText}</p>

        {/* Caregiver Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => {
              soundService.stopRestAmbient();
              onContinue();
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-400 transition-colors cursor-pointer"
          >
            <span>Resume Play</span>
            {countdown > 0 && <span className="opacity-75">({countdown}s)</span>}
          </button>

          {allowRecalibration && (
            <button
              onClick={() => {
                soundService.stopRestAmbient();
                onRecalibrate();
              }}
              className="rounded-xl border border-emerald-400/30 bg-emerald-900/60 px-4 py-2.5 text-sm font-medium text-emerald-100 hover:bg-emerald-800/80 transition-colors cursor-pointer"
            >
              Recalibrate (R)
            </button>
          )}

          <button
            onClick={() => {
              soundService.stopRestAmbient();
              onEndSession();
            }}
            className="rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            End Session (Esc)
          </button>
        </div>

        <p className="mt-8 text-xs text-emerald-300/60">
          Caregiver Hotkeys: [P] Pause · {allowRecalibration && '[R] Recalibrate · '}[S] Settings · [Esc] Finish
        </p>
      </div>
    </div>
  );
};
