// cameraPresence.ts
// Signal extractor: consistent camera-on is a mild positive signal.
//
// Weight: 2% — almost all participants have cameras on anyway, so this
// barely discriminates. It mainly prevents a camera-off participant from
// tying with a camera-on candidate when all other signals are equal.

export interface SignalResult {
  score: number;
  confidence: number;
  reason: string;
}

export interface CameraPresenceInput {
  // Percentage of meeting time the camera was on, 0–1
  cameraOnRatio: number;
  // Whether the camera is currently on
  currentlyOn: boolean;
}

/**
 * Returns a score based on the proportion of meeting time the camera was on.
 * A camera that's been on throughout scores 1.0; always off scores 0.
 */
export function cameraPresenceSignal(input: CameraPresenceInput): Omit<SignalResult, 'confidence'> {
  const { cameraOnRatio, currentlyOn } = input;
  const score = Math.min(Math.max(cameraOnRatio, 0), 1);

  if (score === 0) {
    return { score: 0, reason: 'Camera has been off throughout the meeting' };
  }

  const pct = (score * 100).toFixed(0);
  const currently = currentlyOn ? 'currently on' : 'currently off';
  return {
    score,
    reason: `Camera on for ${pct}% of meeting (${currently})`,
  };
}
