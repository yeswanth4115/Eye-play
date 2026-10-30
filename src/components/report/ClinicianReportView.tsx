import React, { useState } from 'react';
import { SessionSummary } from '../../types';
import { sessionStorageService } from '../../services/sessionStorageService';

interface ClinicianReportViewProps {
  sessionData: SessionSummary;
  onClose: () => void;
  onNewSession: () => void;
  onOpenResearchEval?: () => void;
}

const formatMetric = (value: number | null | undefined, digits = 0): string =>
  value == null || !Number.isFinite(value) ? 'Not recorded' : value.toFixed(digits);

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes === 0) return `${remainingSeconds} sec`;
  return remainingSeconds === 0 ? `${minutes} min` : `${minutes} min ${remainingSeconds} sec`;
};

const getCalibrationSummary = (sessionData: SessionSummary): string => {
  if (sessionData.interactionMode === 'TOUCH') {
    return 'Touch controls were used, so there is no gaze check for this session.';
  }
  switch (sessionData.calibrationQuality.validationStatus) {
    case 'VALIDATED':
      return 'The camera gaze check passed. Gaze positions are still estimates.';
    case 'MARGINAL':
      return 'The camera gaze check suggests the gaze position may be less accurate.';
    case 'NOT_CALIBRATED':
      return 'The pre-trained gaze model was used without a personal screen calibration. Screen positions may be less precise.';
    case 'SKIPPED_TOUCH_MODE':
      return 'Touch controls were used, so there is no gaze check for this session.';
    default:
      return 'A camera gaze check was not saved for this session.';
  }
};

export const ClinicianReportView: React.FC<ClinicianReportViewProps> = ({
  sessionData,
  onClose,
  onNewSession,
  onOpenResearchEval,
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'HEATMAP' | 'SCANPATH' | 'BUTTERFLY_MAP' | 'ENGAGEMENT' | 'LONGITUDINAL' | 'RAW_EXPORT'>('OVERVIEW');

  // Download CSV export using sessionStorageService
  const downloadCsv = () => {
    const csv = sessionStorageService.exportSessionsAsCsv([sessionData]);
    sessionStorageService.downloadFile(csv, `eyeplay_session_${sessionData.childProfile.pseudonym}_${Date.now()}.csv`, 'text/csv');
  };

  // Download JSON export
  const downloadJson = () => {
    const jsonStr = sessionStorageService.exportSessionsAsJson([sessionData]);
    sessionStorageService.downloadFile(jsonStr, `eyeplay_session_${sessionData.childProfile.pseudonym}_${Date.now()}.json`, 'application/json');
  };

  const printReport = () => {
    window.print();
  };

  // Extract all recorded gaze points across trials if available
  const allPoints = (sessionData.trials || []).flatMap((t) => t.gazePoints || []);
  const validPoints =
    sessionData.interactionMode === 'GAZE'
      ? allPoints.filter((p) => p.isValid && p.x > 0 && p.y > 0)
      : [];
  const recordedWidth = sessionData.deviceMetadata?.screenWidth ?? 0;
  const recordedHeight = sessionData.deviceMetadata?.screenHeight ?? 0;
  const participantSessions = sessionStorageService
    .getAllSessions()
    .filter((session) => session.childProfile.pseudonym === sessionData.childProfile.pseudonym)
    .sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime));
  const butterflyResults = (sessionData.trials || []).filter((trial) => trial.gameId === 'BUTTERFLY');
  const butterflyFollowPercent = butterflyResults
    .map((trial) => trial.gazeFollowPercent)
    .filter((value): value is number => value != null && Number.isFinite(value));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-slate-100 overflow-y-auto">
      {/* Top Clinician Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-6 border-b border-slate-800 bg-slate-900/95 px-6 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
            📊
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">Simple Session Report</h1>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                  sessionData.interactionMode === 'GAZE'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {sessionData.interactionMode === 'GAZE' ? 'Camera play' : 'Touch play'}
              </span>
            </div>
            <p className="text-xs text-amber-400 font-medium">A play summary, not a medical or diagnostic report</p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="hidden lg:flex items-center gap-1 rounded-xl bg-slate-800/80 p-1 border border-slate-700">
          {(['OVERVIEW', 'HEATMAP', 'SCANPATH', 'BUTTERFLY_MAP', 'ENGAGEMENT', 'LONGITUDINAL', 'RAW_EXPORT'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === tab ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'OVERVIEW'
                ? 'EASY SUMMARY'
                : tab === 'HEATMAP'
                ? 'GAZE MAP'
                : tab === 'SCANPATH'
                ? 'RECORDED SAMPLES'
                : tab === 'BUTTERFLY_MAP'
                ? 'BUTTERFLY MAP'
                : tab === 'ENGAGEMENT'
                ? 'EXTRA MEASURES'
                : tab === 'LONGITUDINAL'
                ? 'PAST SESSIONS'
                : tab === 'RAW_EXPORT'
                ? 'DATA EXPORT'
                : tab}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onOpenResearchEval && (
            <button
              type="button"
              onClick={onOpenResearchEval}
              className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition-colors cursor-pointer"
            >
              Research Evaluation 🔬
            </button>
          )}
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Download data (CSV)
          </button>
          <button
            type="button"
            onClick={downloadJson}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Download data (JSON)
          </button>
          <button
            type="button"
            onClick={printReport}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
          >
            Print
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close (Esc)
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto w-full max-w-7xl flex-1 p-6 space-y-6">
        {/* Participant & Session Banner */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 rounded-2xl border border-slate-800 bg-slate-800/40 p-4">
          <div>
            <span className="text-[11px] text-slate-400 block mb-1">Player code</span>
            <span className="text-sm font-bold text-white">{sessionData.childProfile.pseudonym || 'Not provided'}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block mb-1">Age</span>
            <span className="text-sm font-bold text-white tabular-nums">{sessionData.childProfile.ageYears} years</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block mb-1">Screen setup</span>
            <span className="text-sm font-bold text-white tabular-nums">
              {sessionData.childProfile.viewingDistanceCm} cm · {sessionData.childProfile.screenWidthCm} cm display
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block mb-1">Camera readings</span>
            <span className="text-sm font-bold text-emerald-400 tabular-nums">
              {sessionData.interactionMode === 'GAZE'
                ? `${sessionData.validGazeFrames} of ${sessionData.totalFrames}`
                : 'Not collected'}
            </span>
            <span className="text-[10px] text-slate-500 ml-1">
              {sessionData.interactionMode === 'GAZE' ? `(${sessionData.faceLostCount} times face was not seen)` : ''}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block mb-1">Gaze check</span>
            <span
              className={`text-sm font-bold ${
                sessionData.calibrationQuality.validationStatus === 'VALIDATED'
                  ? 'text-emerald-400'
                  : sessionData.calibrationQuality.validationStatus === 'NOT_CALIBRATED'
                  ? 'text-sky-300'
                  : sessionData.calibrationQuality.validationStatus === 'SKIPPED_TOUCH_MODE'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {sessionData.calibrationQuality.validationStatus === 'VALIDATED'
                ? 'Passed'
                : sessionData.calibrationQuality.validationStatus === 'MARGINAL'
                ? 'Needs care'
                : sessionData.calibrationQuality.validationStatus === 'NOT_CALIBRATED'
                ? 'Pre-trained model only'
                : sessionData.interactionMode === 'TOUCH'
                ? 'Not needed'
                : 'Not recorded'}
            </span>
            <span className="text-[10px] text-slate-500 block">
              {getCalibrationSummary(sessionData)}
            </span>
          </div>
        </div>

        {/* Tab 1: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <h2 className="text-lg font-bold text-white">Today’s play</h2>
              <p className="mt-1 text-sm text-slate-300">
                Here’s a simple summary of what was recorded. It describes this play session only.
              </p>
              <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-slate-900/70 p-4">
                  <dt className="text-xs text-slate-400">How they played</dt>
                  <dd className="mt-1 font-semibold text-white">
                    {sessionData.interactionMode === 'GAZE' ? 'With the camera' : 'With touch or mouse'}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-900/70 p-4">
                  <dt className="text-xs text-slate-400">Play time</dt>
                  <dd className="mt-1 font-semibold text-white">{formatDuration(sessionData.durationSeconds)}</dd>
                </div>
                <div className="rounded-xl bg-slate-900/70 p-4">
                  <dt className="text-xs text-slate-400">Activities recorded</dt>
                  <dd className="mt-1 font-semibold text-white">{sessionData.trials?.length ?? 0}</dd>
                </div>
                <div className="rounded-xl bg-slate-900/70 p-4">
                  <dt className="text-xs text-slate-400">Gaze check</dt>
                  <dd className="mt-1 font-semibold text-white">
                    {sessionData.calibrationQuality.validationStatus === 'VALIDATED'
                      ? 'Passed'
                      : sessionData.calibrationQuality.validationStatus === 'MARGINAL'
                      ? 'May need another try'
                      : sessionData.calibrationQuality.validationStatus === 'NOT_CALIBRATED'
                      ? 'Pre-trained model only'
                      : sessionData.interactionMode === 'TOUCH'
                      ? 'Not needed'
                      : 'Not recorded'}
                  </dd>
                </div>
              </dl>
              {sessionData.interactionMode === 'GAZE' && (
                <p className="mt-3 text-sm text-slate-300">
                  {sessionData.validSamplePercent == null
                    ? 'Camera tracking coverage was not recorded.'
                    : `The camera recorded gaze in ${sessionData.validSamplePercent}% of the frames it checked.`}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-800/20 p-5">
              <h3 className="text-sm font-bold text-white">Game-by-game results</h3>
              <p className="mt-1 text-xs text-slate-400">
                Results describe how targets were followed or reached during these activities.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(sessionData.trials || []).map((trial, index) => (
                  <div key={`${trial.gameId}-${trial.trialNumber}-${index}`} className="rounded-xl bg-slate-900/70 p-3">
                    <p className="text-xs font-bold text-white">
                      {trial.gameId === 'BUTTERFLY'
                        ? 'Follow the Butterfly'
                        : trial.gameId === 'SPOT_IT'
                        ? 'Spot It'
                        : trial.gameId === 'LOOK_HERE'
                        ? 'Look Here'
                        : trial.gameId === 'MAZE'
                        ? 'Berry Trail'
                        : 'Listen & Do'}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      {trial.success ? 'Target goal reached' : 'Activity recorded; target goal not reached'}
                    </p>
                    {trial.gameId === 'BUTTERFLY' && sessionData.interactionMode === 'GAZE' && (
                      <p className="mt-1 text-xs text-emerald-300">
                        Gaze-follow estimate:{' '}
                        {trial.gazeFollowPercent == null ? 'Not recorded' : `${formatMetric(trial.gazeFollowPercent)}%`}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-slate-500">
                      Time: {formatDuration(Math.round(trial.durationMs / 1000))}
                    </p>
                  </div>
                ))}
                {(!sessionData.trials || sessionData.trials.length === 0) && (
                  <p className="text-xs text-slate-400">No game results were recorded.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-800/20 p-5">
              <h3 className="text-sm font-bold text-white">About the gaze check</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{getCalibrationSummary(sessionData)}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                This tool cannot tell whether someone was paying attention or learning. Missing camera readings can happen
                when a face is out of view or lighting changes; they do not tell us why.
              </p>
              <p className="mt-2 text-xs font-semibold text-amber-300">
                This is a research prototype, not a medical or diagnostic report.
              </p>
            </section>
          </div>
        )}

        {/* Tab 2: HEATMAP */}
        {activeTab === 'HEATMAP' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5">
            <h3 className="text-sm font-bold text-white mb-1">Recorded Gaze Samples</h3>
            <p className="text-xs text-slate-400 mb-4">
              Valid samples collected during this session. No fixation-density estimate is calculated.
            </p>

            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
              {validPoints.length > 0 && recordedWidth > 0 && recordedHeight > 0 ? (
                <svg className="h-full w-full" viewBox="0 0 1000 600" aria-label="Recorded gaze sample positions">
                  {validPoints.slice(0, 1000).map((point, index) => (
                    <circle
                      key={`${point.timestamp}-${index}`}
                      cx={(point.x / recordedWidth) * 1000}
                      cy={(point.y / recordedHeight) * 600}
                      r="4"
                      fill="#10B981"
                      opacity="0.55"
                    />
                  ))}
                </svg>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-400">
                  {validPoints.length > 0
                    ? 'Display dimensions were not recorded, so sample positions cannot be plotted.'
                    : 'No valid gaze samples were recorded for this session.'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: SCANPATH */}
        {activeTab === 'SCANPATH' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5">
            <h3 className="text-sm font-bold text-white mb-1">Gaze Sample Coordinates</h3>
            <p className="text-xs text-slate-400 mb-4">Recorded coordinates only; fixation and saccade classifications are not shown.</p>

            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-6">
              {validPoints.length > 0 && recordedWidth > 0 && recordedHeight > 0 ? (
                <svg className="h-full w-full" viewBox="0 0 1000 600" aria-label="Recorded gaze sample coordinates">
                  {validPoints.slice(0, 1000).map((point, index) => (
                    <circle
                      key={`${point.timestamp}-${index}`}
                      cx={(point.x / recordedWidth) * 1000}
                      cy={(point.y / recordedHeight) * 600}
                      r="3"
                      fill="#38BDF8"
                      opacity="0.65"
                    />
                  ))}
                </svg>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-400">
                  No plottable gaze samples were recorded.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Butterfly target-vs-gaze map: paired coordinates recorded during the game */}
        {activeTab === 'BUTTERFLY_MAP' && (() => {
          const trace = butterflyResults.flatMap((trial) => trial.butterflyTrace || []);
          const plotted = trace.filter((point) =>
            [point.targetX, point.targetY, point.gazeX, point.gazeY, point.timestamp].every(Number.isFinite) &&
            point.gazeX >= 0 && point.gazeY >= 0
          );
          const scaleX = (x: number) => (recordedWidth > 0 ? (x / recordedWidth) * 1000 : 0);
          const scaleY = (y: number) => (recordedHeight > 0 ? (y / recordedHeight) * 600 : 0);
          const targetPath = plotted.map((point) => `${scaleX(point.targetX)},${scaleY(point.targetY)}`).join(' ');
          const gazePath = plotted.map((point) => `${scaleX(point.gazeX)},${scaleY(point.gazeY)}`).join(' ');
          const meanDistance = plotted.length
            ? plotted.reduce((sum, point) => sum + Math.hypot(point.gazeX - point.targetX, point.gazeY - point.targetY), 0) / plotted.length
            : null;
          return (
            <section className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5" key="butterfly-map">
              <h3 className="text-sm font-bold text-white mb-1">Butterfly movement and estimated gaze</h3>
              <p className="text-xs text-slate-400 mb-4">
                Both traces use paired coordinates recorded during the butterfly game. The gaze line is an estimate, not a precise eye-position measurement.
              </p>
              {plotted.length >= 2 && recordedWidth > 0 && recordedHeight > 0 ? (
                <>
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                    <svg className="h-full w-full" viewBox="0 0 1000 600" role="img" aria-label="Butterfly target movement overlaid with estimated gaze movement">
                      <path d="M 0 0 H 1000 V 600 H 0 Z" fill="#020617" />
                      {[1, 2, 3, 4].map((n) => <line key={`v${n}`} x1={n * 200} y1="0" x2={n * 200} y2="600" stroke="#1e293b" strokeWidth="1" />)}
                      {[1, 2].map((n) => <line key={`h${n}`} x1="0" y1={n * 200} x2="1000" y2={n * 200} stroke="#1e293b" strokeWidth="1" />)}
                      <polyline points={targetPath} fill="none" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
                      <polyline points={gazePath} fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                      {plotted.filter((_, index) => index % Math.max(1, Math.floor(plotted.length / 45)) === 0).map((point, index) => (
                        <line key={`gap-${index}`} x1={scaleX(point.targetX)} y1={scaleY(point.targetY)} x2={scaleX(point.gazeX)} y2={scaleY(point.gazeY)} stroke="#94a3b8" strokeWidth="1.5" opacity="0.35" />
                      ))}
                      <circle cx={scaleX(plotted[0].targetX)} cy={scaleY(plotted[0].targetY)} r="8" fill="#f59e0b" />
                      <circle cx={scaleX(plotted[plotted.length - 1].targetX)} cy={scaleY(plotted[plotted.length - 1].targetY)} r="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="3" />
                    </svg>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-200">
                    <span className="flex items-center gap-2"><span className="inline-block h-1 w-6 rounded bg-amber-400" /> Butterfly path</span>
                    <span className="flex items-center gap-2"><span className="inline-block h-1 w-6 rounded bg-sky-400" /> Estimated gaze path</span>
                    <span className="flex items-center gap-2"><span className="inline-block h-1 w-6 rounded bg-slate-400" /> Separation at sampled moments</span>
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-slate-900 p-3"><p className="text-xs text-slate-400">Paired samples</p><p className="text-lg font-bold text-white">{plotted.length}</p></div>
                    <div className="rounded-xl bg-slate-900 p-3"><p className="text-xs text-slate-400">Mean target-to-gaze distance</p><p className="text-lg font-bold text-white">{meanDistance == null ? 'Not recorded' : `${Math.round(meanDistance)} px`}</p></div>
                    <div className="rounded-xl bg-slate-900 p-3"><p className="text-xs text-slate-400">Butterfly-following estimate</p><p className="text-lg font-bold text-white">{butterflyFollowPercent.length ? `${formatMetric(butterflyFollowPercent.reduce((a, b) => a + b, 0) / butterflyFollowPercent.length)}%` : 'Not recorded'}</p></div>
                  </div>
                  <p className="mt-3 text-xs text-amber-300">Distance depends on camera conditions and calibration. It describes this activity only and is not a clinical concentration score.</p>
                </>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-sm text-slate-400">
                  {sessionData.interactionMode === 'TOUCH'
                    ? 'This session used touch or mouse controls, so gaze-to-butterfly distance was not measured.'
                    : 'No paired butterfly and gaze trace was saved for this session. Older sessions recorded before this map was added cannot be reconstructed accurately.'}
                </div>
              )}
            </section>
          );
        })()}

        {/* Tab 4: ENGAGEMENT DYNAMICS */}
        {activeTab === 'ENGAGEMENT' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5">
            <h3 className="text-sm font-bold text-white mb-1">Gaze-following estimate</h3>
            <p className="text-xs text-slate-400 mb-4">
              The butterfly activity compares valid gaze samples with the moving target’s tolerant hit area.
            </p>
            <div className="rounded-xl bg-slate-950 p-6 border border-slate-800 text-sm text-slate-300">
              {sessionData.interactionMode === 'GAZE' && butterflyFollowPercent.length > 0 ? (
                <>
                  <p className="text-3xl font-bold text-emerald-300">
                    {formatMetric(
                      butterflyFollowPercent.reduce((total, value) => total + value, 0) /
                        butterflyFollowPercent.length
                    )}%
                  </p>
                  <p className="mt-2">Estimated butterfly gaze-following samples within the target area.</p>
                </>
              ) : (
                <p>
                  {sessionData.interactionMode === 'TOUCH'
                    ? 'Gaze-following was not measured because this session used touch or mouse controls.'
                    : 'No valid butterfly gaze-following estimate was recorded.'}
                </p>
              )}
              <p className="mt-3 text-xs text-amber-300">
                This is an activity-specific tracking estimate, not a measure of concentration, development, or a medical diagnosis.
              </p>
            </div>
          </div>
        )}

        {/* Tab 5: LONGITUDINAL PROGRESSION */}
        {activeTab === 'LONGITUDINAL' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5">
            <h3 className="text-sm font-bold text-white mb-1">Saved Session History</h3>
            <p className="text-xs text-slate-400 mb-4">Recorded session metadata and calibration outputs for this pseudonym.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-700 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Session Date</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3">Calibration</th>
                    <th className="py-2.5 px-3">Mean Error (px)</th>
                    <th className="py-2.5 px-3">Validity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono tabular-nums">
                  {participantSessions.map((session) => (
                    <tr key={session.sessionId} className={session.sessionId === sessionData.sessionId ? 'bg-emerald-500/10 font-bold' : ''}>
                      <td className="py-3 px-3">{new Date(session.startTime).toLocaleString()}</td>
                      <td className="py-3 px-3">{session.interactionMode}</td>
                      <td className="py-3 px-3">{session.calibrationQuality.validationStatus}</td>
                      <td className="py-3 px-3">{formatMetric(session.calibrationQuality.meanErrorPx, 1)}</td>
                      <td className="py-3 px-3">
                        {session.interactionMode === 'GAZE'
                          ? session.validSamplePercent == null
                            ? 'Not recorded'
                            : `${session.validSamplePercent}%`
                          : 'Not applicable'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 6: RAW FEATURE VECTOR F */}
        {activeTab === 'RAW_EXPORT' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-5">
            <h3 className="text-sm font-bold text-white mb-1">Recorded Session Data</h3>
            <p className="text-xs text-slate-400 mb-3">
              Unavailable measurements are null. This export does not provide validated research or clinical conclusions.
            </p>
            <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-emerald-400 border border-slate-800 max-h-96">
              {JSON.stringify(sessionData, null, 2)}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
};
