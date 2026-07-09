// joinOrder.ts
// Signal extractor: first joiner gets a small positive nudge.
//
// Weight: 3% — near-negligible tie-breaker only.
// Rationale: candidates sometimes join early to test their setup, but often
// don't. Interviewers routinely join first. This is a weak heuristic, not a
// meaningful identifier, hence the tiny weight.

export interface SignalResult {
  score: number;
  confidence: number;
  reason: string;
}

/**
 * Returns a score based on join position.
 * joinIndex is 0-based (0 = first joiner).
 *
 * Score curve:
 *   0 (first)  → 1.0
 *   1 (second) → 0.5
 *   2+         → 0.0
 *
 * This is intentionally steep — the signal is only meaningful for the very
 * first joiner vs everyone else.
 */
export function joinOrderSignal(joinIndex: number): Omit<SignalResult, 'confidence'> {
  if (joinIndex === 0) {
    return { score: 1.0, reason: 'First to join the meeting' };
  }
  if (joinIndex === 1) {
    return { score: 0.5, reason: 'Second to join the meeting' };
  }
  return { score: 0, reason: `Joined in position ${joinIndex + 1}` };
}
