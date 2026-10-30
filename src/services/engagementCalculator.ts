import { GazePoint, EngagementWindowMetrics, AOIRegion } from '../types';

export class EngagementCalculator {
  private windowDurationMs: number = 7000; // Sliding window: 7 seconds (5-10s requirement)
  private buffer: { point: GazePoint; inAOI: boolean }[] = [];

  // Configurable weights (default 0.3 / 0.3 / 0.4, w1+w2+w3 = 1)
  private w1: number = 0.3; // Fixation ratio
  private w2: number = 0.3; // Gaze stability (1 - var_gaze / var_max)
  private w3: number = 0.4; // Time in AOI ratio

  // Maximum spatial variance benchmark (in px^2) representing wide wandering across screen
  private maxVariancePx2: number = 70000;

  constructor(w1 = 0.3, w2 = 0.3, w3 = 0.4, windowDurationMs = 7000) {
    this.w1 = w1;
    this.w2 = w2;
    this.w3 = w3;
    this.windowDurationMs = windowDurationMs;
  }

  public setWeights(w1: number, w2: number, w3: number) {
    const total = w1 + w2 + w3;
    if (total > 0) {
      this.w1 = w1 / total;
      this.w2 = w2 / total;
      this.w3 = w3 / total;
    }
  }

  public addSample(point: GazePoint, activeAOIs: AOIRegion[] = []) {
    let inAOI = false;
    if (point.isValid && activeAOIs.length > 0) {
      inAOI = activeAOIs.some((aoi) => {
        const radius = aoi.radius || (aoi.width ? aoi.width / 2 : 50);
        return Math.hypot(point.x - aoi.x, point.y - aoi.y) <= radius;
      });
    }

    this.buffer.push({ point, inAOI });

    // Prune points older than sliding window
    const cutoff = point.timestamp - this.windowDurationMs;
    while (this.buffer.length > 0 && this.buffer[0].point.timestamp < cutoff) {
      this.buffer.shift();
    }
  }

  public reset() {
    this.buffer = [];
  }

  public computeMetrics(currentTimestamp: number): EngagementWindowMetrics {
    const totalFrames = this.buffer.length;
    if (totalFrames === 0) {
      return {
        timestamp: currentTimestamp,
        engagementIndex: 0.5,
        fixationRatio: 0.5,
        gazeStability: 0.5,
        aoiRatio: 0.5,
        validSampleRate: 0,
        isReliable: false,
      };
    }

    // Filter valid frames (missing frames excluded from denominators as required by prompt)
    const validFrames = this.buffer.filter((item) => item.point.isValid);
    const validSampleRate = (validFrames.length / totalFrames) * 100;
    const isReliable = validSampleRate >= 60; // Gated: marked "unreliable" if valid-sample rate < 60%

    if (validFrames.length === 0) {
      return {
        timestamp: currentTimestamp,
        engagementIndex: 0.0,
        fixationRatio: 0.0,
        gazeStability: 0.0,
        aoiRatio: 0.0,
        validSampleRate: 0,
        isReliable: false,
      };
    }

    const D_total = validFrames.length;

    // Term 1: Fixation duration ratio (D_fix / D_total)
    const D_fix = validFrames.filter((item) => item.point.event === 'FIXATION' || item.point.event === 'PURSUIT').length;
    const term1_fixation = Math.max(0.0, Math.min(1.0, D_fix / D_total));

    // Term 2: Gaze stability (1 - var_gaze / var_max)
    let meanX = 0;
    let meanY = 0;
    validFrames.forEach((item) => {
      meanX += item.point.x;
      meanY += item.point.y;
    });
    meanX /= D_total;
    meanY /= D_total;

    let varianceSum = 0;
    validFrames.forEach((item) => {
      const dx = item.point.x - meanX;
      const dy = item.point.y - meanY;
      varianceSum += dx * dx + dy * dy;
    });
    const var_gaze = varianceSum / D_total;
    const term2_stability = Math.max(0.0, Math.min(1.0, 1.0 - var_gaze / this.maxVariancePx2));

    // Term 3: Time on AOI ratio (T_AOI / D_total)
    const T_AOI = validFrames.filter((item) => item.inAOI).length;
    const term3_aoi = Math.max(0.0, Math.min(1.0, T_AOI / D_total));

    // Compute Engagement Index
    const EI = this.w1 * term1_fixation + this.w2 * term2_stability + this.w3 * term3_aoi;
    const clippedEI = Math.max(0.0, Math.min(1.0, EI));

    return {
      timestamp: currentTimestamp,
      engagementIndex: Math.round(clippedEI * 100) / 100,
      fixationRatio: Math.round(term1_fixation * 100) / 100,
      gazeStability: Math.round(term2_stability * 100) / 100,
      aoiRatio: Math.round(term3_aoi * 100) / 100,
      validSampleRate: Math.round(validSampleRate),
      isReliable,
    };
  }
}

export const engagementCalculator = new EngagementCalculator();
