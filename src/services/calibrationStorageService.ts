import type { CalibrationModel } from '../types';

/** Stores only a validated screen-mapping model, never camera frames or images. */
const STORAGE_KEY = 'eyeplay_saved_calibration_v1';
const MAX_AGE_DAYS = 30;
const MODEL_VERSION = 'v5_eye_features_4';

interface SavedCalibration {
  participantCode: string;
  screenWidth: number;
  screenHeight: number;
  modelVersion: string;
  savedAt: number;
  model: CalibrationModel;
}

class CalibrationStorageService {
  private readAll(): SavedCalibration[] {
    if (typeof window === 'undefined') return [];
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed as SavedCalibration[] : [];
    } catch {
      return [];
    }
  }

  public hasReusable(participantCode: string, width: number, height: number): boolean {
    return this.load(participantCode, width, height) !== null;
  }

  public save(participantCode: string, width: number, height: number, model: CalibrationModel): boolean {
    const code = participantCode.trim();
    if (!code || !model.isValidated || !Number.isFinite(model.meanPixelError) || model.meanPixelError < 0) return false;
    if (typeof window === 'undefined' || width <= 0 || height <= 0) return false;
    const entry: SavedCalibration = {
      participantCode: code,
      screenWidth: width,
      screenHeight: height,
      modelVersion: MODEL_VERSION,
      savedAt: Date.now(),
      model: { ...model, polyCoeffsX: [...model.polyCoeffsX], polyCoeffsY: [...model.polyCoeffsY] },
    };
    try {
      const remaining = this.readAll().filter((item) => item.participantCode !== code).slice(0, 19);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...remaining]));
      return true;
    } catch {
      return false;
    }
  }

  public load(participantCode: string, width: number, height: number): CalibrationModel | null {
    const code = participantCode.trim();
    if (!code || typeof window === 'undefined' || width <= 0 || height <= 0) return null;
    const entry = this.readAll().find((item) => item.participantCode === code && item.modelVersion === MODEL_VERSION);
    if (!entry || !entry.model?.isValidated) return null;
    if (Date.now() - entry.savedAt > MAX_AGE_DAYS * 24 * 60 * 60 * 1000) return null;
    const oldRatio = entry.screenWidth / entry.screenHeight;
    const newRatio = width / height;
    if (!Number.isFinite(oldRatio) || Math.abs(oldRatio - newRatio) / oldRatio > 0.08) return null;
    if (!Array.isArray(entry.model.polyCoeffsX) || !Array.isArray(entry.model.polyCoeffsY)) return null;
    if (![...entry.model.polyCoeffsX, ...entry.model.polyCoeffsY].every(Number.isFinite)) return null;

    // The mapping outputs screen pixels, so adapt the output coefficients to the current resolution.
    const scaleX = width / entry.screenWidth;
    const scaleY = height / entry.screenHeight;
    return {
      ...entry.model,
      polyCoeffsX: entry.model.polyCoeffsX.map((value) => value * scaleX),
      polyCoeffsY: entry.model.polyCoeffsY.map((value) => value * scaleY),
    };
  }

  public clear(participantCode?: string): void {
    if (typeof window === 'undefined') return;
    try {
      if (!participantCode) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(this.readAll().filter((item) => item.participantCode !== participantCode.trim())));
    } catch {
      // Privacy controls should remain usable even when storage is unavailable.
    }
  }
}

export const calibrationStorageService = new CalibrationStorageService();
