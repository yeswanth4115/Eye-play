/**
 * Session Storage & Privacy Management Service for EyePlay
 * Persists pseudonymous sessions, manages data export, deletion,
 * and handles research records safely.
 */

import { SessionSummary, ChildProfile } from '../types';

const SESSIONS_STORAGE_KEY = 'eyeplay_saved_sessions_v1';
const PARTICIPANTS_KEY = 'eyeplay_saved_participants_v1';

class SessionStorageService {
  public getAllSessions(): SessionSummary[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data) as SessionSummary[];
      return Array.isArray(parsed) ? parsed.map((session) => this.normalizeLegacySession(session)) : [];
    } catch (e) {
      console.warn('[SessionStorage] Error reading sessions:', e);
      return [];
    }
  }

  public getSessionById(sessionId: string): SessionSummary | null {
    const all = this.getAllSessions();
    return all.find((s) => s.sessionId === sessionId) || null;
  }

  public saveSession(session: SessionSummary): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const all = this.getAllSessions();
      // Prepend so latest is first
      const updated = [session, ...all.filter((s) => s.sessionId !== session.sessionId)];
      // Keep up to 50 sessions locally
      const trimmed = updated.slice(0, 50);
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(trimmed));

      // Save participant to known list
      this.saveParticipant(session.childProfile);
      return true;
    } catch (e) {
      console.warn('[SessionStorage] Quota exceeded or error saving session:', e);
      return false;
    }
  }

  public deleteSession(sessionId: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const all = this.getAllSessions();
      const filtered = all.filter((s) => s.sessionId !== sessionId);
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch (e) {
      console.warn('[SessionStorage] Error deleting session:', e);
      return false;
    }
  }

  public clearAllSessions(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      localStorage.removeItem(SESSIONS_STORAGE_KEY);
      return true;
    } catch (e) {
      console.warn('[SessionStorage] Error clearing sessions:', e);
      return false;
    }
  }

  public clearAllLocalData(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      localStorage.removeItem(SESSIONS_STORAGE_KEY);
      localStorage.removeItem(PARTICIPANTS_KEY);
      return true;
    } catch (e) {
      console.warn('[SessionStorage] Error clearing local data:', e);
      return false;
    }
  }

  public getSavedParticipants(): ChildProfile[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(PARTICIPANTS_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  public saveParticipant(profile: ChildProfile) {
    if (typeof window === 'undefined') return;
    try {
      const all = this.getSavedParticipants();
      const filtered = all.filter((p) => p.pseudonym !== profile.pseudonym);
      localStorage.setItem(PARTICIPANTS_KEY, JSON.stringify([profile, ...filtered].slice(0, 20)));
    } catch {
      // Ignore
    }
  }

  public exportSessionsAsCsv(sessions: SessionSummary[]): string {
    const headers = [
      'Session_ID',
      'Start_Time',
      'End_Time',
      'Duration_Seconds',
      'Participant_Pseudonym',
      'Participant_Age',
      'Interaction_Mode',
      'Valid_Sample_Percent',
      'Face_Lost_Count',
      'Calibration_Status',
      'Mean_Angular_Error_Deg',
      'Mean_Pixel_Error_Px',
      'Overall_Engagement_Index',
      'Pursuit_Mean_Gain',
      'Pursuit_RMS_Error_Px',
      'AOI_Time_To_First_Fixation_Ms',
      'AOI_Total_Hits',
      'Social_Face_Looking_Percent',
      'Auditory_Accuracy_Percent',
      'Auditory_Latency_Ms',
      'Device_Platform',
      'Device_Screen_Width',
      'Device_Screen_Height',
    ];

    const rows = sessions.map((s) => [
      `"${s.sessionId}"`,
      `"${s.startTime}"`,
      `"${s.endTime}"`,
      s.durationSeconds,
      `"${s.childProfile.pseudonym}"`,
      s.childProfile.ageYears,
      `"${s.interactionMode}"`,
      s.validSamplePercent ?? '',
      s.faceLostCount,
      `"${s.calibrationQuality.validationStatus}"`,
      s.calibrationQuality.meanErrorDeg ?? '',
      s.calibrationQuality.meanErrorPx ?? '',
      s.overallEngagementIndex?.toFixed(3) ?? '',
      s.pursuitMetrics.meanGain?.toFixed(2) ?? '',
      s.pursuitMetrics.meanRmsErrorPx ?? '',
      s.aoiMetrics.meanTimeToFirstFixationMs ?? '',
      s.aoiMetrics.totalTargetHits ?? '',
      s.socialAttentionMetrics.faceLookingPercent ?? '',
      s.auditoryMetrics.commandAccuracyPercent ?? '',
      s.auditoryMetrics.meanResponseLatencyMs ?? '',
      `"${s.deviceMetadata?.platform || 'Unknown'}"`,
      s.deviceMetadata?.screenWidth || (typeof window !== 'undefined' ? window.innerWidth : 1440),
      s.deviceMetadata?.screenHeight || (typeof window !== 'undefined' ? window.innerHeight : 900),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  public exportSessionsAsJson(sessions: SessionSummary[]): string {
    return JSON.stringify(sessions, null, 2);
  }

  public downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private normalizeLegacySession(session: SessionSummary): SessionSummary {
    if (session.reportDataVersion >= 2) return session;

    return {
      ...session,
      reportDataVersion: 2,
      validSamplePercent: session.interactionMode === 'GAZE' ? session.validSamplePercent : null,
      calibrationQuality: {
        ...session.calibrationQuality,
        meanErrorDeg: null,
        medianErrorDeg: null,
        meanErrorPx: null,
      },
      overallEngagementIndex: null,
      fixationCount: null,
      saccadeCount: null,
      smoothPursuitCount: null,
      pursuitMetrics: { meanGain: null, meanRmsErrorPx: null, meanLagMs: null },
      aoiMetrics: {
        meanTimeToFirstFixationMs: null,
        meanDwellTimeMs: null,
        totalTargetHits: null,
        totalDistractorLooks: null,
      },
      socialAttentionMetrics: {
        faceLookingPercent: null,
        eyesLookingPercent: null,
        objectLookingPercent: null,
        jointAttentionSuccessRate: null,
      },
      auditoryMetrics: {
        commandAccuracyPercent: null,
        meanResponseLatencyMs: null,
        repeatedPromptsCount: null,
      },
      clinicalObservations: [],
      limitationsAndContext: [
        ...session.limitationsAndContext,
        'Legacy prototype-derived measurements were withheld because their measurement provenance is not validated.',
      ],
      featureVectorF: {
        meanFixationDurationMs: null,
        meanSaccadeAmplitudeDeg: null,
        gazeDispersionPx: null,
        pursuitGain: null,
        timeToFirstFixationMs: null,
        aoiDwellRatio: null,
        socialFaceLookingPercent: null,
        vocalResponseLatencyMs: null,
        auditoryAccuracyRate: null,
        missingDataPercent: null,
      },
      trials: session.trials?.map((trial) => ({
        ...trial,
        timeToFirstFixationMs: null,
        dwellTimeMs: null,
        targetHitCount: null,
        distractorFixationCount: null,
        pursuitGain: null,
        pursuitLagMs: null,
        pursuitRmsErrorPx: null,
        audioLatencyMs: null,
        audioAccuracy: null,
        socialLookingPercent: null,
        avgEngagement: null,
      })),
    };
  }
}

export const sessionStorageService = new SessionStorageService();
