import React from 'react';
import { SessionSummary, InteractionMode } from '../../types';
import { sessionStorageService } from '../../services/sessionStorageService';
import { visionService } from '../../services/visionService';
import { socialRobotGazeService } from '../../services/socialRobotGazeService';

interface AdultDashboardScreenProps {
  onStartNewSession: (mode: InteractionMode) => void;
  onViewReportsHistory: () => void;
  onOpenResearchEval: () => void;
  onOpenSettings: () => void;
  onOpenPrivacy: () => void;
  onSelectSession: (session: SessionSummary) => void;
  onBackToPlay: () => void;
}

export const AdultDashboardScreen: React.FC<AdultDashboardScreenProps> = ({
  onStartNewSession,
  onViewReportsHistory,
  onOpenResearchEval,
  onOpenSettings,
  onOpenPrivacy,
  onSelectSession,
  onBackToPlay,
}) => {
  const sessions = sessionStorageService.getAllSessions();
  const totalSessions = sessions.length;
  const gazeSessions = sessions.filter((s) => s.interactionMode === 'GAZE');
  const touchSessions = sessions.filter((s) => s.interactionMode === 'TOUCH');
  const sessionsWithGazeSamples = gazeSessions.filter(
    (s) => s.totalFrames > 0 && s.validSamplePercent != null
  );
  const avgValidSample =
    sessionsWithGazeSamples.length > 0
      ? `${Math.round(
          sessionsWithGazeSamples.reduce((acc, s) => acc + (s.validSamplePercent ?? 0), 0) /
            sessionsWithGazeSamples.length
        )}%`
      : 'Not recorded';

  const backendType =
    visionService.isReady() && socialRobotGazeService.isReady() ? 'python_service' : 'none';

  return (
    <div className="relative z-10 flex h-full w-full flex-col p-4 sm:p-8 bg-slate-900 text-slate-100 select-none overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                📊
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white font-['Quicksand']">Adult & Researcher Dashboard</h1>
            </div>
            <p className="mt-1 text-xs text-amber-300 font-medium">
              Play activity records · These results do not diagnose or measure development
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onStartNewSession('GAZE')}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition-colors cursor-pointer"
            >
              + New Gaze Session
            </button>
            <button
              type="button"
              onClick={() => onStartNewSession('TOUCH')}
              className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-400 transition-colors cursor-pointer"
            >
              + New Touch Session
            </button>
            <button
              type="button"
              onClick={onBackToPlay}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
            >
              Play Eye-play 🐼
            </button>
          </div>
        </div>

        {/* System Readiness & Hardware Status */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Computer Vision Pipeline
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  backendType !== 'none' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="text-sm font-bold text-white">
                {backendType === 'python_service'
                  ? 'MediaPipe + Four-feature Ridge model (Local)'
                  : 'Ready on Camera Start'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Browser-side eye features, local screen prediction, and per-session calibration</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Total Logged Sessions
            </span>
            <div className="text-2xl font-extrabold text-white tabular-nums">{totalSessions}</div>
            <p className="text-[11px] text-slate-400 mt-1">
              {gazeSessions.length} Gaze · {touchSessions.length} Touch
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Mean Sample Validity
            </span>
            <div className="text-2xl font-extrabold text-emerald-400 tabular-nums">{avgValidSample}</div>
            <p className="text-[11px] text-slate-400 mt-1">Gaze sessions with captured frames only</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Validated Attention Measures
            </span>
            <div className="text-lg font-bold text-slate-300">Not available</div>
            <p className="text-[11px] text-slate-400 mt-1">This prototype does not calculate validated measures</p>
          </div>
        </div>

        {/* Quick Workflow Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={onViewReportsHistory}
            className="group rounded-2xl border border-slate-800 bg-slate-800/30 p-5 hover:border-emerald-500/50 hover:bg-slate-800/50 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">📑</span>
              <span className="text-xs text-emerald-400 font-bold group-hover:translate-x-0.5 transition-transform">
                Open Reports →
              </span>
            </div>
            <h3 className="text-base font-bold text-white mb-1">Easy-to-read session reports</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              See how long each play session lasted, what was recorded, and a plain-language gaze check.
            </p>
          </div>

          <div
            onClick={onOpenResearchEval}
            className="group rounded-2xl border border-slate-800 bg-slate-800/30 p-5 hover:border-sky-500/50 hover:bg-slate-800/50 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">🔬</span>
              <span className="text-xs text-sky-400 font-bold group-hover:translate-x-0.5 transition-transform">
                Evaluate →
              </span>
            </div>
            <h3 className="text-base font-bold text-white mb-1">Research Evaluation Protocol</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Complete the 3-part adult evaluation: Report Understanding, Activity-Adjustment Scenarios, and Structured
              Feedback.
            </p>
          </div>

          <div
            onClick={onOpenSettings}
            className="group rounded-2xl border border-slate-800 bg-slate-800/30 p-5 hover:border-amber-500/50 hover:bg-slate-800/50 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">⚙️</span>
              <span className="text-xs text-amber-400 font-bold group-hover:translate-x-0.5 transition-transform">
                Configure →
              </span>
            </div>
            <h3 className="text-base font-bold text-white mb-1">Settings & Voice Guidance</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Adjust dwell thresholds, speaking rates, subtitles, sensory safe mode, and calibration drift correction.
            </p>
          </div>
        </div>

        {/* Recent Sessions Table */}
        <div className="rounded-2xl border border-slate-800 bg-slate-800/20 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Recent Participant Sessions</h2>
            <button
              type="button"
              onClick={onViewReportsHistory}
              className="text-xs text-emerald-400 hover:underline cursor-pointer"
            >
              View All ({sessions.length})
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-500 text-xs">
              No sessions completed yet. Start your first session above!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-700 text-slate-400 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Session Date</th>
                    <th className="py-2.5 px-3">Participant</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Validity</th>
                    <th className="py-2.5 px-3">Calibration</th>
                    <th className="py-2.5 px-3">Captured Gaze Samples</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 tabular-nums">
                  {sessions.slice(0, 5).map((s) => (
                    <tr key={s.sessionId} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3 text-slate-400">
                        {new Date(s.startTime).toLocaleDateString()} {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3 font-bold text-white">{s.childProfile.pseudonym}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            s.interactionMode === 'GAZE'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {s.interactionMode}
                        </span>
                      </td>
                      <td className="py-3 px-3">{Math.round(s.durationSeconds)}s</td>
                      <td className="py-3 px-3 text-emerald-400">
                        {s.interactionMode === 'GAZE' && s.validSamplePercent != null
                          ? `${s.validSamplePercent}%`
                          : 'Not applicable'}
                      </td>
                      <td className="py-3 px-3">{s.calibrationQuality.validationStatus}</td>
                      <td className="py-3 px-3">{s.validGazeFrames} / {s.totalFrames}</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectSession(s)}
                          className="rounded-lg bg-emerald-600/30 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-600/50 cursor-pointer"
                        >
                          View Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Plain-language glossary for families and educators */}
        <section aria-labelledby="plain-language-title" className="rounded-2xl border border-sky-900/60 bg-sky-950/20 p-5 space-y-3">
          <h3 id="plain-language-title" className="text-sm font-bold text-white">What do these words mean?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs leading-relaxed">
            <div className="rounded-xl bg-slate-900/70 p-3"><strong className="text-sky-200 block mb-1">Face detection</strong><span className="text-slate-300">The camera can find a face in the picture.</span></div>
            <div className="rounded-xl bg-slate-900/70 p-3"><strong className="text-sky-200 block mb-1">Gaze estimate</strong><span className="text-slate-300">The model makes a best guess about where someone is looking on the screen.</span></div>
            <div className="rounded-xl bg-slate-900/70 p-3"><strong className="text-sky-200 block mb-1">Tracking quality</strong><span className="text-slate-300">How often the camera and model can provide a usable estimate.</span></div>
            <div className="rounded-xl bg-slate-900/70 p-3"><strong className="text-sky-200 block mb-1">Accuracy</strong><span className="text-slate-300">How close a gaze estimate is to a known target in a controlled test. It is not the same as game performance.</span></div>
            <div className="rounded-xl bg-slate-900/70 p-3"><strong className="text-sky-200 block mb-1">Progress</strong><span className="text-slate-300">A change in results across similar activities. More than one comparable session is usually needed to spot a trend.</span></div>
            <div className="rounded-xl bg-slate-900/70 p-3"><strong className="text-sky-200 block mb-1">Development</strong><span className="text-slate-300">Broader changes in a child's skills. This app alone cannot measure or diagnose overall development.</span></div>
          </div>
          <p className="text-xs text-slate-400">A low tracking-quality result may be caused by lighting, movement, glasses, camera position, or device limits. It is not evidence that a child did poorly or was not paying attention.</p>
        </section>

        {/* Measurement limitations */}
        <div className="rounded-2xl border border-slate-800 bg-slate-800/20 p-5 space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            What these records can and cannot show
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400 leading-relaxed">
            <div>
              <strong className="text-slate-200 block mb-0.5">Recorded data:</strong>
              Time spent, games played, completed tasks, tracking reliability, and calibration results when available.
            </div>
            <div>
              <strong className="text-slate-200 block mb-0.5">Not measured by this app:</strong>
              The app does not measure attention, understanding, or overall development. Use these records to discuss activities and decide what to practise next.
            </div>
            <p className="md:col-span-2">
              Missing gaze samples mean the camera could not provide a usable estimate; they do not mean the child was not looking or paying attention. Touch play is recorded separately from gaze play.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
