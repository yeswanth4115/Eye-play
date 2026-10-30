import React, { useState } from 'react';
import { SessionSummary } from '../../types';
import { sessionStorageService } from '../../services/sessionStorageService';

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes === 0) return `${remainingSeconds} sec`;
  return remainingSeconds === 0 ? `${minutes} min` : `${minutes} min ${remainingSeconds} sec`;
};

const getCalibrationLabel = (session: SessionSummary): string => {
  if (session.interactionMode === 'TOUCH') return 'Not needed';
  switch (session.calibrationQuality.validationStatus) {
    case 'VALIDATED':
      return 'Passed';
    case 'MARGINAL':
      return 'Try again if needed';
    case 'NOT_CALIBRATED':
      return 'Pre-trained model only';
    default:
      return 'Not recorded';
  }
};

interface ReportsHistoryScreenProps {
  onSelectSession: (session: SessionSummary) => void;
  onBackToDashboard: () => void;
  onStartNewSession: () => void;
}

export const ReportsHistoryScreen: React.FC<ReportsHistoryScreenProps> = ({
  onSelectSession,
  onBackToDashboard,
  onStartNewSession,
}) => {
  const [sessions, setSessions] = useState<SessionSummary[]>(sessionStorageService.getAllSessions());
  const [modeFilter, setModeFilter] = useState<'ALL' | 'GAZE' | 'TOUCH'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = sessions.filter((s) => {
    const matchesMode = modeFilter === 'ALL' || s.interactionMode === modeFilter;
    const matchesQuery =
      !searchQuery ||
      s.childProfile.pseudonym.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sessionId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMode && matchesQuery;
  });

  const handleExportCsv = () => {
    const csv = sessionStorageService.exportSessionsAsCsv(filteredSessions);
    sessionStorageService.downloadFile(csv, `eyeplay_sessions_${Date.now()}.csv`, 'text/csv');
  };

  const handleExportJson = () => {
    const json = sessionStorageService.exportSessionsAsJson(filteredSessions);
    sessionStorageService.downloadFile(json, `eyeplay_sessions_${Date.now()}.json`, 'application/json');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this session record permanently from this device?')) {
      sessionStorageService.deleteSession(id);
      setSessions(sessionStorageService.getAllSessions());
    }
  };

  const handleClearAll = () => {
    if (
      window.confirm(
        'Are you sure you want to delete all saved session data from local storage? This cannot be undone.'
      )
    ) {
      sessionStorageService.clearAllSessions();
      setSessions([]);
    }
  };

  return (
    <div className="relative z-10 flex h-full w-full flex-col p-4 sm:p-8 bg-slate-900 text-slate-100 select-none overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-xl font-bold text-emerald-400 border border-emerald-500/20">
              📂
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white font-['Quicksand']">
                Session History & Reports
              </h1>
              <p className="text-xs text-slate-400">
                Saved on this device. Open a simple report, or download the detailed data.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredSessions.length === 0}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-40"
            >
              Download data (CSV) 📊
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              disabled={filteredSessions.length === 0}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-40"
            >
              Download data (JSON) 💾
            </button>
            <button
              type="button"
              onClick={onBackToDashboard}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
            >
              ← Adult Dashboard
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-slate-800/40 p-4 border border-slate-800">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by player code…"
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none w-64"
            />
            <div className="flex items-center gap-1 rounded-xl bg-slate-900 p-1 border border-slate-700 text-xs">
              {(['ALL', 'GAZE', 'TOUCH'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setModeFilter(mode)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer transition-colors ${
                    modeFilter === mode ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              Showing <strong className="text-white">{filteredSessions.length}</strong> of {sessions.length} sessions
            </span>
            {sessions.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs text-rose-400 hover:underline cursor-pointer"
              >
                Clear All Data
              </button>
            )}
          </div>
        </div>

        {/* Sessions Table */}
        <div className="rounded-2xl border border-slate-800 bg-slate-800/20 p-5">
          {filteredSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center text-slate-500 text-xs">
              <p className="text-base font-semibold text-slate-400 mb-1">No sessions match your filter</p>
              <p className="mb-4">Start an Eye-play session to record gaze or touch interaction data.</p>
              <button
                type="button"
                onClick={onStartNewSession}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
              >
                Start Play Session
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-700 text-slate-400 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-3">Date & Time</th>
                    <th className="py-3 px-3">Player</th>
                    <th className="py-3 px-3">How they played</th>
                    <th className="py-3 px-3">Play time</th>
                    <th className="py-3 px-3">Camera tracking</th>
                    <th className="py-3 px-3">Gaze check</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 tabular-nums">
                  {filteredSessions.map((session) => (
                    <tr key={session.sessionId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 text-slate-400">
                        {new Date(session.startTime).toLocaleDateString()} {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3 font-bold text-white">
                        {session.childProfile.pseudonym}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            session.interactionMode === 'GAZE'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {session.interactionMode === 'GAZE' ? 'Camera' : 'Touch / mouse'}
                        </span>
                      </td>
                      <td className="py-3 px-3">{formatDuration(session.durationSeconds)}</td>
                      <td className="py-3 px-3 text-emerald-400 font-semibold">
                        {session.interactionMode === 'GAZE' && session.validSamplePercent != null
                          ? `${session.validSamplePercent}% of frames`
                          : session.interactionMode === 'TOUCH'
                          ? 'Not used'
                          : 'Not recorded'}
                      </td>
                      <td className="py-3 px-3">{getCalibrationLabel(session)}</td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => onSelectSession(session)}
                          className="rounded-lg bg-emerald-600/30 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-600/50 cursor-pointer"
                        >
                          Open report
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(session.sessionId)}
                          aria-label={`Delete session for ${session.childProfile.pseudonym}`}
                          className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-2 py-1 text-[11px] text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
