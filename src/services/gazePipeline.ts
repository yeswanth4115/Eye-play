import { GazePoint, EventType, HeadPose, CalibrationTarget, CalibrationModel } from '../types';
import { KalmanGazeFilter2D } from './kalmanFilter';

export interface ScreenGeometry {
  widthPx: number;
  heightPx: number;
  widthCm: number;
  heightCm: number;
  viewingDistanceCm: number;
}

export class GazePipeline {
  private kalmanFilter = new KalmanGazeFilter2D(450.0, 300.0, 220.0);
  private recentGazePoints: GazePoint[] = [];
  private lastTimestamp: number = 0;
  private fpsBuffer: number[] = [];
  private measuredFps: number = 30;
  
  // Continuous drift correction offset (in screen pixels)
  private driftOffsetX: number = 0;
  private driftOffsetY: number = 0;
  private driftGain: number = 0.05;

  // Blink guard: +/- 100ms
  private lastBlinkTimestamp: number = -1;
  private isBlinkActive: boolean = false;

  // Face lost count
  public faceLostCount: number = 0;
  public totalFramesProcessed: number = 0;
  public validFramesCount: number = 0;

  // Geometry
  public geometry: ScreenGeometry = {
    widthPx: 1440,
    heightPx: 900,
    widthCm: 34.0,
    heightCm: 21.0,
    viewingDistanceCm: 50.0,
  };

  // Calibration model
  public calibrationModel: CalibrationModel | null = null;

  // Interaction mode: 'GAZE' or 'TOUCH'
  public interactionMode: 'GAZE' | 'TOUCH' = 'GAZE';
  public isSimulating: boolean = false;
  private touchCoordinates: { x: number; y: number } | null = null;

  constructor() {
    this.updateScreenDimensions();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.updateScreenDimensions());
    }
  }

  public updateScreenDimensions() {
    if (typeof window !== 'undefined') {
      this.geometry.widthPx = window.innerWidth;
      this.geometry.heightPx = window.innerHeight;
    }
  }

  public setGeometry(widthCm: number, heightCm: number, distanceCm: number) {
    this.geometry.widthCm = widthCm;
    this.geometry.heightCm = heightCm;
    this.geometry.viewingDistanceCm = distanceCm;
  }

  public setDriftGain(gain: number) {
    this.driftGain = Math.max(0.01, Math.min(0.2, gain));
  }

  public resetDrift() {
    this.driftOffsetX = 0;
    this.driftOffsetY = 0;
  }

  public setCalibrationModel(model: CalibrationModel | null) {
    this.calibrationModel = model;
    this.resetDrift();
    this.kalmanFilter.reset();
    this.recentGazePoints = [];
    this.lastTimestamp = 0;
  }

  public resetCalibration() {
    this.calibrationModel = null;
    this.resetDrift();
    this.kalmanFilter.reset();
    this.recentGazePoints = [];
    this.lastTimestamp = 0;
  }

  public setTouchPoint(x: number, y: number) {
    this.touchCoordinates = { x, y };
  }

  public clearTouchPoint() {
    this.touchCoordinates = null;
  }

  public applyDriftNudge(targetX: number, targetY: number, gazeX: number, gazeY: number) {
    const errorX = targetX - gazeX;
    const errorY = targetY - gazeY;
    if (Math.hypot(errorX, errorY) < 220) {
      this.driftOffsetX += errorX * this.driftGain;
      this.driftOffsetY += errorY * this.driftGain;
      this.driftOffsetX = Math.max(-120, Math.min(120, this.driftOffsetX));
      this.driftOffsetY = Math.max(-120, Math.min(120, this.driftOffsetY));
    }
  }

  public quick1PointRecalibrate(targetX: number, targetY: number, currentGazeX: number, currentGazeY: number) {
    this.driftOffsetX = targetX - (currentGazeX - this.driftOffsetX);
    this.driftOffsetY = targetY - (currentGazeY - this.driftOffsetY);
  }

  // Convert pixels to degrees of visual angle
  public pixelsToDegrees(pixelDistance: number): number {
    const mmPerPixel = (this.geometry.widthCm * 10) / this.geometry.widthPx;
    const distanceMm = pixelDistance * mmPerPixel;
    const viewingDistanceMm = this.geometry.viewingDistanceCm * 10;
    const rad = 2 * Math.atan(distanceMm / (2 * viewingDistanceMm));
    return (rad * 180) / Math.PI;
  }

  // Convert degrees to pixels
  public degreesToPixels(degrees: number): number {
    const viewingDistanceMm = this.geometry.viewingDistanceCm * 10;
    const rad = (degrees * Math.PI) / 180;
    const distanceMm = 2 * viewingDistanceMm * Math.tan(rad / 2);
    const pixelsPerMm = this.geometry.widthPx / (this.geometry.widthCm * 10);
    return distanceMm * pixelsPerMm;
  }

  public getMeasuredFps(): number {
    return Math.round(this.measuredFps);
  }

  public getValidSampleRate(): number {
    if (this.totalFramesProcessed === 0) return 0;
    return (this.validFramesCount / this.totalFramesProcessed) * 100;
  }

  /**
   * Process a frame from camera landmarks or touch input
   */
  public processSample(
    rawCoordinates: { x: number; y: number } | null,
    headPose: HeadPose,
    ear: number, // Eye aspect ratio
    trackingConfidence: number,
    currentTimeMs: number = performance.now()
  ): GazePoint {
    this.totalFramesProcessed++;

    if (this.lastTimestamp > 0) {
      const deltaSec = (currentTimeMs - this.lastTimestamp) / 1000.0;
      if (deltaSec > 0.001) {
        this.fpsBuffer.push(1.0 / deltaSec);
        if (this.fpsBuffer.length > 30) this.fpsBuffer.shift();
        this.measuredFps = this.fpsBuffer.reduce((a, b) => a + b, 0) / this.fpsBuffer.length;
      }
    }
    const dt = this.lastTimestamp > 0 ? (currentTimeMs - this.lastTimestamp) / 1000.0 : 1.0 / 30.0;
    this.lastTimestamp = currentTimeMs;

    // TOUCH MODE: explicitly uses direct touch input
    if (this.interactionMode === 'TOUCH') {
      if (this.touchCoordinates) {
        this.validFramesCount++;
        const touchPoint: GazePoint = {
          x: Math.round(this.touchCoordinates.x),
          y: Math.round(this.touchCoordinates.y),
          rawX: Math.round(this.touchCoordinates.x),
          rawY: Math.round(this.touchCoordinates.y),
          timestamp: currentTimeMs,
          confidence: 1.0,
          isValid: true,
          event: 'FIXATION',
          velocityDegPerSec: 0,
        };
        this.recentGazePoints.push(touchPoint);
        if (this.recentGazePoints.length > 90) this.recentGazePoints.shift();
        return touchPoint;
      } else {
        const waitingPoint: GazePoint = {
          x: 0,
          y: 0,
          rawX: 0,
          rawY: 0,
          timestamp: currentTimeMs,
          confidence: 1.0,
          isValid: false,
          event: 'MISSING',
          velocityDegPerSec: 0,
        };
        return waitingPoint;
      }
    }

    // Blink detection: EAR < 0.16 + 100ms guard
    const EAR_THRESHOLD = 0.16;
    if (ear < EAR_THRESHOLD) {
      this.isBlinkActive = true;
      this.lastBlinkTimestamp = currentTimeMs;
    } else if (currentTimeMs - this.lastBlinkTimestamp > 100) {
      this.isBlinkActive = false;
    }

    // Gate on extreme head pose (|yaw| > 30 deg or |pitch| > 30 deg)
    const isHeadPoseGated = Math.abs(headPose.yaw) > 30 || Math.abs(headPose.pitch) > 30;

    let isValid = true;
    if (!rawCoordinates || this.isBlinkActive || isHeadPoseGated || trackingConfidence < 0.35) {
      isValid = false;
      if (!rawCoordinates || isHeadPoseGated) {
        this.faceLostCount++;
      }
    }

    let rawX = 0;
    let rawY = 0;

    if (isValid && rawCoordinates) {
      rawX = rawCoordinates.x;
      rawY = rawCoordinates.y;

      // Apply polynomial calibration mapping if model fitted
      if (this.calibrationModel) {
        const mapped = this.applyCalibrationMapping(rawX, rawY, headPose.yaw, headPose.pitch);
        rawX = mapped.x;
        rawY = mapped.y;
      }
    }

    if (!isValid) {
      // Return honest MISSING point — never fabricate fake coordinates
      const missingPoint: GazePoint = {
        x: 0,
        y: 0,
        rawX: 0,
        rawY: 0,
        timestamp: currentTimeMs,
        confidence: trackingConfidence,
        isValid: false,
        event: 'MISSING',
        velocityDegPerSec: 0,
      };
      this.recentGazePoints.push(missingPoint);
      if (this.recentGazePoints.length > 90) this.recentGazePoints.shift();
      return missingPoint;
    }

    this.validFramesCount++;

    // Apply continuous drift correction
    const correctedRawX = rawX + this.driftOffsetX;
    const correctedRawY = rawY + this.driftOffsetY;

    // Apply Kalman filter
    const kalmanOutput = this.kalmanFilter.update(correctedRawX, correctedRawY, currentTimeMs, trackingConfidence);

    // Compute velocity in degrees per second for I-VT event classification
    let velocityDegPerSec = 0;
    const lastValidPoint = [...this.recentGazePoints].reverse().find((p) => p.isValid);
    if (lastValidPoint && dt > 0.001) {
      const distPx = Math.hypot(kalmanOutput.x - lastValidPoint.x, kalmanOutput.y - lastValidPoint.y);
      const distDeg = this.pixelsToDegrees(distPx);
      velocityDegPerSec = distDeg / dt;
    }

    // Event Classification: I-VT (Velocity Threshold, default 30 deg/s for webcam)
    const VELOCITY_THRESHOLD_DEG = 30.0;
    let event: EventType = 'FIXATION';

    if (kalmanOutput.isSaccade || velocityDegPerSec > VELOCITY_THRESHOLD_DEG) {
      event = 'SACCADE';
    } else if (velocityDegPerSec > 6.0 && velocityDegPerSec <= VELOCITY_THRESHOLD_DEG) {
      event = 'PURSUIT';
    } else {
      event = 'FIXATION';
    }

    const gazePoint: GazePoint = {
      x: Math.round(kalmanOutput.x),
      y: Math.round(kalmanOutput.y),
      rawX: Math.round(correctedRawX),
      rawY: Math.round(correctedRawY),
      timestamp: currentTimeMs,
      confidence: trackingConfidence,
      isValid: true,
      event,
      velocityDegPerSec: Math.round(velocityDegPerSec * 10) / 10,
    };

    this.recentGazePoints.push(gazePoint);
    if (this.recentGazePoints.length > 90) this.recentGazePoints.shift();

    return gazePoint;
  }

  /** Fit a regularized affine screen mapping and validate it on held-out targets. */
  public fitCalibrationModel(
    samples: { targetX: number; targetY: number; rawX: number; rawY: number; yaw: number; pitch: number }[],
    holdoutTargets: { targetX: number; targetY: number; rawX: number; rawY: number; yaw: number; pitch: number }[]
  ): CalibrationModel {
    const buildRow = (sample: { rawX: number; rawY: number; yaw: number; pitch: number }) => {
      const nx = (sample.rawX - this.geometry.widthPx / 2) / 500;
      const ny = (sample.rawY - this.geometry.heightPx / 2) / 500;
      return [1, nx, ny];
    };
    const buildDefaultModel = (): CalibrationModel => ({
      polyCoeffsX: [this.geometry.widthPx / 2, 500, 0, 0, 0, 0],
      polyCoeffsY: [this.geometry.heightPx / 2, 0, 500, 0, 0, 0],
      headPoseWeightX: 0,
      headPoseWeightY: 0,
      meanAngularErrorDeg: 99,
      medianAngularErrorDeg: 99,
      meanPixelError: 999,
      isValidated: false,
      timestamp: Date.now(),
    });

    if (samples.length < 5 || holdoutTargets.length < 2) {
      this.calibrationModel = buildDefaultModel();
      return this.calibrationModel;
    }

    const rows = samples.map(buildRow);
    const coefficientsX = this.solveRidgeRegression(rows, samples.map((sample) => sample.targetX));
    const coefficientsY = this.solveRidgeRegression(rows, samples.map((sample) => sample.targetY));
    if (!coefficientsX || !coefficientsY) {
      this.calibrationModel = buildDefaultModel();
      return this.calibrationModel;
    }

    this.calibrationModel = {
      polyCoeffsX: [...coefficientsX, 0, 0, 0],
      polyCoeffsY: [...coefficientsY, 0, 0, 0],
      headPoseWeightX: 0,
      headPoseWeightY: 0,
      meanAngularErrorDeg: 99,
      medianAngularErrorDeg: 99,
      meanPixelError: 999,
      isValidated: false,
      timestamp: Date.now(),
    };

    const testSet = holdoutTargets;
    const errorsPx = testSet.map((sample) => {
      const mapped = this.applyCalibrationMapping(sample.rawX, sample.rawY, sample.yaw, sample.pitch);
      return Math.hypot(sample.targetX - mapped.x, sample.targetY - mapped.y);
    });
    const errorsDeg = errorsPx.map((error) => this.pixelsToDegrees(error)).sort((a, b) => a - b);
    const meanAngularErrorDeg = errorsDeg.reduce((total, error) => total + error, 0) / errorsDeg.length;
    const medianAngularErrorDeg = errorsDeg[Math.floor(errorsDeg.length / 2)] ?? meanAngularErrorDeg;
    const meanPixelError = errorsPx.reduce((total, error) => total + error, 0) / errorsPx.length;

    this.calibrationModel = {
      ...this.calibrationModel,
      meanAngularErrorDeg: Math.round(meanAngularErrorDeg * 100) / 100,
      medianAngularErrorDeg: Math.round(medianAngularErrorDeg * 100) / 100,
      meanPixelError: Math.round(meanPixelError),
      isValidated: samples.length >= 5 && meanAngularErrorDeg <= 3.8,
    };
    return this.calibrationModel;
  }

  private solveRidgeRegression(rows: number[][], targets: number[]): number[] | null {
    const size = rows[0]?.length ?? 0;
    if (size === 0 || rows.length !== targets.length) return null;
    const augmented = Array.from({ length: size }, () => Array(size + 1).fill(0));

    rows.forEach((row, sampleIndex) => {
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) augmented[i][j] += row[i] * row[j];
        augmented[i][size] += row[i] * targets[sampleIndex];
      }
    });
    for (let i = 1; i < size; i++) augmented[i][i] += 1e-3;

    for (let column = 0; column < size; column++) {
      let pivot = column;
      for (let row = column + 1; row < size; row++) {
        if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
      }
      if (Math.abs(augmented[pivot][column]) < 1e-12) return null;
      [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];

      const divisor = augmented[column][column];
      for (let j = column; j <= size; j++) augmented[column][j] /= divisor;
      for (let row = 0; row < size; row++) {
        if (row === column) continue;
        const factor = augmented[row][column];
        for (let j = column; j <= size; j++) augmented[row][j] -= factor * augmented[column][j];
      }
    }

    const coefficients = augmented.map((row) => row[size]);
    return coefficients.every(Number.isFinite) ? coefficients : null;
  }

  private applyCalibrationMapping(rawX: number, rawY: number, yaw: number, pitch: number): { x: number; y: number } {
    if (!this.calibrationModel) return { x: rawX, y: rawY };

    const nx = (rawX - this.geometry.widthPx / 2) / 500;
    const ny = (rawY - this.geometry.heightPx / 2) / 500;
    const features = [1, nx, ny, nx * nx, nx * ny, ny * ny];
    const model = this.calibrationModel;
    const x =
      features.reduce((total, feature, index) => total + feature * model.polyCoeffsX[index], 0) +
      yaw * model.headPoseWeightX;
    const y =
      features.reduce((total, feature, index) => total + feature * model.polyCoeffsY[index], 0) +
      pitch * model.headPoseWeightY;

    return {
      x: Math.max(0, Math.min(this.geometry.widthPx, x)),
      y: Math.max(0, Math.min(this.geometry.heightPx, y)),
    };
  }

  /**
   * Tolerant hit-testing: checks if gaze is inside AOI radius + calibration-error margin
   */
  public isGazeInAOI(
    gazeX: number,
    gazeY: number,
    targetX: number,
    targetY: number,
    targetRadius: number,
    toleranceMarginMultiplier: number = 1.3
  ): boolean {
    const calMarginPx =
      this.calibrationModel?.isValidated && Number.isFinite(this.calibrationModel.meanPixelError)
        ? Math.min(100, Math.max(35, this.calibrationModel.meanPixelError * 0.4))
        : 35;
    const effectiveRadius = (targetRadius + calMarginPx) * toleranceMarginMultiplier;
    return Math.hypot(gazeX - targetX, gazeY - targetY) <= effectiveRadius;
  }
}

export const gazePipeline = new GazePipeline();
