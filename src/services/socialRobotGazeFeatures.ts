export type FourEyeFeatures = readonly [number, number, number, number];

export interface EyeLandmark {
  x: number;
  y: number;
}

const LEFT_IRIS = [468, 469, 470, 471, 472];
const RIGHT_IRIS = [473, 474, 475, 476, 477];
const LEFT_EYE_CORNERS = [33, 133] as const;
const RIGHT_EYE_CORNERS = [362, 263] as const;
const MIN_EYE_WIDTH = 0.001;

function irisCenter(landmarks: readonly EyeLandmark[], indices: readonly number[]): [number, number] {
  return [
    indices.reduce((sum, index) => sum + landmarks[index].x, 0) / indices.length,
    indices.reduce((sum, index) => sum + landmarks[index].y, 0) / indices.length,
  ];
}

function normalizedEye(
  landmarks: readonly EyeLandmark[],
  corners: readonly [number, number],
  iris: readonly [number, number]
): [number, number] | null {
  const first = landmarks[corners[0]];
  const second = landmarks[corners[1]];
  const width = Math.abs(second.x - first.x);
  if (width < MIN_EYE_WIDTH) return null;

  return [
    (iris[0] - (first.x + second.x) / 2) / width,
    (iris[1] - (first.y + second.y) / 2) / width,
  ];
}

export function extractFourEyeFeatures(landmarks: readonly EyeLandmark[]): FourEyeFeatures | null {
  if (landmarks.length < 478) return null;
  const left = normalizedEye(landmarks, LEFT_EYE_CORNERS, irisCenter(landmarks, LEFT_IRIS));
  const right = normalizedEye(landmarks, RIGHT_EYE_CORNERS, irisCenter(landmarks, RIGHT_IRIS));
  if (!left || !right) return null;

  const features: FourEyeFeatures = [left[0], left[1], right[0], right[1]];
  return features.every(Number.isFinite) ? features : null;
}
