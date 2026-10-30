# Eye-play integration status

## Implemented in this source update

- [x] Integrated the supplied EyeGazeTracker metadata and `calibration_raw.csv`; confirmed that the supplied `gaze_model.pkl` is byte-identical to the model binary already bundled in the starting Eye-play archive, so this update does not claim newly retrained model weights.
- [x] Bundled `calibration_raw.csv` alongside the model as calibration provenance. The model validation script checks the expected four-feature schema and calibration columns without downloading or overwriting the supplied model.
- [x] Preserved the local Python inference API and updated its health response to expose the supplied model calibration metadata and recorded cross-validation error figures.
- [x] Added the EyeGazeTracker calibration status and recorded model error information to adult Settings. The existing calibration activity fits a participant/display-specific mapping from live tracker predictions and saves validated results locally.
- [x] Reuse a compatible saved participant calibration at session start so the same mapping applies across all five games, regardless of whether the optional recalibration switch is currently enabled.
- [x] Record paired butterfly target and gaze coordinates during valid gaze samples, save them with the game result, and add a report tab overlaying butterfly movement, estimated gaze, separation samples, mean distance, and the activity following estimate.
- [x] Add a positive appreciation screen after each game, with spoken encouragement when voice guidance is enabled. Missing gaze data gets a neutral retry message rather than a false low-performance claim.
- [x] Remove browser CDN fallbacks for MediaPipe WASM and face-landmarker assets; the app now fails with a local-asset error rather than silently requesting remote assets.
- [x] Add optional Windows Task Scheduler scripts for backend-at-logon startup, restart-on-failure, duplicate-instance protection, and local log capture.
- [x] Update setup/troubleshooting documentation and pin scikit-learn to the model's recorded 1.9.1 serialization version.

## Verification performed in this environment

- [x] `npm run lint` — passed (TypeScript type-check).
- [x] `python scripts/validate_eye_gaze_model.py` — passed; 50 calibration target rows validated and the four-feature model produced finite predictions. The environment emitted a scikit-learn 1.9.1-to-1.8.0 compatibility warning; the project requirements now pin 1.9.1 to match the model serialization version.
- [ ] `npm test` — could not run here because the supplied `node_modules` contains the Windows `esbuild` binary, while this execution environment is Linux. Reinstall JavaScript dependencies on the target OS before running tests.
- [ ] `npm run build` — not verified for the same OS-specific `esbuild` dependency reason.
- [ ] Flask API smoke test — not run here because Flask is not installed in the execution environment; install `backend/requirements.txt` before starting the backend.
- [ ] Real webcam accuracy, camera permission/disconnection recovery, child-facing game flow, actual offline runtime, and Windows Task Scheduler startup were not hardware/OS-tested in this environment.

## Accuracy and data interpretation notes

The supplied metadata records held-out calibration-target errors of 85.4 px mean, 77.4 px median, and 355.9 px worst case, based on the model's 50 calibration targets. These figures are metadata for the same model binary, not a newly retrained model, and are not a guarantee of live accuracy. The app reports game-specific tracking behaviour, not clinical concentration or diagnosis. `concentration_session.csv` is historical gameplay output and is deliberately not treated as ground-truth calibration training data. Older saved sessions cannot show the new paired butterfly trace retroactively.

## Follow-up changes (2026-10-30)

- Added a Settings control to launch the supplied `04_calibration.py` as a non-blocking backend process. The child-facing target collector runs in a separate resizable window; Settings polls `/api/calibration/status` for point progress and accepted-point count.
- The browser camera stream is released before the Python collector starts and reacquired after a successful calibration, avoiding two processes competing for the webcam.
- The calibration runner uses the supplied `gaze_features.py` and bundled `face_landmarker.task`. After successful training, its new `gaze_model.pkl` and metadata replace the active service model and are loaded into memory. This is genuine participant-specific model fitting from newly collected samples, unlike merely checking whether the old model is ready.
- Updated Picnic Berry Trail: the strawberry begins at a fixed start marker, attaches only after a sustained gaze on that marker, and then moves monotonically along a straight horizontal lane. Vertical gaze movement no longer sends it around the screen; pointer dragging was removed.
- Added a slower staged reveal to the end-of-session summary and a delayed, fade-in appreciation transition after each non-butterfly game. The continue/report actions remain disabled until the child has had time to see the message.
- Python syntax compilation passed for the backend and calibration runner. Frontend lint/build could not be rerun in this runtime because the project dependencies are not installed here; the prior package's earlier lint pass predates these follow-up edits. Webcam calibration and Windows camera reacquisition still require a real-device test.
