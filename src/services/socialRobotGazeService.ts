import type { FourEyeFeatures } from './socialRobotGazeFeatures';

export interface ScreenGazePrediction {
  x: number;
  y: number;
  confidence: number;
  receivedAt: number;
}

interface HealthResponse {
  ok: boolean;
  model_loaded?: boolean;
  feature_version?: string;
  error?: string;
}

interface GazeResponse {
  valid: boolean;
  x?: number;
  y?: number;
  confidence?: number;
  error?: string;
}

class SocialRobotGazeService {
  private modelReady = false;
  private checkingHealth = false;
  private inferenceInFlight = false;
  private serviceError: string | null = null;

  public isReady(): boolean {
    return this.modelReady;
  }

  public isInferenceInFlight(): boolean {
    return this.inferenceInFlight;
  }

  public getError(): string | null {
    return this.serviceError;
  }

  public async checkHealth(): Promise<boolean> {
    if (this.checkingHealth) return this.modelReady;
    this.checkingHealth = true;
    try {
      const response = await fetch('/api/health');
      const body: HealthResponse = await response.json();
      this.modelReady =
        response.ok &&
        body.ok &&
        body.model_loaded === true &&
        body.feature_version === 'v5_eye_features_4';
      this.serviceError = this.modelReady
        ? null
        : body.error || `Four-feature gaze service is unavailable or incompatible (HTTP ${response.status}).`;
      return this.modelReady;
    } catch (error) {
      this.modelReady = false;
      this.serviceError =
        error instanceof Error
          ? `Cannot reach the local four-feature gaze service: ${error.message}`
          : 'Cannot reach the local four-feature gaze service.';
      return false;
    } finally {
      this.checkingHealth = false;
    }
  }

  public async submitFeatures(
    features: FourEyeFeatures,
    screenWidth: number,
    screenHeight: number,
    confidence: number
  ): Promise<ScreenGazePrediction | null> {
    if (!this.modelReady || this.inferenceInFlight) return null;
    this.inferenceInFlight = true;
    try {
      const response = await fetch('/api/gaze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features,
          screen_width: screenWidth,
          screen_height: screenHeight,
          confidence,
        }),
      });
      const body: GazeResponse = await response.json();
      if (!response.ok || !body.valid) {
        throw new Error(body.error || `Four-feature gaze inference failed (HTTP ${response.status}).`);
      }
      if (
        typeof body.x !== 'number' ||
        !Number.isFinite(body.x) ||
        typeof body.y !== 'number' ||
        !Number.isFinite(body.y) ||
        typeof body.confidence !== 'number' ||
        !Number.isFinite(body.confidence)
      ) {
        throw new Error('Four-feature gaze service returned invalid screen coordinates.');
      }
      this.serviceError = null;
      return { x: body.x, y: body.y, confidence: body.confidence, receivedAt: performance.now() };
    } catch (error) {
      this.serviceError = error instanceof Error ? error.message : 'Four-feature gaze inference failed.';
      console.error('[SocialRobotGazeService] Inference request failed:', error);
      return null;
    } finally {
      this.inferenceInFlight = false;
    }
  }
}

export const socialRobotGazeService = new SocialRobotGazeService();
