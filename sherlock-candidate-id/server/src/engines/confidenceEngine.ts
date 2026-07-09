// confidenceEngine.ts
// Combines all signal extractor outputs into a single weighted confidence score
// for each participant, then ranks participants.
//
// Design principles:
//   • All weights are in one place (SIGNAL_WEIGHTS), each with an inline
//     comment explaining the reasoning. No magic numbers anywhere else.
//   • When the top-2 participants are within AMBIGUITY_THRESHOLD of each other,
//     the engine reports ambiguous=true rather than forcing a confident pick.
//   • Each signal's weighted contribution is preserved in evidenceBreakdown for
//     the Explanation Engine and the dashboard.
//   • A missing signal (score=0 because extractor was skipped/failed) simply
//     contributes 0 — it does not penalise the participant further.

import { SignalType } from '../models/ParticipantSignal';

// ── Weight table ────────────────────────────────────────────────────────────
// All weights must sum to 1.0.
// Adjust here; the reasoning for each value is in the inline comment.
export const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  face_match:           0.30, // Biometric — hardest to fake, most unique identifier
  voice_activity:       0.20, // Strong behavioural signal; gameable (chatty non-candidate) so capped at 20%
  transcript_reference: 0.20, // Interviewer naming someone directly is near-definitive when it fires
  email_match:          0.15, // Account-level ID; strong when present, often absent for external participants
  name_match:           0.10, // Weak alone (display names are self-chosen); fast and cheap, small contribution
  join_order:           0.03, // Tie-breaker only — candidates sometimes join early, often don't
  camera_presence:      0.02, // Mild positive; barely discriminates since most participants keep camera on
  screen_share:         0.00, // Not in original weights table — included for completeness; set explicitly if needed
  // Note: screen_share carries moderate informational value in coding interviews
  // but was omitted from the original 7-signal weighting. To enable it, redistribute
  // weight from other signals (e.g. voice_activity: 0.15, screen_share: 0.05).
};
// ────────────────────────────────────────────────────────────────────────────

// When the top-2 scores are within this many percentage points, report ambiguous.
const AMBIGUITY_THRESHOLD = 0.05; // 5 percentage points

export interface ParticipantSignalMap {
  [signalType: string]: {
    rawScore: number;   // 0–1 from the extractor
    reason: string;
  } | undefined;
}

export interface ParticipantInput {
  participantId: string;
  displayName: string;
  signals: ParticipantSignalMap;
}

export interface EvidenceEntry {
  rawScore: number;
  weight: number;
  contribution: number; // rawScore × weight
  reason: string;
}

export interface PredictionResult {
  participantId: string;
  displayName: string;
  confidenceScore: number; // 0–1 weighted sum
  evidenceBreakdown: Record<string, EvidenceEntry>;
  rank: number;           // 1 = most likely candidate
  ambiguous: boolean;     // true if within 5 pp of the next-ranked participant
}

/**
 * Given an array of participants (each with their latest signal scores),
 * compute and rank confidence scores.
 *
 * Called every ~3 seconds as new signals arrive.
 */
export function computePredictions(participants: ParticipantInput[]): PredictionResult[] {
  if (!participants.length) return [];

  // ── Step 1: compute weighted score per participant ─────────────────────────
  const scored = participants.map((p) => {
    let totalScore = 0;
    const evidenceBreakdown: Record<string, EvidenceEntry> = {};

    for (const [signalType, weight] of Object.entries(SIGNAL_WEIGHTS)) {
      if (weight === 0) continue; // skip explicitly zero-weighted signals

      const signal = p.signals[signalType];
      const rawScore = signal?.rawScore ?? 0;
      const contribution = rawScore * weight;
      totalScore += contribution;

      evidenceBreakdown[signalType] = {
        rawScore,
        weight,
        contribution,
        reason: signal?.reason ?? 'Signal not available',
      };
    }

    return {
      participantId: p.participantId,
      displayName: p.displayName,
      confidenceScore: Math.min(totalScore, 1), // clamp to [0,1]
      evidenceBreakdown,
    };
  });

  // ── Step 2: sort descending ────────────────────────────────────────────────
  scored.sort((a, b) => b.confidenceScore - a.confidenceScore);

  // ── Step 3: detect ambiguity ───────────────────────────────────────────────
  const results: PredictionResult[] = scored.map((s, idx) => {
    const nextScore = idx < scored.length - 1 ? scored[idx + 1].confidenceScore : -1;
    const ambiguous =
      idx === 0 && nextScore >= 0 && s.confidenceScore - nextScore < AMBIGUITY_THRESHOLD;

    return { ...s, rank: idx + 1, ambiguous };
  });

  return results;
}

/**
 * Returns a normalised summary string of signal contributions for logging/debugging.
 */
export function formatContributions(breakdown: Record<string, EvidenceEntry>): string {
  return Object.entries(breakdown)
    .map(([type, e]) => `${type}: ${(e.contribution * 100).toFixed(1)}%`)
    .join(', ');
}
