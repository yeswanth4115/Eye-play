import React, { useState, useEffect, useRef } from 'react';
import { CaregiverSettings, ChildProfile } from '../../types';
import { voiceGuidance } from '../../services/voiceGuidanceService';
import { soundService } from '../../services/soundEffects';

interface SettingsScreenProps {
  settings: CaregiverSettings;
  profile: ChildProfile;
  onUpdateSettings: (settings: CaregiverSettings) => void;
  onUpdateProfile: (profile: ChildProfile) => void;
  onTriggerRecalibration: () => void;
  onStartEyeGazeCalibration: () => Promise<void>;
  onCalibrationRunnerFinished: () => void;
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  profile,
  onUpdateSettings,
  onUpdateProfile,
  onTriggerRecalibration,
  onStartEyeGazeCalibration,
  onCalibrationRunnerFinished,
  onBack,
}) => {
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [trackerHealth, setTrackerHealth] = useState<{ ok: boolean; model_type?: string; calibration_quality?: string; cv_mean_error_px?: number; cv_median_error_px?: number; cv_worst_error_px?: number; n_calibration_points?: number; error?: string } | null>(null);
  const [runner, setRunner] = useState<{ state: string; current_point?: number; total_points?: number; accepted_points?: number; progress?: number; error?: string; log_tail?: string }>({ state: 'idle' });
  const [startingRunner, setStartingRunner] = useState(false);
  const finishedNotifiedRef = useRef(false);

  useEffect(() => {
    setAvailableVoices(voiceGuidance.getVoices());
    let cancelled = false;
    fetch('/api/health')
      .then((response) => response.json())
      .then((body) => { if (!cancelled) setTrackerHealth(body); })
      .catch(() => { if (!cancelled) setTrackerHealth({ ok: false, error: 'Local EyeGazeTracker service is not reachable.' }); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch('/api/calibration/status');
        const body = await response.json();
        if (cancelled) return;
        setRunner(body);
        if (body.state === 'completed' && !finishedNotifiedRef.current) {
          finishedNotifiedRef.current = true;
          onCalibrationRunnerFinished();
          const health = await fetch('/api/health').then((r) => r.json());
          if (!cancelled) setTrackerHealth(health);
        }
      } catch {
        if (!cancelled) setRunner((current) => ({ ...current, error: 'Cannot read calibration progress from the local service.' }));
      }
    };
    void poll();
    const timer = window.setInterval(() => { if (runner.state === 'running') void poll(); }, 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [runner.state, onCalibrationRunnerFinished]);

  const startBackgroundCalibration = async () => {
    setStartingRunner(true);
    try {
      finishedNotifiedRef.current = false;
      await onStartEyeGazeCalibration();
      setRunner({ state: 'running', current_point: 0, total_points: 50, progress: 0 });
    } catch (error) {
      setRunner({ state: 'failed', error: error instanceof Error ? error.message : 'Could not start calibration.' });
    } finally {
      setStartingRunner(false);
    }
  };

  const handleTestVoice = () => {
    soundService.playStarChime(1.1);
    voiceGuidance.speak('Hi, friend! I am Bao. Let’s play together!');
  };

  return (
    <div className="relative z-10 flex h-full w-full flex-col p-4 sm:p-8 bg-slate-900 text-slate-100 select-none overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-xl font-bold text-amber-400 border border-amber-500/20">
              ⚙️
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white font-['Quicksand']">
                Settings, Accessibility & Voice Guidance
              </h1>
              <p className="text-xs text-slate-400">Personalize sensory comfort, speech guidance, and gaze interaction</p>
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

        {/* SECTION 1: VOICE GUIDANCE & SPEECH CONTROLS */}
        <section className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>🗣️</span>
                <span>Voice Guidance & Audio Controls</span>
              </h2>
              <p className="text-xs text-slate-400">
                Bao uses short, gentle instructions. Choose a speaking speed, volume, and voice available on this device.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestVoice}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
            >
              Hear Bao 🔊
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.voiceConfig.enabled}
                onChange={(e) => {
                  const updated = { ...settings.voiceConfig, enabled: e.target.checked };
                  onUpdateSettings({ ...settings, voiceConfig: updated });
                  voiceGuidance.updateConfig({ enabled: e.target.checked });
                }}
                className="h-4 w-4 rounded-md accent-emerald-600"
              />
              <span className="font-semibold text-white">Enable spoken instructions</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.voiceConfig.showCaptions}
                onChange={(e) => {
                  const updated = { ...settings.voiceConfig, showCaptions: e.target.checked };
                  onUpdateSettings({ ...settings, voiceConfig: updated });
                  voiceGuidance.updateConfig({ showCaptions: e.target.checked });
                }}
                className="h-4 w-4 rounded-md accent-emerald-600"
              />
              <span className="font-semibold text-white">Show on-screen text subtitles (Captions)</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Speaking Speed ({settings.voiceConfig.rate.toFixed(2)}x)
              </label>
              <input
                type="range"
                min="0.6"
                max="1.3"
                step="0.05"
                value={settings.voiceConfig.rate}
                onChange={(e) => {
                  const rate = Number(e.target.value);
                  const updated = { ...settings.voiceConfig, rate };
                  onUpdateSettings({ ...settings, voiceConfig: updated });
                  voiceGuidance.updateConfig({ rate });
                }}
                className="w-full accent-emerald-500"
              />
              <span className="text-[10px] text-slate-500">Lower rate helps children process language</span>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Voice Volume ({Math.round(settings.voiceConfig.volume * 100)}%)
              </label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={settings.voiceConfig.volume}
                onChange={(e) => {
                  const volume = Number(e.target.value);
                  const updated = { ...settings.voiceConfig, volume };
                  onUpdateSettings({ ...settings, voiceConfig: updated });
                  voiceGuidance.updateConfig({ volume });
                }}
                className="w-full accent-emerald-500"
              />
              <span className="text-[10px] text-slate-500">Gentle sound level for comfort</span>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Voice on this device</label>
              <select
                value={settings.voiceConfig.voiceName || ''}
                onChange={(e) => {
                  const voiceName = e.target.value || undefined;
                  const updated = { ...settings.voiceConfig, voiceName };
                  onUpdateSettings({ ...settings, voiceConfig: updated });
                  voiceGuidance.updateConfig({ voiceName });
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-emerald-500 outline-none"
              >
                <option value="">Default voice</option>
                {availableVoices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* SECTION 2: ACCESSIBILITY & SENSORY COMFORT */}
        <section className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>✨</span>
            <span>Sensory Comfort & Accessibility</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.sensorySafe}
                onChange={(e) => onUpdateProfile({ ...profile, sensorySafe: e.target.checked })}
                className="h-4 w-4 rounded-md accent-emerald-600"
              />
              <div>
                <span className="font-semibold text-white block text-xs">Sensory-Safe Mode</span>
                <span className="text-[11px] text-slate-400">Reduces visual sparkle animations and restricts sounds to soothing sine tones</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showGazeCursor}
                onChange={(e) => onUpdateSettings({ ...settings, showGazeCursor: e.target.checked })}
                className="h-4 w-4 rounded-md accent-emerald-600"
              />
              <div>
                <span className="font-semibold text-white block text-xs">Show Real-Time Gaze Cursor</span>
                <span className="text-[11px] text-slate-400">Off by default; turn on only when an adult wants to view estimated gaze</span>
              </div>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableCalibration}
                onChange={(e) => onUpdateSettings({ ...settings, enableCalibration: e.target.checked })}
                className="h-4 w-4 rounded-md accent-emerald-600"
              />
              <div>
                <span className="font-semibold text-white block text-xs">Enable Optional Gaze Calibration</span>
                <span className="text-[11px] text-slate-400">Off by default; play uses the pretrained model until an adult enables calibration</span>
              </div>
            </label>
          </div>
        </section>

        {/* SECTION 3: FULL EyeGazeTracker CALIBRATION */}
        <section className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">EyeGazeTracker · Personal calibration</h2>
            <p className="mt-1 text-xs text-slate-400">Runs the supplied 04_calibration.py collector and trains a participant-specific gaze model from the child’s live eye-feature samples. This is more than a model-readiness check.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={startBackgroundCalibration} disabled={startingRunner || runner.state === 'running'} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-50">
              {startingRunner ? 'Starting…' : runner.state === 'running' ? 'Calibration running…' : 'Start full gaze calibration'}
            </button>
            <span className="text-xs text-slate-300">{runner.state === 'running' ? `Point ${runner.current_point || 0} of ${runner.total_points || 50} · ${runner.accepted_points || 0} accepted` : runner.state === 'completed' ? 'Calibration complete · new model loaded' : runner.state === 'failed' ? 'Calibration failed' : 'Ready to calibrate'}</span>
          </div>
          {runner.state === 'running' && <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700"><div className="h-full rounded-full bg-cyan-400 transition-all duration-500" style={{ width: `${runner.progress || 0}%` }} /></div>}
          {runner.error && <p className="text-xs text-rose-300">{runner.error}</p>}
          {runner.state === 'running' && <p className="text-[11px] text-amber-200">The calibration target window opens separately so the child can look at each target. Keep the child seated at the usual screen distance and avoid moving the camera.</p>}
          {runner.state === 'completed' && <p className="text-xs text-emerald-300">The newly trained model and metadata have been loaded by the local gaze service and will be used by the games.</p>}
        </section>

        {/* SECTION 3: SESSION SAFETY & TIMEOUT LIMITS */}
        <section className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>⏱️</span>
            <span>Session Safety, Dwell Time & Rest Screen</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Max Session Time (Minutes)</label>
              <input
                type="number"
                min="3"
                max="30"
                value={settings.maxSessionLengthMin}
                onChange={(e) => onUpdateSettings({ ...settings, maxSessionLengthMin: Number(e.target.value) || 10 })}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-emerald-500 outline-none"
              />
              <span className="text-[10px] text-slate-500">Triggers gentle rest screen automatically</span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Target Dwell Time (ms)</label>
              <input
                type="number"
                min="300"
                max="1200"
                step="50"
                value={settings.dwellTimeThresholdMs}
                onChange={(e) => onUpdateSettings({ ...settings, dwellTimeThresholdMs: Number(e.target.value) || 500 })}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-emerald-500 outline-none"
              />
              <span className="text-[10px] text-slate-500">Fixation duration required to select a target</span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Rest Pause Duration (Seconds)</label>
              <input
                type="number"
                min="10"
                max="60"
                value={settings.restPauseDurationSec}
                onChange={(e) => onUpdateSettings({ ...settings, restPauseDurationSec: Number(e.target.value) || 15 })}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-emerald-500 outline-none"
              />
              <span className="text-[10px] text-slate-500">Duration of soothing breathing break</span>
            </div>
          </div>
        </section>

        {/* SECTION 4: CALIBRATION & DRIFT ADJUSTMENT */}
        <section className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>🎯</span>
                <span>EyeGazeTracker Calibration & Drift Tuning</span>
              </h2>
              <p className="text-xs text-slate-400">Calibrate the active four-feature gaze model for this participant and display. The saved mapping is reused across all five games.</p>
            </div>
            {settings.enableCalibration && (
              <button
                type="button"
                onClick={onTriggerRecalibration}
                className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 cursor-pointer"
              >
                Open Calibration ⭐
              </button>
            )}
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-white">Local EyeGazeTracker model</span>
              <span className={`rounded-full px-2 py-1 font-bold ${trackerHealth?.ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                {trackerHealth == null ? 'Checking…' : trackerHealth.ok ? 'Loaded' : 'Unavailable'}
              </span>
            </div>
            {trackerHealth?.ok ? (
              <>
                <p className="mt-2 text-slate-300">Model: {trackerHealth.model_type || 'four-feature gaze model'} · Calibration targets in training file: {trackerHealth.n_calibration_points ?? 'not recorded'}</p>
                <p className="mt-1 text-slate-400">Held-out calibration-set error: mean {typeof trackerHealth.cv_mean_error_px === 'number' ? `${trackerHealth.cv_mean_error_px.toFixed(1)} px` : 'not recorded'}, median {typeof trackerHealth.cv_median_error_px === 'number' ? `${trackerHealth.cv_median_error_px.toFixed(1)} px` : 'not recorded'}.</p>
                <p className="mt-1 text-amber-300">These are model evaluation figures, not a guarantee for this child or device. Personal screen calibration below is optional and should be checked with live use.</p>
              </>
            ) : (
              <p className="mt-2 text-amber-200">{trackerHealth?.error || 'The local model status has not been confirmed. Start the local gaze service before camera-based play.'}</p>
            )}
            <p className="mt-2 text-slate-400">Calibration uses the active EyeGazeTracker predictions and saves a local screen mapping. Camera frames are not saved.</p>
          </div>

          <div className="text-xs">
            <label className="block text-slate-400 mb-1">
              Continuous Drift Correction Gain ({(settings.driftCorrectionGain * 100).toFixed(0)}%)
            </label>
            <input
              type="range"
              min="0.01"
              max="0.15"
              step="0.01"
              value={settings.driftCorrectionGain}
              onChange={(e) => onUpdateSettings({ ...settings, driftCorrectionGain: Number(e.target.value) })}
              className="w-full accent-amber-500"
            />
            <span className="text-[10px] text-slate-500">
              Gently nudges gaze coordinates toward targets during sustained dwell without concealing genuine tracking error
            </span>
          </div>
        </section>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 cursor-pointer"
          >
            Save & Return
          </button>
        </div>
      </div>
    </div>
  );
};
