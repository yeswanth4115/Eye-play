/**
 * EyePlay System Tests & Acceptance Criteria Verification
 * Runs automated verification of core pipelines:
 * 1. GazePipeline honest tracking & missing data handling
 * 2. Calibration holdout validation & failure detection
 * 3. Touch mode accessibility isolation
 * 4. Voice guidance state, anti-overlap, and captions
 * 5. Session persistence, privacy deletion, and research CSV/JSON exports
 * 6. Research evaluation scoring (Part A, B, C) and consistency checks
 */

import { GazePipeline } from '../services/gazePipeline';
import { voiceGuidance, STANDARD_VOICE_STEPS } from '../services/voiceGuidanceService';
import { sessionStorageService } from '../services/sessionStorageService';
import {
  createDefaultEvaluation,
  researchEvaluationService,
} from '../services/researchEvaluationService';
import { extractFourEyeFeatures, type EyeLandmark } from '../services/socialRobotGazeFeatures';
import { KalmanGazeFilter2D } from '../services/kalmanFilter';
import { SessionSummary, HeadPose, InteractionMode } from '../types';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    testsFailed++;
  }
}

console.log('\n=== RUNNING EYEPLAY AUTOMATED VERIFICATION SUITE ===\n');

// TEST SUITE 1: Gaze Pipeline & Honest Missing Data Handling
console.log('--- Suite 1: Gaze Pipeline & Missing Data Handling ---');
const syntheticLandmarks: EyeLandmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
for (const index of [468, 469, 470, 471, 472]) syntheticLandmarks[index] = { x: 0.36, y: 0.39 };
for (const index of [473, 474, 475, 476, 477]) syntheticLandmarks[index] = { x: 0.64, y: 0.41 };
syntheticLandmarks[33] = { x: 0.3, y: 0.4 };
syntheticLandmarks[133] = { x: 0.4, y: 0.4 };
syntheticLandmarks[362] = { x: 0.6, y: 0.4 };
syntheticLandmarks[263] = { x: 0.7, y: 0.4 };
const eyeFeatures = extractFourEyeFeatures(syntheticLandmarks);
assert(eyeFeatures !== null && eyeFeatures.length === 4, 'Social robot gaze extractor returns exactly four features');
assert(
  eyeFeatures !== null &&
    Math.abs(eyeFeatures[0] - 0.1) < 1e-9 &&
    Math.abs(eyeFeatures[1] + 0.1) < 1e-9 &&
    Math.abs(eyeFeatures[2] + 0.1) < 1e-9 &&
    Math.abs(eyeFeatures[3] - 0.1) < 1e-9,
  'Four eye features match the upstream iris-to-eye normalization'
);
assert(extractFourEyeFeatures(syntheticLandmarks.slice(0, 477)) === null, 'Incomplete eye landmarks are rejected');
const pipeline = new GazePipeline();
pipeline.interactionMode = 'GAZE';

const neutralHeadPose: HeadPose = {
  yaw: 0,
  pitch: 0,
  roll: 0,
  distanceCm: 50,
  isStable: true,
  isGated: false,
};

// 1.1: Missing input should yield an invalid MISSING event, never synthetic coordinates
const sampleNull = pipeline.processSample(null, neutralHeadPose, 0.28, 0.9, 1000);
assert(!sampleNull.isValid, 'Null camera frame yields isValid = false');
assert(sampleNull.event === 'MISSING', 'Null camera frame produces MISSING event');
assert(sampleNull.x === 0 && sampleNull.y === 0, 'No synthetic coordinates fabricated on missing frame');

// 1.2: Extreme head pose gating
const extremeHeadPose: HeadPose = {
  yaw: 35, // > 30 degrees limit
  pitch: 0,
  roll: 0,
  distanceCm: 50,
  isStable: false,
  isGated: true,
};
const sampleExtremeHead = pipeline.processSample({ x: 500, y: 300 }, extremeHeadPose, 0.28, 0.9, 1033);
assert(!sampleExtremeHead.isValid, 'Head pose > 30° yaw is gated and marked invalid');
assert(sampleExtremeHead.event === 'MISSING', 'Gated head pose produces MISSING event');

// 1.3: Blink detection (EAR < 0.16)
const sampleBlink = pipeline.processSample({ x: 500, y: 300 }, neutralHeadPose, 0.12, 0.9, 1066);
assert(!sampleBlink.isValid, 'Blink with EAR < 0.16 is marked invalid');

// 1.4: Valid gaze frame
const sampleValid = pipeline.processSample({ x: 500, y: 300 }, neutralHeadPose, 0.28, 0.9, 1200);
assert(sampleValid.isValid, 'Normal eye parameters yield valid gaze sample');
assert(sampleValid.x > 0 && sampleValid.y > 0, 'Valid sample has coordinates');
const smoothFilter = new KalmanGazeFilter2D(450, 300, 220);
smoothFilter.update(100, 100, 1000);
const smoothedStep = smoothFilter.update(160, 160, 1050);
assert(
  smoothedStep.x > 100 && smoothedStep.x < 160 && smoothedStep.y > 100 && smoothedStep.y < 160,
  'Gaze filter softens small frame-to-frame jumps instead of snapping'
);

// TEST SUITE 2: Calibration Validation & Rejection of Poor Fits
console.log('\n--- Suite 2: Calibration Validation Quality Checks ---');
// 2.1: Calibration with high error holdouts must FAIL validation
const badHoldouts = [
  { targetX: 200, targetY: 200, rawX: 600, rawY: 600, yaw: 0, pitch: 0 },
  { targetX: 800, targetY: 200, rawX: 100, rawY: 800, yaw: 0, pitch: 0 },
];
const badSamples = [
  { targetX: 500, targetY: 500, rawX: 520, rawY: 490, yaw: 0, pitch: 0 },
  { targetX: 300, targetY: 300, rawX: 310, rawY: 290, yaw: 0, pitch: 0 },
  { targetX: 700, targetY: 300, rawX: 710, rawY: 310, yaw: 0, pitch: 0 },
  { targetX: 300, targetY: 700, rawX: 310, rawY: 690, yaw: 0, pitch: 0 },
  { targetX: 700, targetY: 700, rawX: 690, rawY: 710, yaw: 0, pitch: 0 },
];
const failedModel = pipeline.fitCalibrationModel(badSamples, badHoldouts);
assert(!failedModel.isValidated, 'Calibration with high holdout errors is rejected (isValidated = false)');
assert(failedModel.meanAngularErrorDeg > 3.8, 'Calculates genuine angular error (> 3.8°)');

// 2.2: Calibration with close holdouts passes validation
const goodHoldouts = [
  { targetX: 350, targetY: 350, rawX: 355, rawY: 352, yaw: 0, pitch: 0 },
  { targetX: 650, targetY: 350, rawX: 652, rawY: 348, yaw: 0, pitch: 0 },
];
const passedModel = pipeline.fitCalibrationModel(badSamples, goodHoldouts);
assert(passedModel.isValidated, 'Accurate calibration holdouts pass validation');
assert(
  passedModel.polyCoeffsX.every(Number.isFinite) && passedModel.polyCoeffsY.every(Number.isFinite),
  'Calibration fits finite screen-mapping coefficients from gaze samples'
);
assert(pipeline.isGazeInAOI(100, 100, 200, 100, 50), 'AOI hit test allows a practical gaze-error margin');
assert(!pipeline.isGazeInAOI(80, 100, 200, 100, 50), 'AOI hit test still rejects gaze well outside its tolerance radius');
pipeline.setCalibrationModel(failedModel);
assert(
  !pipeline.isGazeInAOI(80, 100, 200, 100, 50),
  'An unvalidated calibration error does not create an excessively large hit radius'
);
pipeline.setCalibrationModel(null);

// TEST SUITE 3: Touch Mode Isolation
console.log('\n--- Suite 3: Touch Mode Accessibility Isolation ---');
const touchPipeline = new GazePipeline();
touchPipeline.interactionMode = 'TOUCH';
touchPipeline.setTouchPoint(420, 280);
const touchSample = touchPipeline.processSample(null, neutralHeadPose, 0.28, 1.0, 2000);
assert(touchSample.isValid, 'Touch mode processes direct touch without requiring camera landmarks');
assert(touchSample.x === 420 && touchSample.y === 280, 'Touch coordinates matched accurately');

// TEST SUITE 4: Voice Guidance & Captions Service
console.log('\n--- Suite 4: Voice Guidance Service ---');
voiceGuidance.updateConfig({ enabled: true, rate: 0.85, volume: 0.9, showCaptions: true });
assert(voiceGuidance.config.rate === 0.85, 'Voice guidance config rate persisted');
assert(voiceGuidance.config.showCaptions === true, 'Subtitles/Captions enabled');

let receivedCaption = '';
const unsub = voiceGuidance.subscribe(({ currentCaption }) => {
  receivedCaption = currentCaption;
});
voiceGuidance.speak(STANDARD_VOICE_STEPS.WELCOME);
assert(
  receivedCaption === STANDARD_VOICE_STEPS.WELCOME.textEn,
  'Subscribed caption matches the child-friendly welcome instruction'
);
unsub();

// TEST SUITE 5: Session Storage, Privacy, and Research Data Exports
console.log('\n--- Suite 5: Session Storage & Research Data Exports ---');
const mockSession: SessionSummary = {
  sessionId: `TEST_SESSION_${Date.now()}`,
  reportDataVersion: 2,
  childProfile: {
    pseudonym: 'Participant-T1',
    ageYears: 7,
    viewingDistanceCm: 50,
    screenWidthCm: 34,
    screenHeightCm: 21,
    theme: 'meadow',
    sensorySafe: true,
    audioConsent: true,
    language: 'en',
    interactionMode: 'GAZE',
  },
  caregiverSettings: {
    maxSessionLengthMin: 10,
    dwellTimeThresholdMs: 500,
    minFixationDurationMs: 100,
    ivtVelocityThresholdDeg: 30,
    restPauseDurationSec: 15,
    driftCorrectionGain: 0.05,
    showGazeCursor: true,
    enableCalibration: false,
    simulateGaze: false,
    simulationNoiseLevel: 12,
    interactionMode: 'GAZE',
    voiceConfig: voiceGuidance.config,
  },
  interactionMode: 'GAZE',
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  durationSeconds: 180,
  totalFrames: 5400,
  validGazeFrames: 4950,
  validSamplePercent: 92,
  faceLostCount: 3,
  calibrationQuality: {
    meanErrorDeg: null,
    medianErrorDeg: null,
    meanErrorPx: null,
    validationStatus: 'FAILED',
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
  limitationsAndContext: ['Observational research data only; not a diagnosis.'],
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
};

const csvOutput = sessionStorageService.exportSessionsAsCsv([mockSession]);
assert(csvOutput.includes('Participant-T1'), 'CSV export contains pseudonymous participant ID');
assert(csvOutput.includes('GAZE'), 'CSV export records interaction mode');
assert(csvOutput.includes('Mean_Angular_Error_Deg'), 'CSV export includes calibration error headers');
assert(csvOutput.split('\n')[1].split(',')[12] === '', 'CSV leaves unavailable engagement metrics blank');

const jsonOutput = sessionStorageService.exportSessionsAsJson([mockSession]);
assert(jsonOutput.includes('Participant-T1'), 'JSON export serializes complete session object');
assert(jsonOutput.includes('"overallEngagementIndex": null'), 'JSON preserves unavailable metrics as null');

// TEST SUITE 6: Research Evaluation Protocol (Section 9)
console.log('\n--- Suite 6: Research Evaluation Workflows (Parts A, B, C) ---');
const evalRecord = createDefaultEvaluation('Participant-T1', mockSession.sessionId);
assert(evalRecord.partA.totalScore === null, 'Unanswered evaluation starts without a score');
assert(evalRecord.partC.likertRatings.clarity === 0, 'Unanswered feedback starts without a rating');
assert(evalRecord.partC.openResponses.researcherNotes === '', 'Research notes are not prefilled with synthetic observations');

// Answer Part A questions correctly
evalRecord.partA.scenarios.forEach((s) => {
  const correct = s.options.find((o) => o.isCorrect);
  if (correct) s.selectedOptionId = correct.id;
  s.confidence = 4;
});

// Part B case decisions
evalRecord.partB.cases[0].selectedDecision = 'Reduce target motion speed and offer a larger target';
evalRecord.partB.cases[1].selectedDecision = 'Reduce target speed and allow more time';

researchEvaluationService.saveEvaluation(evalRecord);
assert(evalRecord.partA.totalScore === 5, 'Part A scoring computes 5/5 on correct criteria');
assert(evalRecord.partB.consistencyScore === 100, 'Part B evaluates 100% decision consistency on difficulty reduction');

const evalCsv = researchEvaluationService.exportEvaluationsAsCsv([evalRecord]);
assert(evalCsv.includes('PartA_Correct_Answered'), 'Evaluation CSV includes Part A and Part B research columns');

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log(`========================================\n`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
