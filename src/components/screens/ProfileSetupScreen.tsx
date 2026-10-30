import React from 'react';
import { ChildProfile, GameId, InteractionMode } from '../../types';
import { PandaMascot } from '../mascot/PandaMascot';
import { voiceGuidance } from '../../services/voiceGuidanceService';
import { soundService } from '../../services/soundEffects';

interface ProfileSetupScreenProps {
  profile: ChildProfile;
  onUpdateProfile: (profile: ChildProfile) => void;
  selectedFirstGame: GameId;
  onSelectFirstGame: (game: GameId) => void;
  onProceed: () => void;
  onBack: () => void;
  interactionMode: InteractionMode;
}

export const ProfileSetupScreen: React.FC<ProfileSetupScreenProps> = ({
  profile,
  onUpdateProfile,
  selectedFirstGame,
  onSelectFirstGame,
  onProceed,
  onBack,
  interactionMode,
}) => {
  const games: { id: GameId; emoji: string; title: string; detail: string }[] = [
    { id: 'BUTTERFLY', emoji: '🦋', title: 'Follow Butterfly', detail: 'Smooth pursuit & trajectory' },
    { id: 'SPOT_IT', emoji: '🎈', title: 'Spot It Balloons', detail: 'Visual search & target acquisition' },
    { id: 'LOOK_HERE', emoji: '🐻', title: 'Look Together', detail: 'Joint attention & face dwell' },
    { id: 'MAZE', emoji: '🍓', title: 'Picnic Berry Trail', detail: 'Continuous gaze steering' },
    { id: 'LISTEN_DO', emoji: '🎵', title: 'Listen & Do', detail: 'Spoken multi-modal prompts' },
  ];

  const handleNext = () => {
    if (!profile.pseudonym.trim()) return;
    soundService.playStarChime(1.15);
    onProceed();
  };

  return (
    <div className="relative z-10 flex h-full w-full flex-col items-center justify-center p-4 sm:p-6 text-center select-none overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white/95 p-6 sm:p-8 shadow-xl backdrop-blur-md border border-emerald-100 flex flex-col items-center my-auto text-left">
        {/* Header */}
        <div className="flex items-center justify-between w-full border-b border-emerald-100 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-xl font-bold text-emerald-800">
              🐼
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-emerald-950 font-['Quicksand']">Session Setup</h2>
              <p className="text-xs text-slate-500">Configure participant pseudonym and viewing geometry</p>
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

        {/* Mascot Hint */}
        <div className="flex items-center gap-4 bg-emerald-50/60 p-3 rounded-2xl border border-emerald-100 mb-5 w-full">
          <PandaMascot expression="happy" size="sm" />
          <div className="text-xs text-emerald-950">
            <p className="font-bold">Bao wants to know who is playing today!</p>
            <p className="text-slate-600">Use a non-identifying nickname or participant code. Do not enter a full name.</p>
          </div>
        </div>

        {/* Profile Inputs */}
        <div className="space-y-4 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pseudonym-input" className="block text-xs font-bold text-slate-700 mb-1">
                Participant Pseudonym / Nickname
              </label>
              <input
                id="pseudonym-input"
                type="text"
                value={profile.pseudonym}
                aria-describedby="pseudonym-help"
                onChange={(e) => onUpdateProfile({ ...profile, pseudonym: e.target.value })}
                placeholder="Required participant code"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-100 outline-none"
              />
              <p id="pseudonym-help" className="mt-1 text-[11px] text-slate-500">
                {profile.pseudonym.trim() ? 'Do not use identifying information.' : 'Enter a non-identifying code to continue.'}
              </p>
            </div>
            <div>
              <label htmlFor="age-input" className="block text-xs font-bold text-slate-700 mb-1">
                Chronological Age (Years)
              </label>
              <input
                id="age-input"
                type="number"
                min="3"
                max="18"
                value={profile.ageYears}
                onChange={(e) => onUpdateProfile({ ...profile, ageYears: Number(e.target.value) || 6 })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-100 outline-none"
              />
            </div>
          </div>

          {/* Viewing Geometry (Affects deg visual angle calculations) */}
          <div className="rounded-2xl bg-slate-50/80 p-3.5 border border-slate-200">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
              Viewing Geometry & Distance (for Angle of Visual Regard)
            </span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Distance (cm)</label>
                <input
                  type="number"
                  min="30"
                  max="100"
                  value={profile.viewingDistanceCm}
                  onChange={(e) => onUpdateProfile({ ...profile, viewingDistanceCm: Number(e.target.value) || 50 })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Screen W (cm)</label>
                <input
                  type="number"
                  min="20"
                  max="120"
                  value={profile.screenWidthCm}
                  onChange={(e) => onUpdateProfile({ ...profile, screenWidthCm: Number(e.target.value) || 34 })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Screen H (cm)</label>
                <input
                  type="number"
                  min="15"
                  max="80"
                  value={profile.screenHeightCm}
                  onChange={(e) => onUpdateProfile({ ...profile, screenHeightCm: Number(e.target.value) || 21 })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Sensory Comfort Options */}
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.sensorySafe}
                onChange={(e) => onUpdateProfile({ ...profile, sensorySafe: e.target.checked })}
                className="h-4 w-4 rounded-md accent-emerald-600"
              />
              <span>Sensory-safe mode (gentle chimes, reduced visual sparkle)</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.audioConsent}
                onChange={(e) => onUpdateProfile({ ...profile, audioConsent: e.target.checked })}
                className="h-4 w-4 rounded-md accent-emerald-600"
              />
              <span>Spoken voice guidance enabled</span>
            </label>
          </div>

          {/* First Activity Pick */}
          <div className="pt-2">
            <span className="block text-xs font-bold text-slate-800 mb-2">First Activity in Session Sequence:</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {games.map((game) => (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => onSelectFirstGame(game.id)}
                  className={`rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                    selectedFirstGame === game.id
                      ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-200'
                      : 'border-slate-200 bg-white hover:border-emerald-300'
                  }`}
                >
                  <span className="text-xl block">{game.emoji}</span>
                  <span className="text-xs font-bold text-emerald-950 block mt-1">{game.title}</span>
                  <span className="text-[10px] text-slate-500 block leading-tight">{game.detail}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex items-center justify-between w-full pt-4 border-t border-slate-100">
          <span className="text-xs text-slate-500 font-medium">
            Mode: <strong className="text-emerald-700">{interactionMode === 'GAZE' ? 'Camera Eye Gaze' : 'Touch (Accessible)'}</strong>
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={!profile.pseudonym.trim()}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-extrabold text-white shadow-md hover:bg-emerald-500 transition-all enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>{interactionMode === 'GAZE' ? 'Check Camera Readiness →' : 'Start Play Session →'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
