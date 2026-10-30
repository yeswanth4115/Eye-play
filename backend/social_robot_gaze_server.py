"""Local inference service for the pinned four-feature social-robot gaze model."""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import joblib
import numpy as np
from flask import Flask, jsonify, request


MODEL_DIR = Path(__file__).resolve().parent / "model_assets" / "social_robot_gaze"
MODEL_PATH = MODEL_DIR / "gaze_model.pkl"
METADATA_PATH = MODEL_DIR / "gaze_model_metadata.json"
MODEL_COMMIT = "c489af120772040a39d6a80dad37ca7c3c7a7423"
FEATURE_VERSION = "v5_eye_features_4"
FEATURE_NAMES = ["left_h", "left_v", "right_h", "right_v"]

app = Flask(__name__)
model = None
metadata: dict = {}
affine_correction: np.ndarray | None = None
initialization_error: str | None = None
CALIBRATION_DIR = Path(__file__).resolve().parent / "calibration_runtime"
CALIBRATION_LOG = CALIBRATION_DIR / "calibration.log"
calibration_process: subprocess.Popen | None = None
calibration_started_at: float | None = None
calibration_artifacts_loaded = False


def _load_model() -> None:
    global model, metadata, affine_correction, initialization_error
    try:
        with METADATA_PATH.open("r", encoding="utf-8") as metadata_file:
            loaded_metadata = json.load(metadata_file)
        if (
            loaded_metadata.get("feature_version") != FEATURE_VERSION
            or loaded_metadata.get("feature_count") != 4
            or loaded_metadata.get("feature_names") != FEATURE_NAMES
        ):
            raise ValueError("Downloaded model is not the expected four-feature model.")
        if loaded_metadata.get("use_head_pose") is not False:
            raise ValueError("Four-feature model metadata unexpectedly enables head-pose inputs.")

        loaded_model = joblib.load(MODEL_PATH)
        if getattr(loaded_model, "n_features_in_", None) != len(FEATURE_NAMES):
            raise ValueError("The gaze model input shape does not match its four-feature metadata.")

        base_width = loaded_metadata.get("screen_width")
        base_height = loaded_metadata.get("screen_height")
        if not isinstance(base_width, (int, float)) or not isinstance(base_height, (int, float)):
            raise ValueError("Model metadata is missing its training screen geometry.")
        if base_width <= 0 or base_height <= 0:
            raise ValueError("Model metadata contains invalid screen dimensions.")

        correction_value = loaded_metadata.get("affine_correction")
        correction = None if correction_value is None else np.asarray(correction_value, dtype=float)
        if correction is not None and (
            correction.shape != (3, 2) or not np.all(np.isfinite(correction))
        ):
            raise ValueError("Model metadata contains an invalid affine correction.")

        model = loaded_model
        metadata = loaded_metadata
        affine_correction = correction
        initialization_error = None
    except Exception as error:
        initialization_error = f"Could not load the four-feature gaze model: {error}"
        app.logger.exception(initialization_error)


@app.get("/api/health")
@app.get("/health")
def health():
    ready = model is not None
    return jsonify({
        "ok": ready,
        "model_loaded": ready,
        "model_type": metadata.get("model_type"),
        "feature_version": metadata.get("feature_version", FEATURE_VERSION),
        "feature_count": metadata.get("feature_count", 4),
        "calibration_quality": metadata.get("calibration_quality"),
        "cv_mean_error_px": metadata.get("cv_mean_error_px"),
        "cv_median_error_px": metadata.get("cv_median_error_px"),
        "cv_worst_error_px": metadata.get("cv_worst_error_px"),
        "n_calibration_points": metadata.get("n_calibration_points"),
        "screen_width": metadata.get("screen_width"),
        "screen_height": metadata.get("screen_height"),
        "error": initialization_error,
    }), 200 if ready else 503



def _calibration_status() -> dict:
    global calibration_process
    log_text = CALIBRATION_LOG.read_text(encoding="utf-8", errors="replace") if CALIBRATION_LOG.exists() else ""
    matches = re.findall(r"Collecting point (\d+)/(\d+)", log_text)
    current, total = (int(matches[-1][0]), int(matches[-1][1])) if matches else (0, 50)
    accepted = len(re.findall(r"Accepted \d+/\d+ samples", log_text))
    running = calibration_process is not None and calibration_process.poll() is None
    code = calibration_process.poll() if calibration_process is not None else None
    state = "running" if running else "completed" if code == 0 else "failed" if code is not None else "idle"
    error = None
    if state == "failed":
        error = "Calibration did not complete. Check lighting, camera access, and the calibration log."
    return {"state": state, "current_point": current, "total_points": total, "accepted_points": accepted, "progress": round(current / max(total, 1) * 100), "error": error, "log_tail": "\n".join(log_text.splitlines()[-8:])}


@app.get("/api/calibration/status")
def calibration_status():
    status = _calibration_status()
    global calibration_artifacts_loaded
    if status["state"] == "completed" and not calibration_artifacts_loaded:
        trained_model = CALIBRATION_DIR / "gaze_model.pkl"
        trained_metadata = CALIBRATION_DIR / "gaze_model_metadata.json"
        if trained_model.exists() and trained_metadata.exists():
            shutil.copy2(trained_model, MODEL_PATH)
            shutil.copy2(trained_metadata, METADATA_PATH)
            _load_model()
            calibration_artifacts_loaded = True
    status["model_loaded"] = model is not None
    status["calibration_quality"] = metadata.get("calibration_quality")
    status["cv_median_error_px"] = metadata.get("cv_median_error_px")
    return jsonify(status)


@app.post("/api/calibration/start")
def start_calibration():
    global calibration_process, calibration_started_at, calibration_artifacts_loaded
    if calibration_process is not None and calibration_process.poll() is None:
        return jsonify({"ok": False, "error": "Calibration is already running."}), 409
    command = [sys.executable, "-u", "04_calibration.py"]
    calibration_artifacts_loaded = False
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    log_handle = CALIBRATION_LOG.open("w", encoding="utf-8")
    try:
        calibration_process = subprocess.Popen(command, cwd=CALIBRATION_DIR, stdout=log_handle, stderr=subprocess.STDOUT)
        calibration_started_at = __import__("time").time()
    except Exception:
        log_handle.close()
        raise
    # The child process owns the log handle until it exits.
    return jsonify({"ok": True, "state": "running", "message": "EyeGazeTracker calibration started in the background. Its target window will appear for the child to follow."}), 202

@app.post("/api/gaze")
def gaze():
    if model is None:
        return jsonify({"valid": False, "error": initialization_error or "The gaze model is unavailable."}), 503

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"valid": False, "error": "A JSON request body is required."}), 400

    try:
        features = np.asarray(payload.get("features"), dtype=np.float64)
        if features.shape != (4,) or not np.all(np.isfinite(features)):
            raise ValueError("Exactly four finite eye features are required.")

        try:
            screen_width = float(payload.get("screen_width"))
            screen_height = float(payload.get("screen_height"))
            confidence = float(payload.get("confidence", 1.0))
        except (TypeError, ValueError):
            raise ValueError("Numeric screen_width, screen_height and confidence values are required.")
        if (
            not np.isfinite(screen_width)
            or not np.isfinite(screen_height)
            or screen_width <= 0
            or screen_height <= 0
        ):
            raise ValueError("Positive screen dimensions are required.")
        if not np.isfinite(confidence) or not 0 <= confidence <= 1:
            raise ValueError("Confidence must be between zero and one.")

        prediction = np.asarray(model.predict(features.reshape(1, 4)), dtype=np.float64).reshape(-1)
        if prediction.shape != (2,) or not np.all(np.isfinite(prediction)):
            raise ValueError("The gaze model returned invalid screen coordinates.")

        if affine_correction is not None:
            prediction = np.array([prediction[0], prediction[1], 1.0]) @ affine_correction

        base_width = float(metadata["screen_width"])
        base_height = float(metadata["screen_height"])
        x = float(np.clip(prediction[0] * screen_width / base_width, 0, screen_width))
        y = float(np.clip(prediction[1] * screen_height / base_height, 0, screen_height))
        return jsonify({
            "valid": True,
            "x": x,
            "y": y,
            "confidence": confidence,
            "feature_version": FEATURE_VERSION,
            "model_type": metadata.get("model_type"),
        })
    except (TypeError, ValueError, OverflowError) as error:
        return jsonify({"valid": False, "error": str(error)}), 400
    except Exception:
        app.logger.exception("Four-feature gaze inference failed.")
        return jsonify({"valid": False, "error": "Four-feature gaze inference failed."}), 500


_load_model()


if __name__ == "__main__":
    if model is None:
        raise SystemExit(initialization_error)
    logging.basicConfig(level=logging.INFO)
    print("Four-feature local gaze service: http://127.0.0.1:8765/api/health")
    app.run(host="127.0.0.1", port=8765, debug=False, threaded=True)
