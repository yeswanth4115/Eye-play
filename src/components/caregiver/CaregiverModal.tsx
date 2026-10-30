import React from 'react';
import { ChildProfile, CaregiverSettings } from '../../types';

interface CaregiverModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ChildProfile;
  settings: CaregiverSettings;
  onUpdateProfile: (profile: ChildProfile) => void;
  onUpdateSettings: (settings: CaregiverSettings) => void;
  onTriggerRecalibration: () => void;
}

export const CaregiverModal: React.FC<CaregiverModalProps> = ({
  isOpen,
  onClose,
  profile,
  settings,
  onUpdateProfile,
  onUpdateSettings,
  onTriggerRecalibration,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-['Quicksand']">Caregiver & Setup Controls</h2>
            <p className="text-xs text-slate-500">Hotkey [S] · Gaze accuracy calibration & comfort thresholds</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 text-xs">
          {/* Child Profile Section */}
          <section className="space-y-3">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Child Profile & Session Setup</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">Child ID / Pseudonym</label>
                <input
                  type="text"
                  value={profile.pseudonym}
                  onChange={(e) => onUpdateProfile({ ...profile, pseudonym: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
                  placeholder="e.g. Child-P104"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Age (Years)</label>
                <input
                  type="number"
                  min="3"
                  max="18"
                  value={profile.ageYears}
                  onChange={(e) => onUpdateProfile({ ...profile, ageYears: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">Viewing Distance (cm)</label>
                <input
                  type="number"
                  min="30"
                  max="100"
                  value={profile.viewingDistanceCm}
                  onChange={(e) => onUpdateProfile({ ...profile, viewingDistanceCm: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Screen Width (cm)</label>
                <input
                  type="number"
                  min="20"
                  max="120"
                  value={profile.screenWidthCm}
                  onChange={(e) => onUpdateProfile({ ...profile, screenWidthCm: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Screen Height (cm)</label>
                <input
                  type="number"
                  min="15"
                  max="80"
                  value={profile.screenHeightCm}
                  onChange={(e) => onUpdateProfile({ ...profile, screenHeightCm: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>
          </section>

          {/* Preferences & Language */}
          <section className="space-y-3 border-t border-slate-100 pt-4">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Accessibility & Sensory Comfort</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">Language</label>
                <select
                  value={profile.language}
                  onChange={(e) => onUpdateProfile({ ...profile, language: e.target.value as 'en' | 'ta' })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden bg-white"
                >
                  <option value="en">English (Voice & Text)</option>
                  <option value="ta">Tamil - தமிழ் (Voice & Text)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Visual Theme</label>
                <select
                  value={profile.theme}
                  onChange={(e) => onUpdateProfile({ ...profile, theme: e.target.value as 'meadow' | 'space' | 'safari' })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden bg-white"
                >
                  <option value="meadow">Friendly Meadow (Bao the Panda)</option>
                  <option value="space">Space Odyssey (Astro Pup)</option>
                  <option value="safari">Sunny Safari (Leo the Lion)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.sensorySafe}
                  onChange={(e) => onUpdateProfile({ ...profile, sensorySafe: e.target.checked })}
                  className="rounded text-emerald-600"
                />
                <span className="font-medium text-slate-700">Sensory-Safe Mode (Reduced motion, soft chimes only)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.audioConsent}
                  onChange={(e) => onUpdateProfile({ ...profile, audioConsent: e.target.checked })}
                  className="rounded text-emerald-600"
                />
                <span className="font-medium text-slate-700">Audio Consent Opt-In (Microphone and spoken feedback permitted)</span>
              </label>
            </div>
          </section>

          {/* Gaze Simulation & Safety Controls */}
          <section className="space-y-3 border-t border-slate-100 pt-4">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Gaze Tracking & Simulator</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.interactionMode === 'TOUCH'}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      interactionMode: e.target.checked ? 'TOUCH' : 'GAZE',
                      simulateGaze: false,
                    })
                  }
                  className="rounded text-emerald-600"
                />
                <span className="font-medium text-slate-700">Touch & Tap Mode (Accessible - No Camera Required)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showGazeCursor}
                  onChange={(e) => onUpdateSettings({ ...settings, showGazeCursor: e.target.checked })}
                  className="rounded text-emerald-600"
                />
                <span className="font-medium text-slate-700">Show Gaze Cursor on Screen</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">Max Session Length (minutes)</label>
                <input
                  type="number"
                  min="3"
                  max="30"
                  value={settings.maxSessionLengthMin}
                  onChange={(e) => onUpdateSettings({ ...settings, maxSessionLengthMin: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Dwell Time Threshold (ms)</label>
                <input
                  type="number"
                  min="300"
                  max="1200"
                  step="50"
                  value={settings.dwellTimeThresholdMs}
                  onChange={(e) => onUpdateSettings({ ...settings, dwellTimeThresholdMs: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            {settings.enableCalibration ? (
              <button
                onClick={() => {
                  onClose();
                  onTriggerRecalibration();
                }}
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 font-semibold text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                Start Recalibration (R)
              </button>
            ) : <span />}

            <button
              onClick={onClose}
              className="rounded-xl bg-emerald-600 px-6 py-2.5 font-semibold text-white shadow-md hover:bg-emerald-500 transition-colors cursor-pointer"
            >
              Save & Resume
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
