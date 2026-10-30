# Eye-play — Gaze-guided play with Bao the Panda

Eye-play is a browser-based visual-attention and concentration game prototype. It uses MediaPipe FaceLandmarker in the browser and a four-feature Ridge gaze model in a local Python service. Camera frames are processed in the browser; the service receives only four normalized eye features and returns predicted screen coordinates. Touch and mouse interaction is available as an accessible alternative.

Project repository: [https://github.com/yeswanth4115/Eye-play](https://github.com/yeswanth4115/Eye-play)

## Requirements

- Windows 10 or 11
- Git
- Node.js 20.19+ or 22.12+ (includes npm)
- Python 3.10+
- A webcam for camera gaze mode

Use a browser that supports webcam access, such as current Chrome or Edge. Camera access requires `localhost` or HTTPS.

## First-time setup

### 1. Get the project

To clone the project from GitHub, open PowerShell and run:

```powershell
git clone https://github.com/yeswanth4115/Eye-play.git
cd Eye-play
```

If the project is already downloaded, change to its project directory instead. For this checkout, that is:

```powershell
cd "C:\Users\Yeswanth Kumar\Downloads\pips-meadow-complete-game\Concentration_game-main"
```

Run the remaining commands from the project root—the folder containing `package.json`, `backend`, and `scripts`.

### 2. Install Python dependencies and validate the bundled gaze model

In PowerShell from the project root:

```powershell
python -m pip install -r backend\requirements.txt
python scripts\validate_eye_gaze_model.py
```

The supplied four-feature EyeGazeTracker model, its evaluation metadata, and `calibration_raw.csv` are bundled locally. The supplied `.pkl` bytes match the model binary already present in the starting Eye-play archive, so the model weights themselves were not newly retrained in this integration; the accuracy improvement path is the participant-specific calibration mapping, reused across all games. The validation script checks their schema without downloading or overwriting the calibrated model. Keep using the same Python installation for installing dependencies and starting the service. If `python` is not recognized, install Python and enable the Python launcher/PATH, or use `py` consistently in place of `python`.

### 3. Install JavaScript dependencies

In the project root:

```powershell
npm install
```

## Run the application

The app uses two local processes. Keep each one running in a separate PowerShell terminal. After installation and model setup, runtime assets are local; the face tracker no longer falls back to external CDNs.

### Terminal 1: gaze model service

From the project root:

```powershell
python backend\social_robot_gaze_server.py
```

The service listens on `http://127.0.0.1:8765`. Leave this terminal open.

### Terminal 2: web application

Open a second PowerShell terminal, change to the project root, and run:

```powershell
cd "C:\Users\Yeswanth Kumar\Downloads\pips-meadow-complete-game\Concentration_game-main"
npm run dev
```

If you cloned the repository into a different directory, replace the `cd` path with your own project path. Open the local URL printed by Vite, usually `http://localhost:3000/`. Vite proxies the app's `/api` requests to the gaze model service on port 8765.

To confirm that the local service and bundled model are ready, open `http://localhost:3000/api/health` in the browser (use the Vite port printed in your terminal if it differs). A healthy response includes `"ok":true`, `"model_loaded":true`, `"feature_count":4`, and `"feature_version":"v5_eye_features_4"`.

To stop either process, focus its terminal and press `Ctrl+C`.

### Optional: start the backend automatically on Windows logon

After installing the Python requirements, open PowerShell in the project root and run:

```powershell
.\scripts\windows\install-eyeplay-backend-task.ps1
```

This registers a per-user Task Scheduler task named `EyePlayGazeBackend`, starts it, ignores duplicate instances, and retries up to three times at one-minute intervals after a failure and appends stdout/stderr to `logs\eyeplay-backend.log`. Check its health at `http://127.0.0.1:8765/api/health`. Remove the task with:

```powershell
.\scripts\windows\uninstall-eyeplay-backend-task.ps1
```

The computer must be powered on and the user logged in for this per-user task to run. The Vite frontend still needs to be started separately with `npm run dev` unless it is packaged/hosted locally by a separate deployment step.

## Camera setup and calibration

Eye-play now remembers a **validated calibration mapping** for a participant code on this browser/device for up to 30 days. When the same participant returns, the readiness check offers **Start Play with Saved Setup** if the display shape is compatible and the saved mapping passes basic integrity checks. The camera and gaze service must still pass the live readiness check each session. If the screen shape changes significantly, the model version changes, or the saved mapping expires, the app falls back to the pretrained model and offers optional calibration. Poor live tracking must be corrected before gaze play can start; it is not treated as a child performance result. Saved calibration is local browser data; it does not save webcam images. Clearing browser site data removes it.


1. Start both the Python service and Vite as described above, then open the Vite `localhost` URL.
2. Select **Camera Eye Gaze** on the welcome screen and choose **Let's Play Together!**.
3. Enter a non-identifying participant code. Do not enter a full name or other personal information. Choose an activity if prompted, then select **Check Camera Readiness**.
4. On the camera check screen, select **Enable Camera** and allow camera access in the browser. Sit facing the camera with your face centered in the guide. Use steady, even lighting, keep your eyes and face visible, and avoid large head movements.
5. Wait for the readiness indicators to confirm the camera is active, a face is detected, and the four-feature gaze model is tracking.
6. Select **Start Play with Pre-trained Model** on a first session. Calibration is optional and disabled by default; the pretrained model provides gaze estimates without asking the child to complete the star task. To offer calibration, an adult can enable **Enable Optional Gaze Calibration** in Settings and choose **Optional: improve the screen mapping**. The calibration sequence has 13 stars: 9 mapping targets and 4 separate validation targets. Calibration starts from Settings → Gaze Calibration and is applied consistently to all five games.
7. If a validated calibration exists for the same participant code and a compatible display, the button says **Start Play with Saved Setup**. Saved calibration is reused for up to 30 days. The live camera and model checks still run at every session; if tracking is unreliable, adjust the camera or use **Touch Mode**.
8. During play, keep a comfortable distance and posture. The gaze cursor is hidden by default so the child does not see their estimated eye movement. Games start with up to 30 seconds and can continue for up to 15 more seconds when gaze is near a target; each game records an outcome even when its target is not reached. The butterfly activity reports a gaze-following estimate when gaze data is available. This is an activity result, not a medical or validated concentration measure. An adult can enable calibration in Settings before pressing **R** or choosing recalibration during a pause.

The adult Settings screen opens the in-app EyeGazeTracker calibration sequence. It uses live predictions from the bundled four-feature model, fits and validates a participant/display-specific screen mapping, saves it locally, and reuses it across the five games. This screen mapping does not retrain the shared model. The stored `calibration_raw.csv` documents the supplied model training targets; `concentration_session.csv` is historical gameplay data and is not treated as calibration training data. The pretrained model can be used without individual calibration, but screen positions may be less precise. A validated mapping may be reused for up to 30 days on the same browser/device when the screen shape is compatible. The validation threshold is a prototype criterion, not a guarantee of accurate gaze tracking.

## Troubleshooting

- **`requirements.txt` or script not found:** First `cd` to the project root. In PowerShell, confirm `Get-Location` shows the folder containing `backend`, `scripts`, and `package.json`.
- **Model service does not start or reports no model:** Run `python scripts\validate_eye_gaze_model.py` and check that the model and metadata exist in `backend\model_assets\social_robot_gaze`. The validation command does not download or overwrite model files.
- **The health page is unavailable:** Make sure the Python service is still running in Terminal 1. The default service port is 8765; check that another process is not already using it.
- **The health page reports the wrong feature count or version:** Confirm that the browser is reaching the service started from this project and rerun `python scripts\validate_eye_gaze_model.py`.
- **Camera is denied or unavailable:** Allow camera access for the `localhost` site in browser settings, close other applications that may be using the camera, then reload the page and enable the camera again. Camera permissions are not available on ordinary non-localhost HTTP sites.
- **No face is detected:** Move into the camera frame, face the camera, improve lighting, and make sure the camera lens is not covered.
- **The model is ready but the gaze dot misses the star:** Keep your face centered and still, look directly at the star, and wait for stable tracking. Retry calibration; use Touch Mode if the gaze mapping remains unreliable.
- **Port 3000 is busy:** Use the alternate local URL printed by Vite and append `/api/health` to that URL when checking service readiness.
- **Python or npm command is not recognized:** Install Python or Node.js, enable the command-line PATH option, reopen PowerShell, and retry.

## Development checks

Run these from the project root:

```powershell
npm test
npm run lint
npm run build
```

## Model details and limitations

Eye-play uses the supplied EyeGazeTracker four-feature Ridge-polynomial model (`v5_eye_features_4`) and its affine correction metadata. The model receives the same four normalized iris-to-eye features used by the EyeGazeTracker calibration code. The four inputs are normalized horizontal and vertical iris positions for the left and right eyes. They are computed from browser-side face landmarks; camera images are not sent to the Python service or stored by it.

The supplied EyeGazeTracker metadata reports **85.4 px mean**, **77.4 px median**, and **355.9 px worst-case** held-out calibration-target error for the four-feature model. These are the model’s recorded cross-validation figures, not a guarantee for a particular child or device. The calibration data contains 50 target rows from a 1536×864 screen; the app rescales predicted coordinates for the current display. This is a research prototype for coarse gaze interaction, not reliable point-and-click tracking or a clinical tool. Accuracy varies with the user, camera, lighting, posture, and display. Calibration can help with per-session offsets but cannot guarantee accuracy. Gaze estimates do not establish attention, comprehension, diagnosis, or developmental status. Switch to Touch Mode whenever gaze tracking is not useful.

Participant profiles and session summaries are stored in browser-local storage. Use pseudonyms. Optional voice guidance uses browser speech synthesis and can be disabled in the app.

### Full participant-specific EyeGazeTracker calibration

In Adult Settings, choose **Start full gaze calibration**. EyePlay releases its browser webcam stream, starts the bundled `04_calibration.py` runner in a separate resizable target window, and displays collection progress in Settings. The child should look at each target while seated in the same position and lighting used for play. When the 50-point run finishes successfully, the backend copies the newly fitted model and metadata into the active model directory, reloads the inference model, and Settings reacquires the browser camera. This calibration uses the Python runner's own camera capture; do not start another app that is using the webcam during the run. If the runner fails, check the calibration log at `backend/calibration_runtime/calibration.log`.
