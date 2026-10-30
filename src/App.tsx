/**
 * Eye-play — a child-friendly visual-attention activity platform.
 * Child-friendly gaze-estimation and visual-attention activity platform.
 * Supports laptop/phone webcams, browser-native MediaPipe FaceLandmarker,
 * accessible Touch Mode fallback, voice guidance, and adult research reporting.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GazePoint,
  HeadPose,
  GameId,
  TrialMetric,
  AOIRegion,
  ChildProfile,
  CaregiverSettings,
  SessionSummary,
  CalibrationModel,
  AppSection,
  InteractionMode,
  TrackingQualityState,
  ChildSessionFeedback,
} from './types';

// Services
import { gazePipeline } from './services/gazePipeline';
import { soundService } from './services/soundEffects';
import { cameraService } from './services/cameraService';
import { visionService } from './services/visionService';
import { socialRobotGazeService } from './services/socialRobotGazeService';
import { voiceGuidance, STANDARD_VOICE_STEPS } from './services/voiceGuidanceService';
import { sessionStorageService } from './services/sessionStorageService';
import { calibrationStorageService } from './services/calibrationStorageService';

// Screens & Components
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { ProfileSetupScreen } from './components/screens/ProfileSetupScreen';
import { ReadinessCheckScreen } from './components/screens/ReadinessCheckScreen';
import { CalibrationGame } from './components/calibration/CalibrationGame';
import { SessionCompletionScreen } from './components/screens/SessionCompletionScreen';
import { AdultDashboardScreen } from './components/screens/AdultDashboardScreen';
import { ReportsHistoryScreen } from './components/screens/ReportsHistoryScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { PrivacyConsentHelpScreen } from './components/screens/PrivacyConsentHelpScreen';
import { ResearchEvaluationView } from './components/research/ResearchEvaluationView';

// Mini-Games
import { FollowButterflyGame } from './components/games/FollowButterflyGame';
import { SpotItGame } from './components/games/SpotItGame';
import { JointAttentionGame } from './components/games/JointAttentionGame';
import { GazeMazeGame } from './components/games/GazeMazeGame';
import { ListenDoGame } from './components/games/ListenDoGame';

// Overlays & Modals
import { RestScreenOverlay } from './components/safety/RestScreenOverlay';
import { ClinicianReportView } from './components/report/ClinicianReportView';
import { CaregiverModal } from './components/caregiver/CaregiverModal';

const GAME_INITIAL_TIME_LIMIT_MS = 30_000;
const GAME_MAX_TIME_LIMIT_MS = 45_000;
const GAME_EXTENSION_FOLLOW_RATIO = 0.2;
const GAME_SEQUENCE: GameId[] = ['BUTTERFLY', 'SPOT_IT', 'LOOK_HERE', 'MAZE', 'LISTEN_DO'];

export default function App() {
  const [currentSection, setCurrentSection] = useState<AppSection>('WELCOME');
  const [currentGameId, setCurrentGameId] = useState<GameId>('BUTTERFLY');
  const [restReason, setRestReason] = useState<'SESSION_TIMEOUT' | 'CAREGIVER_PAUSE'>('CAREGIVER_PAUSE');

  // Child Profile State
  const [profile, setProfile] = useState<ChildProfile>({
    pseudonym: '',
    ageYears: 6,
    viewingDistanceCm: 50,
    screenWidthCm: 34,
    screenHeightCm: 21,
    theme: 'meadow',
    sensorySafe: false,
    audioConsent: true,
    language: 'en',
    interactionMode: 'GAZE',
  });

  // Caregiver & System Settings
  const [settings, setSettings] = useState<CaregiverSettings>({
    maxSessionLengthMin: 5,
    dwellTimeThresholdMs: 500,
    minFixationDurationMs: 100,
    ivtVelocityThresholdDeg: 30,
    restPauseDurationSec: 15,
    driftCorrectionGain: 0.05,
    showGazeCursor: false,
    enableCalibration: false,
    simulateGaze: false,
    simulationNoiseLevel: 12,
    interactionMode: 'GAZE',
    voiceConfig: voiceGuidance.config,
  });

  const [isCaregiverModalOpen, setIsCaregiverModalOpen] = useState(false);
  const [selectedFirstGameId, setSelectedFirstGameId] = useState<GameId>('BUTTERFLY');

  // Video and Vision pipeline
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [liveGaze, setLiveGaze] = useState<GazePoint | null>(null);
  const [trackingQuality, setTrackingQuality] = useState<TrackingQualityState | null>(null);
  const gazeCursorRef = useRef<HTMLDivElement | null>(null);
  const gazeCursorIdleTimeoutRef = useRef<number | null>(null);
  const lastGazeCursorPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Activity HUD (throttled to avoid frame-rate re-render stutter)
  const [activeAOIs, setActiveAOIs] = useState<AOIRegion[]>([]);
  const [hudFps, setHudFps] = useState<number | null>(null);
  const [hudValidity, setHudValidity] = useState<number | null>(null);

  // Voice Subtitles / Captions
  const [activeCaption, setActiveCaption] = useState<string>('');
  const [isVoicePlaying, setIsVoicePlaying] = useState<boolean>(false);

  // Session Data & Reports
  const sessionStartTimeRef = useRef(Date.now());
  const trialMetricsRef = useRef<TrialMetric[]>([]);
  const completedGameIdsRef = useRef<Set<GameId>>(new Set());
  const currentGameRef = useRef<GameId>('BUTTERFLY');
  const sessionGameOrderRef = useRef<GameId[]>(GAME_SEQUENCE);
  const gameStartTimeRef = useRef(0);
  const gameGazePointsRef = useRef<GazePoint[]>([]);
  const gameGazeSampleCountRef = useRef(0);
  const gameNearTargetSampleCountRef = useRef(0);
  const restStartTimeRef = useRef<number | null>(null);
  const totalPausedTimeMsRef = useRef(0);
  const returnToActivitiesAfterCalibrationRef = useRef(false);
  const [activeReportSummary, setActiveReportSummary] = useState<SessionSummary | null>(null);
  const [isResearchEvalOpen, setIsResearchEvalOpen] = useState(false);
  const [gameAppreciation, setGameAppreciation] = useState<{ gameId: GameId; success: boolean; hasValidGaze: boolean; nextGame: GameId | null } | null>(null);
  const [appreciationReady, setAppreciationReady] = useState(false);

  // Sync pipeline settings
  useEffect(() => {
    gazePipeline.interactionMode = settings.interactionMode;
    gazePipeline.setGeometry(profile.screenWidthCm, profile.screenHeightCm, profile.viewingDistanceCm);
    gazePipeline.setDriftGain(settings.driftCorrectionGain);
  }, [settings, profile]);

  // Subscribe to voice guidance state for on-screen captions
  useEffect(() => {
    return voiceGuidance.subscribe(({ isPlaying, currentCaption }) => {
      setIsVoicePlaying(isPlaying);
      setActiveCaption(currentCaption);
    });
  }, []);

  // Hotkey navigation: P (Pause), Esc (Stop/Close), R (Recalibrate), S (Settings)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') {
        if (currentSection === 'ACTIVITIES') {
          setRestReason('CAREGIVER_PAUSE');
          setCurrentSection('REST');
        } else if (currentSection === 'REST') {
          resumeSession();
        }
      } else if (e.key === 'Escape') {
        if (currentSection === 'ACTIVITIES' || currentSection === 'REST') {
          finishSessionRef.current();
        } else if (isResearchEvalOpen) {
          setIsResearchEvalOpen(false);
        } else if (isCaregiverModalOpen) {
          setIsCaregiverModalOpen(false);
        }
      } else if ((e.key === 'r' || e.key === 'R') && settings.enableCalibration) {
        returnToActivitiesAfterCalibrationRef.current =
          currentSection === 'ACTIVITIES' || currentSection === 'REST';
        gazePipeline.resetCalibration();
        setCurrentSection('CALIBRATION');
      } else if (e.key === 's' || e.key === 'S') {
        setIsCaregiverModalOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSection, isCaregiverModalOpen, isResearchEvalOpen, settings.enableCalibration]);

  // Touch and pointer tracking for Accessible Touch Mode
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (settings.interactionMode === 'TOUCH') {
        gazePipeline.setTouchPoint(e.clientX, e.clientY);
        if (gazeCursorRef.current) {
          if (gazeCursorIdleTimeoutRef.current !== null) {
            window.clearTimeout(gazeCursorIdleTimeoutRef.current);
            gazeCursorIdleTimeoutRef.current = null;
          }
          lastGazeCursorPositionRef.current = { x: e.clientX, y: e.clientY };
          gazeCursorRef.current.style.opacity = '1';
          gazeCursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        }
      }
    },
    [settings.interactionMode]
  );

  // High-performance Vision & Gaze Pipeline RAF Loop
  useEffect(() => {
    let animId: number;
    let lastHudUpdateTime = 0;
    let lastVisionFrameTime = 0;
    let lastQualityUpdateTime = 0;
    let isActive = true;

    const pipelineLoop = () => {
      const now = performance.now();
      const video = videoRef.current;

      if (
        settings.interactionMode === 'GAZE' &&
        currentSection !== 'READINESS_CHECK' &&
        video &&
        video.readyState >= 2 &&
        visionService.isReady() &&
        !socialRobotGazeService.isInferenceInFlight() &&
        now - lastVisionFrameTime >= 50
      ) {
        lastVisionFrameTime = now;
        const visionResult = visionService.processVideoFrame(video);
        if (now - lastQualityUpdateTime >= 100) {
          lastQualityUpdateTime = now;
          setTrackingQuality(visionResult.quality);
        }
        if (visionResult.valid && visionResult.eyeFeatures) {
          void socialRobotGazeService
            .submitFeatures(
              visionResult.eyeFeatures,
              window.innerWidth,
              window.innerHeight,
              visionResult.confidence
            )
            .then((prediction) => {
              if (!isActive || !prediction) return;
              const gaze = gazePipeline.processSample(
                { x: prediction.x, y: prediction.y },
                visionResult.headPose,
                visionResult.ear,
                prediction.confidence,
                prediction.receivedAt
              );
              setLiveGaze(gaze);
              if (gazeCursorRef.current && gaze.isValid) {
                gazeCursorRef.current.style.transform = `translate3d(${gaze.x}px, ${gaze.y}px, 0)`;
                const previousPosition = lastGazeCursorPositionRef.current;
                const hasMoved =
                  !previousPosition || Math.hypot(gaze.x - previousPosition.x, gaze.y - previousPosition.y) >= 3;
                if (hasMoved) {
                  lastGazeCursorPositionRef.current = { x: gaze.x, y: gaze.y };
                  gazeCursorRef.current.style.opacity = '1';
                  if (gazeCursorIdleTimeoutRef.current !== null) {
                    window.clearTimeout(gazeCursorIdleTimeoutRef.current);
                  }
                  gazeCursorIdleTimeoutRef.current = window.setTimeout(() => {
                    if (gazeCursorRef.current) gazeCursorRef.current.style.opacity = '0';
                    gazeCursorIdleTimeoutRef.current = null;
                  }, 1000);
                }
              }
            });
        } else {
          const missing = gazePipeline.processSample(
            null,
            visionResult.headPose,
            visionResult.ear,
            visionResult.confidence,
            now
          );
          setLiveGaze(missing);
          if (gazeCursorRef.current) gazeCursorRef.current.style.opacity = '0';
          lastGazeCursorPositionRef.current = null;
          if (gazeCursorIdleTimeoutRef.current !== null) {
            window.clearTimeout(gazeCursorIdleTimeoutRef.current);
            gazeCursorIdleTimeoutRef.current = null;
          }
        }
      } else if (settings.interactionMode === 'TOUCH') {
        const touchGaze = gazePipeline.processSample(
          null,
          { yaw: 0, pitch: 0, roll: 0, distanceCm: 50, isStable: true, isGated: false },
          0.28,
          1,
          now
        );
        setLiveGaze(touchGaze);
      }

      // Throttle HUD state updates to ~5 Hz (every 200ms) for silky-smooth UI
      if (now - lastHudUpdateTime > 200) {
        lastHudUpdateTime = now;
        setHudFps(gazePipeline.getMeasuredFps());
        setHudValidity(Math.round(gazePipeline.getValidSampleRate()));

        // Check maximum session timer
        if (currentSection === 'ACTIVITIES') {
          const elapsedMinutes =
            (Date.now() - sessionStartTimeRef.current - totalPausedTimeMsRef.current) / 60000;
          if (elapsedMinutes >= settings.maxSessionLengthMin) {
            setRestReason('SESSION_TIMEOUT');
            setCurrentSection('REST');
          }
        }
      }

      animId = requestAnimationFrame(pipelineLoop);
    };

    animId = requestAnimationFrame(pipelineLoop);
    return () => {
      isActive = false;
      cancelAnimationFrame(animId);
    };
  }, [currentSection, settings.interactionMode, settings.maxSessionLengthMin]);

  const beginCalibration = () => {
    if (!settings.enableCalibration) return;
    returnToActivitiesAfterCalibrationRef.current = false;
    gazePipeline.resetCalibration();
    setLiveGaze(null);
    setCurrentSection('CALIBRATION');
  };

  const continueAfterGameAppreciation = () => {
    const completed = gameAppreciation;
    if (!completed) return;
    setGameAppreciation(null);
    setAppreciationReady(false);
    if (completed.nextGame) {
      currentGameRef.current = completed.nextGame;
      setCurrentGameId(completed.nextGame);
      gazePipeline.resetDrift();
    } else {
      finishSessionRef.current();
    }
  };

  // Session Management
  const startSession = (selectedGame: GameId = selectedFirstGameId) => {
    if (!profile.pseudonym.trim()) {
      setCurrentSection('PROFILE_SETUP');
      return;
    }
    sessionStartTimeRef.current = Date.now();
    totalPausedTimeMsRef.current = 0;
    trialMetricsRef.current = [];
    completedGameIdsRef.current = new Set();
    setGameAppreciation(null);
    currentGameRef.current = selectedGame;
    const firstGameIndex = GAME_SEQUENCE.indexOf(selectedGame);
    sessionGameOrderRef.current = [
      ...GAME_SEQUENCE.slice(firstGameIndex),
      ...GAME_SEQUENCE.slice(0, firstGameIndex),
    ];
    if (settings.interactionMode === 'GAZE') {
      // Reuse this participant's saved EyeGazeTracker screen calibration across all five games.
      const savedModel = calibrationStorageService.load(profile.pseudonym, window.innerWidth, window.innerHeight);
      if (savedModel) gazePipeline.setCalibrationModel(savedModel);
      else if (!gazePipeline.calibrationModel?.isValidated) gazePipeline.setCalibrationModel(null);
    }
    gazePipeline.resetDrift();
    soundService.playStarChime(1.1);
    setCurrentGameId(selectedGame);
    setCurrentSection('ACTIVITIES');

    voiceGuidance.speak(
      'Let’s play! Look around with your eyes or use a finger.'
    );
  };

  const handleCalibrationComplete = (model: CalibrationModel) => {
    // Only validated mappings are reused; raw camera frames are never stored.
    if (model.isValidated) {
      calibrationStorageService.save(profile.pseudonym, window.innerWidth, window.innerHeight, model);
    }
    soundService.playSuccessSparkle();
    if (returnToActivitiesAfterCalibrationRef.current) {
      returnToActivitiesAfterCalibrationRef.current = false;
      resumeSession();
    } else {
      startSession(selectedFirstGameId);
    }
  };

  const handleTrialComplete = useCallback(
    (metric: TrialMetric) => {
      if (metric.gameId !== currentGameRef.current || completedGameIdsRef.current.has(metric.gameId)) return;
      completedGameIdsRef.current.add(metric.gameId);
      trialMetricsRef.current.push(metric);

      const orderedGames = sessionGameOrderRef.current;
      const currentIdx = orderedGames.indexOf(metric.gameId);
      const nextGame = currentIdx !== -1 && currentIdx + 1 < orderedGames.length
        ? orderedGames[currentIdx + 1]
        : null;
      const hasValidGaze = metric.gazePoints.some((point) => point.isValid);
      setAppreciationReady(false);
      setGameAppreciation({
        gameId: metric.gameId,
        success: metric.success,
        hasValidGaze,
        nextGame,
      });
      voiceGuidance.speak(
        metric.success
          ? 'Wonderful playing! Great job giving that a try!'
          : settings.interactionMode === 'GAZE' && !hasValidGaze
          ? 'Thank you for trying. We could not measure this round clearly, and that is okay.'
          : 'Nice work! Every try helps us learn.'
      );
    },
    [settings.interactionMode]
  );

  useEffect(() => {
    if (!gameAppreciation) return;
    const timer = window.setTimeout(() => setAppreciationReady(true), 1800);
    return () => window.clearTimeout(timer);
  }, [gameAppreciation]);

  useEffect(() => {
    if (currentSection !== 'ACTIVITIES' || currentGameId === 'BUTTERFLY') return;
    gameStartTimeRef.current = Date.now();
    gameGazePointsRef.current = [];
    gameGazeSampleCountRef.current = 0;
    gameNearTargetSampleCountRef.current = 0;

    const gameTimer = window.setInterval(() => {
      if (currentGameRef.current !== currentGameId || completedGameIdsRef.current.has(currentGameId)) return;

      const elapsedMs = Date.now() - gameStartTimeRef.current;
      const followRatio =
        gameGazeSampleCountRef.current > 0
          ? gameNearTargetSampleCountRef.current / gameGazeSampleCountRef.current
          : 0;
      const reachedInitialLimit = elapsedMs >= GAME_INITIAL_TIME_LIMIT_MS;
      const reachedMaximumLimit = elapsedMs >= GAME_MAX_TIME_LIMIT_MS;
      const shouldComplete =
        reachedMaximumLimit || (reachedInitialLimit && followRatio < GAME_EXTENSION_FOLLOW_RATIO);

      if (!shouldComplete) return;
      window.clearInterval(gameTimer);

      const endTime = Date.now();
      handleTrialComplete({
        gameId: currentGameId,
        trialNumber: 1,
        startTime: gameStartTimeRef.current,
        endTime,
        durationMs: endTime - gameStartTimeRef.current,
        success: followRatio >= GAME_EXTENSION_FOLLOW_RATIO,
        timeToFirstFixationMs: null,
        dwellTimeMs: null,
        targetHitCount: gameNearTargetSampleCountRef.current,
        distractorFixationCount: null,
        avgEngagement:
          settings.interactionMode === 'GAZE' && gameGazeSampleCountRef.current > 0
            ? followRatio
            : null,
        gazeFollowPercent: null,
        gazePoints: [...gameGazePointsRef.current],
      });
    }, 500);

    return () => window.clearInterval(gameTimer);
  }, [currentGameId, currentSection, handleTrialComplete]);

  useEffect(() => {
    if (currentSection !== 'ACTIVITIES' || currentGameId === 'BUTTERFLY' || !liveGaze?.isValid) return;
    gameGazeSampleCountRef.current += 1;
    if (settings.interactionMode === 'GAZE') {
      gameGazePointsRef.current.push(liveGaze);
      if (gameGazePointsRef.current.length > 1200) gameGazePointsRef.current.shift();
    }

    const targetAois = activeAOIs.filter((aoi) => aoi.type === 'TARGET');
    if (
      targetAois.some((aoi) =>
        gazePipeline.isGazeInAOI(
          liveGaze.x,
          liveGaze.y,
          aoi.x,
          aoi.y,
          aoi.radius ?? 75
        )
      )
    ) {
      gameNearTargetSampleCountRef.current += 1;
    }
  }, [activeAOIs, currentGameId, currentSection, liveGaze, settings.interactionMode]);

  useEffect(() => {
    if (currentSection === 'REST' && restStartTimeRef.current === null) {
      restStartTimeRef.current = Date.now();
    }
  }, [currentSection]);

  const resumeSession = () => {
    if (restStartTimeRef.current !== null) {
      totalPausedTimeMsRef.current += Date.now() - restStartTimeRef.current;
      restStartTimeRef.current = null;
    }
    setCurrentSection('ACTIVITIES');
  };

  // Always points at the latest finishSession so callbacks created once (game trial
  // completion, hotkeys) never record a stale profile / interaction mode.
  const finishSessionRef = useRef<() => void>(() => {});

  const finishSession = () => {
    const currentPauseDuration =
      restStartTimeRef.current === null ? 0 : Date.now() - restStartTimeRef.current;
    const durationSeconds = Math.max(
      1,
      Math.round(
        (Date.now() -
          sessionStartTimeRef.current -
          totalPausedTimeMsRef.current -
          currentPauseDuration) /
          1000
      )
    );
    const trials = trialMetricsRef.current;

    const validPct =
      settings.interactionMode === 'GAZE' ? Math.round(gazePipeline.getValidSampleRate()) : null;
    const calibration = gazePipeline.calibrationModel;

    const summary: SessionSummary = {
      sessionId: `SESSION_${Date.now()}`,
      reportDataVersion: 2,
      childProfile: profile,
      caregiverSettings: settings,
      interactionMode: settings.interactionMode,
      startTime: new Date(sessionStartTimeRef.current).toISOString(),
      endTime: new Date().toISOString(),
      durationSeconds,
      totalFrames: settings.interactionMode === 'GAZE' ? gazePipeline.totalFramesProcessed : 0,
      validGazeFrames: settings.interactionMode === 'GAZE' ? gazePipeline.validFramesCount : 0,
      validSamplePercent: validPct,
      faceLostCount: gazePipeline.faceLostCount,
      calibrationQuality: {
        meanErrorDeg: calibration?.meanAngularErrorDeg ?? null,
        medianErrorDeg: calibration?.medianAngularErrorDeg ?? null,
        meanErrorPx: calibration?.meanPixelError ?? null,
        validationStatus:
          settings.interactionMode === 'TOUCH'
            ? 'SKIPPED_TOUCH_MODE'
            : calibration?.isValidated
            ? 'VALIDATED'
            : calibration
            ? 'MARGINAL'
            : 'NOT_CALIBRATED',
      },
      deviceMetadata: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        hasCamera: cameraService.status.available,
        cameraLabel: cameraService.status.label,
        touchScreen: 'ontouchstart' in window,
        timestamp: new Date().toISOString(),
      },
      overallEngagementIndex: null,
      fixationCount: null,
      saccadeCount: null,
      smoothPursuitCount: null,
      pursuitMetrics: {
        meanGain: null,
        meanRmsErrorPx: null,
        meanLagMs: null,
      },
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
        'The butterfly game records an activity-specific gaze-following estimate; it is not a validated concentration, attention, developmental, or medical measure.',
        'Missing gaze samples indicate unavailable tracking data and must not be interpreted as absence of attention.',
        `Interaction mode: ${settings.interactionMode}. Touch responses are not gaze measurements.`,
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
      trials: [...trials],
    };

    setActiveReportSummary(summary);
    // Persist session to local storage
    sessionStorageService.saveSession(summary);
    setCurrentSection('COMPLETION_FEEDBACK');
  };
  finishSessionRef.current = finishSession;

  const handleSaveFeedbackAndOpenReport = (feedback: ChildSessionFeedback) => {
    if (activeReportSummary) {
      const updated = { ...activeReportSummary, childFeedback: feedback };
      setActiveReportSummary(updated);
      sessionStorageService.saveSession(updated);
    }
    setCurrentSection('REPORTS_HISTORY');
  };

  return (
    <div
      onPointerMove={handlePointerMove}
      className="relative min-h-screen w-screen overflow-hidden bg-slate-900 font-['Plus_Jakarta_Sans'] text-slate-900 select-none"
    >
      {/* Hidden camera element for computer vision inference */}
      <video ref={videoRef} playsInline muted className="hidden" />

      {/* TOP NAVIGATION BAR CONTRACT: Zone 1 (Wordmark) — Zone 2 (4–5 Nav Links) — Zone 3 (1 Primary Action) */}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between gap-6 border-b border-emerald-950/10 bg-white/95 px-6 py-3 backdrop-blur-md shadow-xs">
        {/* Zone 1: Brand Wordmark */}
        <div
          onClick={() => setCurrentSection('WELCOME')}
          className="flex items-center gap-2.5 shrink-0 cursor-pointer"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-lg shadow-xs">
            🐼
          </span>
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-extrabold tracking-tight text-emerald-950 font-['Quicksand'] whitespace-nowrap leading-tight">
              Eye-play
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold tracking-wide uppercase">
              {profile.pseudonym || 'Participant not set'} · {settings.interactionMode === 'GAZE' ? 'Gaze Mode' : 'Touch Mode'}
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-5 text-xs font-semibold text-emerald-900">
          <button
            type="button"
            onClick={() => setCurrentSection('WELCOME')}
            className={`whitespace-nowrap transition-colors cursor-pointer ${
              currentSection === 'WELCOME' ? 'text-emerald-950 font-extrabold' : 'text-emerald-800/80 hover:text-emerald-950'
            }`}
          >
            Play Meadow
          </button>
          <button
            type="button"
            onClick={() => setCurrentSection('PROFILE_SETUP')}
            className={`whitespace-nowrap transition-colors cursor-pointer ${
              currentSection === 'PROFILE_SETUP' ? 'text-emerald-950 font-extrabold' : 'text-emerald-800/80 hover:text-emerald-950'
            }`}
          >
            Session Setup
          </button>
          <button
            type="button"
            onClick={() => setCurrentSection('ADULT_DASHBOARD')}
            className={`whitespace-nowrap transition-colors cursor-pointer ${
              currentSection === 'ADULT_DASHBOARD' ? 'text-emerald-950 font-extrabold' : 'text-emerald-800/80 hover:text-emerald-950'
            }`}
          >
            Adult Dashboard 📊
          </button>
          <button
            type="button"
            onClick={() => setCurrentSection('REPORTS_HISTORY')}
            className={`whitespace-nowrap transition-colors cursor-pointer ${
              currentSection === 'REPORTS_HISTORY' ? 'text-emerald-950 font-extrabold' : 'text-emerald-800/80 hover:text-emerald-950'
            }`}
          >
            Reports & History
          </button>
          <button
            type="button"
            onClick={() => setCurrentSection('SETTINGS')}
            className={`whitespace-nowrap transition-colors cursor-pointer ${
              currentSection === 'SETTINGS' ? 'text-emerald-950 font-extrabold' : 'text-emerald-800/80 hover:text-emerald-950'
            }`}
          >
            Settings & Audio ⚙️
          </button>
          <button
            type="button"
            onClick={() => setCurrentSection('PRIVACY_HELP')}
            className={`whitespace-nowrap transition-colors cursor-pointer ${
              currentSection === 'PRIVACY_HELP' ? 'text-emerald-950 font-extrabold' : 'text-emerald-800/80 hover:text-emerald-950'
            }`}
          >
            Privacy 🛡️
          </button>
        </nav>

        {/* Zone 3: Quick Controls & Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Voice Guidance Replay Button */}
          <button
            type="button"
            onClick={() => voiceGuidance.replayCurrent()}
            title="Hear Bao's instruction again"
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
              isVoicePlaying
                ? 'bg-amber-100 border-amber-300 text-amber-900 animate-pulse'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>{isVoicePlaying ? '🗣️' : '🔊'}</span>
            <span className="hidden sm:inline">Hear Bao</span>
          </button>

          {/* Emergency Pause / Primary Action */}
          {currentSection === 'ACTIVITIES' ? (
            <button
              type="button"
              onClick={() => {
                setRestReason('CAREGIVER_PAUSE');
                setCurrentSection('REST');
              }}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-400 cursor-pointer"
            >
              <span>Pause Play (P)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCurrentSection('PROFILE_SETUP');
              }}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 cursor-pointer"
            >
              <span>Start Session ✨</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Screen Viewport with Meadow Backdrop */}
      <main className="relative h-screen w-screen overflow-hidden pt-14">
        {/* Soft Peaceful Meadow Background Art */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-85 pointer-events-none"
          style={{
            backgroundImage: `url(/src/assets/images/friendly_meadow_bg_1792223321833.jpg)`,
          }}
        />
        <div className="absolute inset-0 bg-emerald-50/25 pointer-events-none" />

        {/* SECTION 1: WELCOME SCREEN */}
        {currentSection === 'WELCOME' && (
          <WelcomeScreen
            onStartSession={() => {
              setCurrentSection('PROFILE_SETUP');
            }}
            onOpenDashboard={() => setCurrentSection('ADULT_DASHBOARD')}
            onOpenSettings={() => setCurrentSection('SETTINGS')}
            onOpenPrivacy={() => setCurrentSection('PRIVACY_HELP')}
            interactionMode={settings.interactionMode}
            onToggleInteractionMode={(mode) => {
              setSettings((prev) => ({ ...prev, interactionMode: mode }));
              setProfile((prev) => ({ ...prev, interactionMode: mode }));
            }}
            participantName={profile.pseudonym}
          />
        )}

        {/* SECTION 2: PROFILE SETUP SCREEN */}
        {currentSection === 'PROFILE_SETUP' && (
          <ProfileSetupScreen
            profile={profile}
            onUpdateProfile={setProfile}
            selectedFirstGame={selectedFirstGameId}
            onSelectFirstGame={setSelectedFirstGameId}
            onProceed={() => {
              if (settings.interactionMode === 'GAZE') {
                setCurrentSection('READINESS_CHECK');
              } else {
                startSession(selectedFirstGameId);
              }
            }}
            onBack={() => setCurrentSection('WELCOME')}
            interactionMode={settings.interactionMode}
          />
        )}

        {/* SECTION 3: CAMERA & ENVIRONMENT READINESS CHECK */}
        {currentSection === 'READINESS_CHECK' && (
          <ReadinessCheckScreen
            savedCalibrationAvailable={
              settings.enableCalibration &&
              calibrationStorageService.hasReusable(profile.pseudonym, window.innerWidth, window.innerHeight)
            }
            onProceedToCalibration={() => {
              const savedModel = settings.enableCalibration
                ? calibrationStorageService.load(profile.pseudonym, window.innerWidth, window.innerHeight)
                : null;
              if (savedModel) gazePipeline.setCalibrationModel(savedModel);
              else gazePipeline.setCalibrationModel(null);
              startSession(selectedFirstGameId);
            }}
            onCalibrateNow={settings.enableCalibration ? beginCalibration : undefined}
            onProceedToTouchPlay={() => {
              setSettings((prev) => ({ ...prev, interactionMode: 'TOUCH' }));
              setProfile((prev) => ({ ...prev, interactionMode: 'TOUCH' }));
              startSession(selectedFirstGameId);
            }}
            onBack={() => setCurrentSection('WELCOME')}
            onCameraReady={(stream) => {
              if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(() => {});
              }
            }}
          />
        )}

        {/* SECTION 4: GAZE CALIBRATION WITH HOLDOUT VALIDATION */}
        {currentSection === 'CALIBRATION' && (
          <CalibrationGame
            currentGaze={liveGaze}
            trackingQuality={trackingQuality}
            interactionMode={settings.interactionMode}
            onComplete={handleCalibrationComplete}
            onCancel={() => {
              if (returnToActivitiesAfterCalibrationRef.current) {
                returnToActivitiesAfterCalibrationRef.current = false;
                resumeSession();
              } else {
                startSession(selectedFirstGameId);
              }
            }}
            onSwitchToTouch={() => {
              setSettings((prev) => ({ ...prev, interactionMode: 'TOUCH' }));
              setProfile((prev) => ({ ...prev, interactionMode: 'TOUCH' }));
              startSession(selectedFirstGameId);
            }}
            pointCount={13}
          />
        )}

        {/* SECTION 5: GUIDED GAZE ACTIVITIES (MINI-GAMES) */}
        {currentSection === 'ACTIVITIES' && (
          <div className="relative h-full w-full">
            {/* Live tracking status HUD */}
            <div className="absolute top-4 right-6 z-30 flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-2 shadow-xs backdrop-blur-md border border-emerald-100 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Mode:</span>
                <span className="font-bold text-emerald-800 uppercase">{settings.interactionMode}</span>
              </div>
              {settings.interactionMode === 'GAZE' && (
                <>
                  <span className="text-slate-300">·</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Inference FPS:</span>
                    <span className="font-semibold text-slate-700 tabular-nums">{hudFps ?? '—'}</span>
                  </div>
                  <span className="text-slate-300">·</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Valid samples:</span>
                    <span className={`font-semibold ${hudValidity != null && hudValidity > 60 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {hudValidity == null ? '—' : `${hudValidity}%`}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Quick Mascot Help / Replay button */}
            <button
              type="button"
              onClick={() => voiceGuidance.replayCurrent()}
              className="absolute bottom-5 right-6 z-30 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white/95 px-4 py-2.5 text-xs font-bold text-emerald-950 shadow-md backdrop-blur-sm hover:bg-white cursor-pointer"
            >
              <span>🗣️</span>
              <span>Bao, say that again</span>
            </button>

            {/* Active Mini-Game */}
            {currentGameId === 'BUTTERFLY' && (
              <FollowButterflyGame
                currentGaze={liveGaze}
                onTrialComplete={handleTrialComplete}
                sensorySafe={profile.sensorySafe}
                interactionMode={settings.interactionMode}
              />
            )}

            {currentGameId === 'SPOT_IT' && (
              <SpotItGame
                currentGaze={liveGaze}
                onTrialComplete={handleTrialComplete}
                onUpdateAOIs={setActiveAOIs}
                dwellTimeMs={settings.dwellTimeThresholdMs}
              />
            )}

            {currentGameId === 'LOOK_HERE' && (
              <JointAttentionGame
                currentGaze={liveGaze}
                onTrialComplete={handleTrialComplete}
                onUpdateAOIs={setActiveAOIs}
              />
            )}

            {currentGameId === 'MAZE' && (
              <GazeMazeGame
                currentGaze={liveGaze}
                onTrialComplete={handleTrialComplete}
                onUpdateAOIs={setActiveAOIs}
              />
            )}

            {currentGameId === 'LISTEN_DO' && (
              <ListenDoGame
                currentGaze={liveGaze}
                onTrialComplete={handleTrialComplete}
                onUpdateAOIs={setActiveAOIs}
                language={profile.language}
                audioConsent={profile.audioConsent}
              />
            )}

            {gameAppreciation && (
              <div className={`absolute inset-0 z-50 flex items-center justify-center bg-emerald-950/75 p-5 backdrop-blur-sm transition-opacity duration-1000 ${appreciationReady ? 'opacity-100' : 'opacity-0'}`} role="dialog" aria-modal="true" aria-label="Game celebration">
                <div className={`w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-2xl transition-all duration-1000 ${appreciationReady ? 'translate-y-0 scale-100' : 'translate-y-4 scale-95'}`}>
                  <div className="text-6xl" aria-hidden="true">{gameAppreciation.success ? '🌟' : '🐼💚'}</div>
                  <h2 className="mt-4 text-3xl font-extrabold text-emerald-950 font-['Quicksand']">
                    {gameAppreciation.success ? 'Wonderful playing!' : 'Thanks for trying!'}
                  </h2>
                  <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-slate-700">
                    {gameAppreciation.gameId === 'BUTTERFLY' && gameAppreciation.success
                      ? 'You followed the butterfly and kept exploring. Great job!'
                      : gameAppreciation.gameId === 'MAZE' && gameAppreciation.success
                      ? 'You stayed with the berry trail. Well done!'
                      : gameAppreciation.success
                      ? 'You did it! Every try helps us learn. Bao is cheering for you!'
                      : settings.interactionMode === 'GAZE' && !gameAppreciation.hasValidGaze
                      ? 'We could not measure this round clearly. That is okay—let’s take a breath and try again another time.'
                      : 'You gave it a try, and that matters. Thank you for playing with Bao!'}
                  </p>
                  <div className="mt-6 flex justify-center">
                    <button type="button" onClick={continueAfterGameAppreciation} disabled={!appreciationReady} className="rounded-2xl bg-emerald-600 px-7 py-3 font-bold text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed">
                      {gameAppreciation.nextGame ? 'Play the next game →' : 'Finish and see my report 🎉'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION 6: SESSION COMPLETION & FEEDBACK */}
        {currentSection === 'COMPLETION_FEEDBACK' && activeReportSummary && (
          <SessionCompletionScreen
            sessionSummary={activeReportSummary}
            onSaveFeedbackAndOpenReport={handleSaveFeedbackAndOpenReport}
            onReturnHome={() => setCurrentSection('WELCOME')}
            onNewSession={() => startSession()}
          />
        )}

        {/* SECTION 7: ADULT DASHBOARD */}
        {currentSection === 'ADULT_DASHBOARD' && (
          <AdultDashboardScreen
            onStartNewSession={(mode) => {
              setSettings((prev) => ({ ...prev, interactionMode: mode }));
              setProfile((prev) => ({ ...prev, interactionMode: mode }));
              setCurrentSection('PROFILE_SETUP');
            }}
            onViewReportsHistory={() => setCurrentSection('REPORTS_HISTORY')}
            onOpenResearchEval={() => setIsResearchEvalOpen(true)}
            onOpenSettings={() => setCurrentSection('SETTINGS')}
            onOpenPrivacy={() => setCurrentSection('PRIVACY_HELP')}
            onSelectSession={(session) => {
              setActiveReportSummary(session);
              setCurrentSection('REPORTS_HISTORY');
            }}
            onBackToPlay={() => setCurrentSection('WELCOME')}
          />
        )}

        {/* SECTION 8: REPORTS & SESSION HISTORY */}
        {currentSection === 'REPORTS_HISTORY' && (
          activeReportSummary ? (
            <ClinicianReportView
              sessionData={activeReportSummary}
              onClose={() => setActiveReportSummary(null)}
              onNewSession={() => startSession()}
              onOpenResearchEval={() => setIsResearchEvalOpen(true)}
            />
          ) : (
            <ReportsHistoryScreen
              onSelectSession={(session) => setActiveReportSummary(session)}
              onBackToDashboard={() => setCurrentSection('ADULT_DASHBOARD')}
              onStartNewSession={() => setCurrentSection('PROFILE_SETUP')}
            />
          )
        )}

        {/* SECTION 9: SETTINGS & AUDIO GUIDANCE */}
        {currentSection === 'SETTINGS' && (
          <SettingsScreen
            settings={settings}
            profile={profile}
            onUpdateSettings={setSettings}
            onUpdateProfile={setProfile}
            onTriggerRecalibration={beginCalibration}
            onStartEyeGazeCalibration={async () => {
              cameraService.releaseCamera();
              try {
                const response = await fetch('/api/calibration/start', { method: 'POST' });
                const body = await response.json();
                if (!response.ok || !body.ok) throw new Error(body.error || 'Could not start EyeGazeTracker calibration.');
              } catch (error) {
                if (videoRef.current) await cameraService.requestCamera(videoRef.current).catch(() => undefined);
                throw error;
              }
            }}
            onCalibrationRunnerFinished={() => {
              if (videoRef.current) void cameraService.requestCamera(videoRef.current).catch(() => undefined);
            }}
            onBack={() => setCurrentSection('WELCOME')}
          />
        )}

        {/* SECTION 10: PRIVACY, CONSENT & HELP */}
        {currentSection === 'PRIVACY_HELP' && (
          <PrivacyConsentHelpScreen onBack={() => setCurrentSection('WELCOME')} />
        )}

        {/* REST OVERLAY (Screen-strain fatigue protection) */}
        {currentSection === 'REST' && (
          <RestScreenOverlay
            reason={restReason}
            onContinue={resumeSession}
            onRecalibrate={() => {
              returnToActivitiesAfterCalibrationRef.current = true;
              gazePipeline.resetCalibration();
              setCurrentSection('CALIBRATION');
            }}
            onEndSession={finishSession}
            restDurationSec={settings.restPauseDurationSec}
            voiceEnabled={settings.voiceConfig.enabled && profile.audioConsent}
            allowRecalibration={settings.enableCalibration}
          />
        )}

        {/* RESEARCH EVALUATION MODAL (Section 9 Protocol) */}
        {isResearchEvalOpen && (
          <ResearchEvaluationView
            onClose={() => setIsResearchEvalOpen(false)}
            participantPseudonym={profile.pseudonym}
            sessionId={activeReportSummary?.sessionId}
          />
        )}

        {/* LIVE ACCESSIBLE CAPTIONS BAR (When spoken instructions are active) */}
        {settings.voiceConfig.showCaptions && activeCaption && (
          <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 max-w-xl rounded-2xl bg-slate-900/95 px-5 py-2.5 text-center text-xs font-semibold text-white shadow-xl backdrop-blur-md border border-slate-700 pointer-events-none">
            <span className="text-emerald-400 font-bold mr-1.5">🐼 Bao:</span>
            <span>&quot;{activeCaption}&quot;</span>
          </div>
        )}

        {/* Real-Time Gaze Cursor Ring */}
        {settings.showGazeCursor && currentSection === 'ACTIVITIES' && (
          <div
            ref={gazeCursorRef}
            className="pointer-events-none fixed top-0 left-0 z-50 -translate-x-1/2 -translate-y-1/2 opacity-0 will-change-transform"
            style={{ transition: 'transform 70ms linear, opacity 180ms ease-out' }}
          >
            <div className="relative flex h-10 w-10 items-center justify-center">
              <div
                className={`absolute inset-0 rounded-full border-2 ${
                  settings.interactionMode === 'GAZE'
                    ? 'border-emerald-500/60 bg-emerald-400/20'
                    : 'border-amber-500/60 bg-amber-400/20'
                } animate-pulse`}
              />
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  settings.interactionMode === 'GAZE' ? 'bg-emerald-600' : 'bg-amber-600'
                } shadow-sm`}
              />
            </div>
          </div>
        )}
      </main>

      {/* Quick Caregiver Settings Modal */}
      <CaregiverModal
        isOpen={isCaregiverModalOpen}
        onClose={() => setIsCaregiverModalOpen(false)}
        profile={profile}
        settings={settings}
        onUpdateProfile={setProfile}
        onUpdateSettings={setSettings}
        onTriggerRecalibration={() => {
          setIsCaregiverModalOpen(false);
          beginCalibration();
        }}
      />
    </div>
  );
}
