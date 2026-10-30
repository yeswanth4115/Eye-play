export type EventType = 'FIXATION' | 'SACCADE' | 'PURSUIT' | 'MISSING';

export interface GazePoint {
  x: number;
  y: number;
  rawX: number;
  rawY: number;
  timestamp: number;
  confidence: number;
  isValid: boolean;
  event: EventType;
  velocityDegPerSec: number;
  pupilDilation?: number;
}

export interface HeadPose {
  yaw: number; // degrees (- to left, + to right)
  pitch: number; // degrees (- up, + down)
  roll: number; // degrees
  distanceCm: number;
  isStable: boolean;
  isGated: boolean;
}

export interface CalibrationTarget {
  id: number;
  x: number;
  y: number;
  screenPercentX: number;
  screenPercentY: number;
  isHoldout?: boolean;
}

export interface CalibrationSample {
  targetId: number;
  targetX: number;
  targetY: number;
  rawGazeX: number;
  rawGazeY: number;
  headYaw: number;
  headPitch: number;
  timestamp: number;
}

export interface CalibrationModel {
  polyCoeffsX: number[];
  polyCoeffsY: number[];
  headPoseWeightX: number;
  headPoseWeightY: number;
  meanAngularErrorDeg: number;
  medianAngularErrorDeg: number;
  meanPixelError: number;
  isValidated: boolean;
  timestamp: number;
}

export interface EngagementWindowMetrics {
  timestamp: number;
  engagementIndex: number; // 0 to 1
  fixationRatio: number;
  gazeStability: number;
  aoiRatio: number;
  validSampleRate: number;
  isReliable: boolean;
}

export type GameId = 'BUTTERFLY' | 'SPOT_IT' | 'LOOK_HERE' | 'MAZE' | 'LISTEN_DO';

export interface AOIRegion {
  id: string;
  label: string;
  type: 'TARGET' | 'DISTRACTOR' | 'FACE' | 'EYES' | 'MOUTH' | 'OBJECT';
  x: number;
  y: number;
  radius?: number;
  width?: number;
  height?: number;
}

export interface ButterflyTracePoint {
  timestamp: number;
  targetX: number;
  targetY: number;
  gazeX: number;
  gazeY: number;
  confidence: number;
}

export interface TrialMetric {
  gameId: GameId;
  trialNumber: number;
  startTime: number;
  endTime: number;
  durationMs: number;
  success: boolean;
  timeToFirstFixationMs: number | null;
  dwellTimeMs: number | null;
  targetHitCount: number | null;
  distractorFixationCount: number | null;
  pursuitGain?: number | null;
  pursuitLagMs?: number | null;
  pursuitRmsErrorPx?: number | null;
  gazeFollowPercent?: number | null;
  /** Paired target/gaze coordinates captured during butterfly pursuit; never synthesized. */
  butterflyTrace?: ButterflyTracePoint[];
  audioLatencyMs?: number | null;
  audioAccuracy?: boolean | null;
  promptRepeats?: number | null;
  socialLookingPercent?: number | null;
  avgEngagement: number | null;
  gazePoints: GazePoint[];
}

export type InteractionMode = 'GAZE' | 'TOUCH';

export type AppSection =
  | 'WELCOME'
  | 'PROFILE_SETUP'
  | 'READINESS_CHECK'
  | 'CALIBRATION'
  | 'ACTIVITIES'
  | 'COMPLETION_FEEDBACK'
  | 'ADULT_DASHBOARD'
  | 'REPORTS_HISTORY'
  | 'SETTINGS'
  | 'PRIVACY_HELP'
  | 'RESEARCH_EVAL'
  | 'REST';

export interface DeviceBrowserMetadata {
  userAgent: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  hasCamera: boolean;
  cameraLabel?: string;
  touchScreen: boolean;
  timestamp: string;
}

export interface TrackingQualityState {
  faceDetected: boolean;
  faceConfidence: number;
  trackingConfidence: number;
  eyeOpenness: number;
  isBlinking: boolean;
  headPose: HeadPose;
  lightingQuality: 'good' | 'low' | 'harsh' | 'unknown';
  qualityIssue?: 'NO_FACE' | 'HEAD_TURNED' | 'EYES_CLOSED' | 'POOR_LIGHTING' | 'MOTION_BLUR';
  actionableFeedback?: string;
  fps: number;
}

export interface VoiceGuidanceConfig {
  enabled: boolean;
  language: 'en' | 'ta';
  volume: number; // 0.0 - 1.0
  rate: number; // 0.6 - 1.5
  pitch: number; // 0.8 - 1.4
  voiceName?: string;
  showCaptions: boolean;
}

export interface ChildSessionFeedback {
  feeling: 'loved_it' | 'happy' | 'tired' | 'confused' | 'stop_now';
  starsEarned: number;
  childComments?: string;
}

export interface ChildProfile {
  pseudonym: string;
  ageYears: number;
  sessionNotes?: string;
  viewingDistanceCm: number;
  screenWidthCm: number;
  screenHeightCm: number;
  theme: 'meadow' | 'space' | 'safari';
  sensorySafe: boolean;
  audioConsent: boolean;
  language: 'en' | 'ta';
  interactionMode?: InteractionMode;
}

export interface CaregiverSettings {
  maxSessionLengthMin: number;
  dwellTimeThresholdMs: number;
  minFixationDurationMs: number;
  ivtVelocityThresholdDeg: number;
  restPauseDurationSec: number;
  driftCorrectionGain: number;
  showGazeCursor: boolean;
  enableCalibration: boolean;
  simulateGaze: boolean;
  simulationNoiseLevel: number;
  interactionMode: InteractionMode;
  voiceConfig: VoiceGuidanceConfig;
}

export interface SessionSummary {
  sessionId: string;
  reportDataVersion: number;
  childProfile: ChildProfile;
  caregiverSettings: CaregiverSettings;
  interactionMode: InteractionMode;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  totalFrames: number;
  validGazeFrames: number;
  validSamplePercent: number | null;
  faceLostCount: number;
  missingDataIntervalsCount?: number;
  calibrationQuality: {
    meanErrorDeg: number | null;
    medianErrorDeg: number | null;
    meanErrorPx: number | null;
    pointsTested?: number;
    validationStatus: 'VALIDATED' | 'MARGINAL' | 'FAILED' | 'NOT_CALIBRATED' | 'SKIPPED_TOUCH_MODE';
  };
  deviceMetadata?: DeviceBrowserMetadata;
  childFeedback?: ChildSessionFeedback;
  overallEngagementIndex: number | null;
  fixationCount: number | null;
  saccadeCount: number | null;
  smoothPursuitCount: number | null;
  pursuitMetrics: {
    meanGain: number | null;
    meanRmsErrorPx: number | null;
    meanLagMs: number | null;
  };
  aoiMetrics: {
    meanTimeToFirstFixationMs: number | null;
    meanDwellTimeMs: number | null;
    totalTargetHits: number | null;
    totalDistractorLooks: number | null;
  };
  socialAttentionMetrics: {
    faceLookingPercent: number | null;
    eyesLookingPercent: number | null;
    objectLookingPercent: number | null;
    jointAttentionSuccessRate: number | null;
  };
  auditoryMetrics: {
    commandAccuracyPercent: number | null;
    meanResponseLatencyMs: number | null;
    repeatedPromptsCount: number | null;
  };
  clinicalObservations: string[];
  limitationsAndContext: string[];
  featureVectorF: {
    meanFixationDurationMs: number | null;
    meanSaccadeAmplitudeDeg: number | null;
    gazeDispersionPx: number | null;
    pursuitGain: number | null;
    timeToFirstFixationMs: number | null;
    aoiDwellRatio: number | null;
    socialFaceLookingPercent: number | null;
    vocalResponseLatencyMs: number | null;
    auditoryAccuracyRate: number | null;
    missingDataPercent: number | null;
  };
  trials?: TrialMetric[];
}

// Section 9: Research Evaluation Types
export interface EvaluationPartA {
  // Report understanding
  scenarios: {
    id: string;
    question: string;
    context: string;
    metricRef: string;
    options: { id: string; label: string; isCorrect: boolean }[];
    selectedOptionId: string | null;
    confidence: number | null; // 1 to 5 scale
    isCorrect?: boolean | null;
    explanation: string;
  }[];
  answeredCount: number;
  totalScore: number | null;
  averageConfidence: number | null;
  calibrationGap: number | null; // difference between accuracy% and confidence%
}

export interface EvaluationPartB {
  // Activity adjustment decisions
  cases: {
    id: string;
    caseDescription: string;
    observedMetricSummary: string;
    decisionOptions: string[];
    selectedDecision: string | null;
    reasoning: string;
    uncertaintyExpressed: boolean;
    additionalInfoRequested: string;
    rubricScore: number | null; // Researcher-entered 0 to 4 rubric
    consistencyGroup: string; // group to check consistency across comparable scenarios
  }[];
  consistencyScore: number | null;
  overallRubricTotal: number | null;
}

export interface EvaluationPartC {
  // Adult feedback questionnaires
  likertRatings: {
    clarity: number; // 1-5
    activityAdjustmentUsefulness: number; // 1-5
    trustInMetrics: number; // 1-5
    childUsability: number; // 1-5
    transparencyOfLimitations: number; // 1-5
  };
  openResponses: {
    perceivedStrengths: string;
    perceivedRisksOrMisunderstandings: string;
    suggestedImprovements: string;
    researcherNotes: string;
  };
  submittedAt: string;
}

export interface AdultEvaluationRecord {
  id: string;
  sessionId?: string;
  participantPseudonym: string;
  evaluatorRole: 'Caregiver' | 'Researcher' | 'Clinician' | 'Educator';
  timestamp: string;
  partA: EvaluationPartA;
  partB: EvaluationPartB;
  partC: EvaluationPartC;
}
