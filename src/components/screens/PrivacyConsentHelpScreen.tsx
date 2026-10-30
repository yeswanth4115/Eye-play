import React, { useState } from 'react';
import { sessionStorageService } from '../../services/sessionStorageService';
import { calibrationStorageService } from '../../services/calibrationStorageService';

interface PrivacyConsentHelpScreenProps {
  onBack: () => void;
}

export const PrivacyConsentHelpScreen: React.FC<PrivacyConsentHelpScreenProps> = ({ onBack }) => {
  const [dataCleared, setDataCleared] = useState(false);

  const handleClearData = () => {
    if (window.confirm('Delete all session records, participant codes, and saved calibration mappings from this device’s browser storage?')) {
      sessionStorageService.clearAllLocalData();
      calibrationStorageService.clear();
      setDataCleared(true);
      setTimeout(() => setDataCleared(false), 3000);
    }
  };

  return (
    <div className="relative z-10 flex h-full w-full flex-col p-4 sm:p-8 bg-slate-900 text-slate-100 select-none overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-xl font-bold text-emerald-400 border border-emerald-500/20">
              🛡️
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white font-['Quicksand']">
                Privacy, Consent & Help
              </h1>
              <p className="text-xs text-slate-400">
                Ethical research guidelines, local data security, and troubleshooting
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
          >
            ← Back
          </button>
        </div>

        {/* SECTION 1: PRIVACY & DATA GUARANTEE */}
        <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5 space-y-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>🔒</span>
            <span>Data Privacy & Zero Cloud Transmission</span>
          </h2>
          <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
            <p>
              <strong>On-Device Processing:</strong> Face landmarks and the four normalized eye features are computed in
              the browser. Only those four feature values are sent to the local Python gaze service on this computer;
              camera frames are not sent to the service, uploaded to a cloud server, or written to disk.
            </p>
            <p>
              <strong>Pseudonymous Identification:</strong> Participants are recorded only by researcher-assigned codes or
              friendly nicknames (e.g. <code>Child-P104</code>). Never enter identifiable information such as full legal
              names, social security numbers, or addresses.
            </p>
            <p>
              <strong>Local Browser Storage:</strong> Session summaries, participant codes, and eligible calibration mappings are stored in this browser&apos;s local storage (<code>localStorage</code>). Webcam frames are not stored. You can export session summaries or permanently clear the locally saved records and calibration mappings below.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleClearData}
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 cursor-pointer"
            >
              Permanently Clear All Local Data & Calibration 🗑️
            </button>
            {dataCleared && <span className="ml-3 text-xs text-emerald-400 font-semibold">✓ Local records and saved calibration cleared!</span>}
          </div>
        </div>

        {/* SECTION 2: RESEARCH ETHICS & CLINICAL DISCLAIMER */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
          <h2 className="text-sm font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
            <span>⚠️</span>
            <span>Research Tool Scope & Clinical Ethics Statement</span>
          </h2>
          <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
            <p>
              <strong>Not a Diagnostic Tool:</strong> Eye-play is an exploratory research and
              accessible gaze-interaction tool. It is <strong>NOT</strong> an autism diagnostic instrument, clinical
              screener, or medical assessment device.
            </p>
            <p>
              <strong>Estimates vs Direct Measurements:</strong> Gaze coordinates computed from standard webcams have
              substantial spatial uncertainty. The selected upstream model reports much higher error on unseen screen
              locations than during calibration. Never use estimates in isolation to judge attention, comprehension, or
              cognitive ability.
            </p>
            <p>
              <strong>Guardian Consent & Child Assent:</strong> For all formal research sessions, obtain informed
              guardian consent and age-appropriate child assent. The child is free to pause, rest, or stop at any time
              without pressure.
            </p>
          </div>
        </div>

        {/* SECTION 3: KEYBOARD SHORTCUTS REFERENCE */}
        <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5 space-y-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>⌨️</span>
            <span>Caregiver & Researcher Keyboard Shortcuts</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl bg-slate-900 p-3 border border-slate-800">
              <kbd className="rounded-md bg-slate-800 px-2 py-0.5 font-mono font-bold text-white border border-slate-700">
                P
              </kbd>
              <span className="block mt-1 font-semibold text-slate-300">Pause / Resume</span>
              <span className="text-[10px] text-slate-500">Opens soothing rest screen</span>
            </div>
            <div className="rounded-xl bg-slate-900 p-3 border border-slate-800">
              <kbd className="rounded-md bg-slate-800 px-2 py-0.5 font-mono font-bold text-white border border-slate-700">
                Esc
              </kbd>
              <span className="block mt-1 font-semibold text-slate-300">Stop / Exit</span>
              <span className="text-[10px] text-slate-500">Finishes session or closes modals</span>
            </div>
            <div className="rounded-xl bg-slate-900 p-3 border border-slate-800">
              <kbd className="rounded-md bg-slate-800 px-2 py-0.5 font-mono font-bold text-white border border-slate-700">
                R
              </kbd>
              <span className="block mt-1 font-semibold text-slate-300">Recalibrate</span>
              <span className="text-[10px] text-slate-500">Launches star catcher calibration</span>
            </div>
            <div className="rounded-xl bg-slate-900 p-3 border border-slate-800">
              <kbd className="rounded-md bg-slate-800 px-2 py-0.5 font-mono font-bold text-white border border-slate-700">
                S
              </kbd>
              <span className="block mt-1 font-semibold text-slate-300">Settings</span>
              <span className="text-[10px] text-slate-500">Opens quick settings dialog</span>
            </div>
          </div>
        </div>

        {/* SECTION 4: TROUBLESHOOTING & FAQ */}
        <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5 space-y-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>❓</span>
            <span>Frequently Asked Questions & Troubleshooting</span>
          </h2>
          <div className="space-y-3 text-xs text-slate-300">
            <div>
              <strong className="text-white block">Camera permission was blocked — how do I enable it?</strong>
              <p className="text-slate-400 mt-0.5">
                Click the lock or camera icon in your browser URL address bar, change camera permission to &quot;Allow&quot;, and
                refresh the page.
              </p>
            </div>
            <div>
              <strong className="text-white block">The gaze cursor is shaking or drifting.</strong>
              <p className="text-slate-400 mt-0.5">
                Ensure there is no bright window directly behind the participant (backlighting confuses iris detection).
                Sit approximately 50 cm away from the webcam. Press <code>R</code> to perform a quick star recalibration.
              </p>
            </div>
            <div>
              <strong className="text-white block">Can we play without any camera at all?</strong>
              <p className="text-slate-400 mt-0.5">
                Yes! Select <strong>Touch Mode (Accessible)</strong> on the home screen or settings. Children can interact
                by tapping on touchscreens or clicking with a mouse, and reports clearly label that touch mode was used.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
