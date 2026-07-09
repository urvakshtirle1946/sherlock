// voiceActivity.ts
// Signal extractor: speaking-time ratio.
//
// Weight: 20% — strong behavioural signal but gameable by a chatty non-candidate.
// Capped at 20% specifically to prevent a talkative interviewer/third-party from
// dominating the score.
//
// In the Playwright-ingestion path, "speaking" is DOM-derived (CSS speaking
// indicator), not audio-derived — this is documented in the README.
// In the simulator path, "speaking" is manually toggled.

export interface SignalResult {
  score: number;      // 0–1
  confidence: number; // filled by Confidence Engine
  reason: string;
}

export interface VoiceActivityInput {
  participantSpeakingSeconds: number;
  totalMeetingSeconds: number;
  // Optional extras for richer signal composition
  longestContinuousSpeechSeconds?: number;
  speakingTurnCount?: number;
}

/**
 * Returns a score based on the participant's speaking ratio and, optionally,
 * the length of their longest continuous speech (as proxy for "answering").
 *
 * Pure ratio is easy to game; the bonus for long continuous turns rewards
 * interview-style answering rather than frequent short interjections.
 */
export function voiceActivitySignal(input: VoiceActivityInput): Omit<SignalResult, 'confidence'> {
  const { participantSpeakingSeconds, totalMeetingSeconds, longestContinuousSpeechSeconds } = input;

  if (totalMeetingSeconds <= 0) {
    return { score: 0, reason: 'Meeting has not started yet' };
  }

  const ratio = Math.min(participantSpeakingSeconds / totalMeetingSeconds, 1);

  // Bonus: if the participant has at least one turn ≥ 30 s, add a small bump
  // (a 30-second continuous answer suggests they're responding to interview Qs)
  const longTurnBonus =
    longestContinuousSpeechSeconds && longestContinuousSpeechSeconds >= 30 ? 0.1 : 0;

  const score = Math.min(ratio + longTurnBonus, 1);

  const pct = (ratio * 100).toFixed(0);
  const longest = longestContinuousSpeechSeconds
    ? `; longest turn ${longestContinuousSpeechSeconds.toFixed(0)} s`
    : '';

  return {
    score,
    reason: `Speaking ${pct}% of meeting duration${longest}`,
  };
}
