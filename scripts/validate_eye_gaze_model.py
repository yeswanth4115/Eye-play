"""Validate the bundled EyeGazeTracker model without network access or overwriting it.

The model was calibrated from the supplied EyeGazeTracker calibration_raw.csv. This
script intentionally does not download the older upstream model, because doing so
would silently replace the improved local calibration.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "backend" / "model_assets" / "social_robot_gaze"
EXPECTED_FEATURES = ["left_h", "left_v", "right_h", "right_v"]

def main() -> None:
    model_path = MODEL_DIR / "gaze_model.pkl"
    metadata_path = MODEL_DIR / "gaze_model_metadata.json"
    calibration_path = MODEL_DIR / "calibration_raw.csv"
    if not model_path.is_file() or not metadata_path.is_file():
        raise SystemExit("Bundled EyeGazeTracker model files are missing. Restore backend/model_assets/social_robot_gaze.")
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if (metadata.get("feature_version") != "v5_eye_features_4"
        or metadata.get("feature_count") != 4
        or metadata.get("feature_names") != EXPECTED_FEATURES
        or metadata.get("use_head_pose") is not False):
        raise SystemExit("Bundled model metadata does not match the expected four-feature EyeGazeTracker format.")
    model = joblib.load(model_path)
    if getattr(model, "n_features_in_", None) != 4:
        raise SystemExit("Bundled model does not accept exactly four eye features.")
    if calibration_path.is_file():
        import csv
        with calibration_path.open(newline="", encoding="utf-8") as handle:
            rows = list(csv.DictReader(handle))
        if not rows or not all(name in rows[0] for name in EXPECTED_FEATURES + ["target_x", "target_y"]):
            raise SystemExit("Calibration source CSV is missing required feature/target columns.")
        print(f"Validated {len(rows)} stored calibration target rows.")
    print("Bundled EyeGazeTracker model validated; no network access used and no files overwritten.")
    print(f"Model: {metadata.get('model_type', 'unknown')} | held-out mean error: {metadata.get('cv_mean_error_px', 'not recorded')} px | median: {metadata.get('cv_median_error_px', 'not recorded')} px")

if __name__ == "__main__":
    main()
