// screenShare.ts
// Signal extractor: active screen sharing during an interview.
//
// In a technical/coding interview, the candidate sharing their screen to
// show code is a moderately strong signal. However, interviewers sometimes
// share their screen too (showing a problem statement), so this isn't
// definitive alone — it contributes alongside other signals.
//
// Weight is handled by the Confidence Engine; this extractor just returns
// the raw score.

export interface SignalResult {
  score: number;
  confidence: number;
  reason: string;
}

export interface ScreenShareInput {
  currentlySharing: boolean;
  // Total seconds the participant has been screen-sharing this session
  totalSharingSeconds: number;
  // Total meeting duration in seconds
  totalMeetingSeconds: number;
}

/**
 * Returns a score that combines whether they're currently sharing AND
 * the cumulative fraction of the meeting they've shared.
 *
 * Currently sharing → score ≥ 0.8 (interview is happening right now)
 * Shared in the past → proportional to how much of the meeting they shared
 */
export function screenShareSignal(input: ScreenShareInput): Omit<SignalResult, 'confidence'> {
  const { currentlySharing, totalSharingSeconds, totalMeetingSeconds } = input;

  if (!currentlySharing && totalSharingSeconds === 0) {
    return { score: 0, reason: 'No screen sharing activity detected' };
  }

  if (currentlySharing) {
    return { score: 0.9, reason: 'Currently sharing screen (active during interview)' };
  }

  const ratio = totalMeetingSeconds > 0 ? totalSharingSeconds / totalMeetingSeconds : 0;
  const score = Math.min(ratio * 0.8, 0.7); // past sharing capped at 0.7

  return {
    score,
    reason: `Shared screen for ${(ratio * 100).toFixed(0)}% of meeting duration`,
  };
}
