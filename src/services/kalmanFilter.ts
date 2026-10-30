export interface Kalman1DState {
  p: number; // position
  v: number; // velocity
  pVar: number; // position variance
  vVar: number; // velocity variance
  pvCov: number; // position-velocity covariance
}

export class AxisKalmanFilter {
  private state: Kalman1DState | null = null;
  private defaultQ: number; // process noise
  private defaultR: number; // measurement noise
  private saccadeInnovationThreshold: number; // threshold to trigger saccade reset

  constructor(processNoise = 800.0, measurementNoise = 225.0, saccadeInnovationThreshold = 140.0) {
    this.defaultQ = processNoise;
    this.defaultR = measurementNoise;
    this.saccadeInnovationThreshold = saccadeInnovationThreshold;
  }

  public reset(): void {
    this.state = null;
  }

  public update(measurement: number, dt: number, confidence = 1.0): { position: number; velocity: number; isSaccadeReset: boolean } {
    if (!Number.isFinite(measurement)) {
      if (this.state) {
        return { position: this.state.p, velocity: 0, isSaccadeReset: false };
      }
      return { position: 0, velocity: 0, isSaccadeReset: false };
    }

    const safeDt = Math.max(0.001, Math.min(0.1, dt));

    if (!this.state) {
      this.state = {
        p: measurement,
        v: 0,
        pVar: 100.0,
        vVar: 1000.0,
        pvCov: 0.0,
      };
      return { position: measurement, velocity: 0, isSaccadeReset: false };
    }

    // 1. Predict
    // A = [[1, dt], [0, 1]]
    const predP = this.state.p + this.state.v * safeDt;
    const predV = this.state.v;

    // Process noise covariance Q: Discrete white noise acceleration model
    const dt2 = safeDt * safeDt;
    const dt3 = dt2 * safeDt;
    const dt4 = dt2 * dt2;
    const q11 = 0.25 * dt4 * this.defaultQ;
    const q12 = 0.5 * dt3 * this.defaultQ;
    const q22 = dt2 * this.defaultQ;

    const predPVar = this.state.pVar + 2 * safeDt * this.state.pvCov + dt2 * this.state.vVar + q11;
    const predVVar = this.state.vVar + q22;
    const predPvCov = this.state.pvCov + safeDt * this.state.vVar + q12;

    // 2. Innovation & Saccade Detection
    const innovation = measurement - predP;
    let isSaccadeReset = false;

    // Saccade-aware reset: if innovation exceeds saccade threshold, do NOT smooth out genuine ballistic saccades!
    if (Math.abs(innovation) > this.saccadeInnovationThreshold) {
      this.state.p = measurement;
      this.state.v = innovation / safeDt;
      this.state.pVar = 100.0;
      this.state.vVar = 1000.0;
      this.state.pvCov = 0.0;
      return { position: measurement, velocity: this.state.v, isSaccadeReset: true };
    }

    // 3. Adaptive R based on tracking confidence
    // High confidence -> smaller R (trust measurement more)
    // Low confidence -> larger R (rely more on kinematic prediction)
    const effectiveConfidence = Math.max(0.05, Math.min(1.0, confidence));
    const adaptiveR = this.defaultR / (effectiveConfidence * effectiveConfidence);

    // 4. Kalman Gain
    const S = predPVar + adaptiveR;
    const Kp = predPVar / S;
    const Kv = predPvCov / S;

    // 5. Update state
    this.state.p = predP + Kp * innovation;
    this.state.v = predV + Kv * innovation;

    this.state.pVar = (1 - Kp) * predPVar;
    this.state.vVar = predVVar - Kv * predPvCov;
    this.state.pvCov = (1 - Kp) * predPvCov;

    return {
      position: this.state.p,
      velocity: this.state.v,
      isSaccadeReset,
    };
  }

  public getPosition(): number | null {
    return this.state ? this.state.p : null;
  }
}

export class KalmanGazeFilter2D {
  private filterX: AxisKalmanFilter;
  private filterY: AxisKalmanFilter;
  private lastTimestamp: number | null = null;
  private deadZone: number;
  private maxMovement: number;
  private dropoutTimeoutMs: number;

  constructor(
    processNoise = 800.0,
    measurementNoise = 225.0,
    saccadeThreshold = 140.0,
    deadZone = 2.0,
    maxMovement = 140.0,
    dropoutTimeoutMs = 500
  ) {
    this.filterX = new AxisKalmanFilter(processNoise, measurementNoise, saccadeThreshold);
    this.filterY = new AxisKalmanFilter(processNoise, measurementNoise, saccadeThreshold);
    this.deadZone = deadZone;
    this.maxMovement = maxMovement;
    this.dropoutTimeoutMs = dropoutTimeoutMs;
  }

  public reset(): void {
    this.filterX.reset();
    this.filterY.reset();
    this.lastTimestamp = null;
  }

  public handleDropout(): void {
    this.reset();
  }

  public update(
    rawX: number,
    rawY: number,
    timestampMs: number,
    confidence = 1.0
  ): { x: number; y: number; vx: number; vy: number; isSaccade: boolean } {
    // Check dropout timeout (> 0.5s elapsed without update)
    if (this.lastTimestamp !== null && timestampMs - this.lastTimestamp > this.dropoutTimeoutMs) {
      this.reset();
    }

    const dt = this.lastTimestamp ? (timestampMs - this.lastTimestamp) / 1000.0 : 1.0 / 30.0;
    this.lastTimestamp = timestampMs;

    const prevX = this.filterX.getPosition();
    const prevY = this.filterY.getPosition();

    let targetX = rawX;
    let targetY = rawY;

    if (prevX !== null && prevY !== null) {
      const dist = Math.hypot(rawX - prevX, rawY - prevY);

      // Dead zone deadband: micro-movements under threshold are stabilized
      if (dist < this.deadZone) {
        targetX = prevX;
        targetY = prevY;
      } else if (dist > this.maxMovement && dist < 280.0) {
        // Clamp frame-to-frame non-saccadic step to maxMovement for jitter suppression
        const factor = this.maxMovement / dist;
        targetX = prevX + (rawX - prevX) * factor;
        targetY = prevY + (rawY - prevY) * factor;
      }
    }

    const resX = this.filterX.update(targetX, dt, confidence);
    const resY = this.filterY.update(targetY, dt, confidence);

    return {
      x: resX.position,
      y: resY.position,
      vx: resX.velocity,
      vy: resY.velocity,
      isSaccade: resX.isSaccadeReset || resY.isSaccadeReset,
    };
  }
}
