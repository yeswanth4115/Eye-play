import React, { useState, useEffect } from 'react';
import { PandaMascot } from '../mascot/PandaMascot';
import { soundService } from '../../services/soundEffects';
import { voiceGuidance, STANDARD_VOICE_STEPS } from '../../services/voiceGuidanceService';
import { ChildSessionFeedback, SessionSummary } from '../../types';

interface SessionCompletionScreenProps {
  sessionSummary: SessionSummary;
  onSaveFeedbackAndOpenReport: (feedback: ChildSessionFeedback) => void;
  onReturnHome: () => void;
  onNewSession: () => void;
}

export const SessionCompletionScreen: React.FC<SessionCompletionScreenProps> = ({
  sessionSummary,
  onSaveFeedbackAndOpenReport,
  onReturnHome,
  onNewSession,
}) => {
  const [selectedFeeling, setSelectedFeeling] = useState<ChildSessionFeedback['feeling']>('happy');
  const [comments, setComments] = useState('');
  const [revealStage, setRevealStage] = useState(0);

  useEffect(() => {
    soundService.playSuccessSparkle();
    voiceGuidance.speak(STANDARD_VOICE_STEPS.CONFIRM_COMPLETE);
    const timers = [
      window.setTimeout(() => setRevealStage(1), 900),
      window.setTimeout(() => setRevealStage(2), 1900),
      window.setTimeout(() => setRevealStage(3), 3000),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, []);

  const feelings: { id: ChildSessionFeedback['feeling']; emoji: string; label: string }[] = [
    { id: 'loved_it', emoji: '🌟', label: 'Loved It!' },
    { id: 'happy', emoji: '😊', label: 'Happy' },
    { id: 'tired', emoji: '😴', label: 'A Bit Tired' },
    { id: 'confused', emoji: '🤔', label: 'Confused' },
    { id: 'stop_now', emoji: '🌿', label: 'Rest Time' },
  ];

  const handleFinish = () => {
    const feedback: ChildSessionFeedback = {
      feeling: selectedFeeling,
      starsEarned: sessionSummary.trials?.length || 0,
      childComments: comments.trim() || undefined,
    };
    onSaveFeedbackAndOpenReport(feedback);
  };

  return (
    <div className="relative z-10 flex h-full w-full flex-col items-center justify-center p-4 sm:p-6 text-center select-none overflow-y-auto">
      <div className="w-full max-w-xl rounded-3xl bg-white/95 p-6 sm:p-8 shadow-2xl backdrop-blur-md border border-emerald-100 flex flex-col items-center my-auto">
        <PandaMascot
          expression="celebrating"
          speechText={`Terrific play, ${sessionSummary.childProfile.pseudonym}! Bao is so proud of you!`}
          size="lg"
        />

        <h1 className="mt-4 text-3xl font-extrabold text-emerald-950 font-['Quicksand'] tracking-tight">
          You Did It! 🎉
        </h1>
        <p className="mt-1 text-sm text-slate-600 max-w-md">
          You explored the meadow with Bao for{' '}
          <strong className="text-emerald-800">{sessionSummary.durationSeconds < 60 ? 'less than a minute' : `${Math.round(sessionSummary.durationSeconds / 60)} ${Math.round(sessionSummary.durationSeconds / 60) === 1 ? 'minute' : 'minutes'}`}</strong>.
        </p>

        {/* Stars summary */}
        <div className={`my-4 flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-6 py-2.5 border border-amber-200 transition-all duration-1000 ${revealStage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <span className="text-2xl">⭐</span>
          <span className="text-sm font-extrabold text-amber-950">
            {sessionSummary.trials?.length || 0} Game Rounds Completed!
          </span>
        </div>

        <div className={`w-full grid grid-cols-1 sm:grid-cols-2 gap-3 my-2 text-left transition-all duration-1000 ${revealStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">What you did</p>
            <p className="mt-1 text-sm font-semibold text-emerald-950">You finished {sessionSummary.trials?.length || 0} game rounds. Thanks for practising with Bao!</p>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-sky-800">A note for grown-ups</p>
            <p className="mt-1 text-xs text-sky-950">Game results describe this play session. They do not diagnose or measure overall development.</p>
          </div>
        </div>

        {/* Child Feedback Feeling Selector */}
        <div className={`w-full my-3 text-left transition-all duration-1000 ${revealStage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <label className="block text-xs font-bold text-slate-700 mb-2 text-center">
            How did you feel during today&apos;s play?
          </label>
          <div className="grid grid-cols-5 gap-2">
            {feelings.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setSelectedFeeling(f.id);
                  soundService.playStarChime(1.1);
                }}
                className={`flex flex-col items-center p-2.5 rounded-2xl border transition-all cursor-pointer ${
                  selectedFeeling === f.id
                    ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="text-2xl">{f.emoji}</span>
                <span className="text-[11px] font-bold text-slate-800 mt-1">{f.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-3">
            <input
              type="text"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Anything special Bao should know? (Optional notes)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
          <button
            type="button"
            onClick={handleFinish}
            disabled={revealStage < 3}
            className="w-full sm:flex-1 rounded-2xl bg-emerald-600 py-3.5 px-5 text-sm font-extrabold text-white shadow-md hover:bg-emerald-500 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Show Grown-up Results 📊
          </button>

          <button
            type="button"
            onClick={onNewSession}
            disabled={revealStage < 3}
            className="w-full sm:w-auto rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Play Again ✨
          </button>

          <button
            type="button"
            onClick={onReturnHome}
            disabled={revealStage < 3}
            className="w-full sm:w-auto rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Home 🏠
          </button>
        </div>
      </div>
    </div>
  );
};
