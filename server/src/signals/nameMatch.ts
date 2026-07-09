// nameMatch.ts
// Signal extractor: fuzzy match between a participant's display name and the
// candidate's known name.
//
// Uses Fuse.js with a threshold tuned for real-world name variants:
//   "Rahul Sharma" → "rahul", "R. Sharma", "Rahul S", "rahulS"
// Weight is intentionally low (10%) because display names are easily faked.

import Fuse from 'fuse.js';

export interface SignalResult {
  score: number;      // 0–1 (1 = perfect match)
  confidence: number; // score × weight (filled in by the Confidence Engine)
  reason: string;
}

/**
 * Returns a fuzzy-match score between the participant's display name and the
 * candidate's name.  Score is 0 when there is no overlap at all, 1 for an
 * exact case-insensitive match.
 *
 * @param displayName - The participant's name as seen in the meeting UI
 * @param candidateName - The candidate's full name from the session record
 */
export function nameMatchSignal(
  displayName: string,
  candidateName: string
): Omit<SignalResult, 'confidence'> {
  if (!displayName || !candidateName) {
    return { score: 0, reason: 'Missing display name or candidate name' };
  }

  const display = displayName.trim().toLowerCase();
  const candidate = candidateName.trim().toLowerCase();

  // Exact match shortcut
  if (display === candidate) {
    return { score: 1, reason: `Exact name match: "${displayName}"` };
  }

  // Build a small corpus of name variants to match against
  const candidateTokens = candidate.split(/\s+/);
  const nameCandidates = [
    candidate,                              // full name
    candidateTokens[0],                     // first name only
    candidateTokens[candidateTokens.length - 1], // last name only
    // "R. Sharma" style initials
    candidateTokens.length > 1
      ? `${candidateTokens[0][0]}. ${candidateTokens.slice(1).join(' ')}`
      : candidate,
  ].filter(Boolean);

  const fuse = new Fuse(nameCandidates, {
    includeScore: true,
    threshold: 0.45, // 0 = perfect, 1 = match anything; 0.45 allows reasonable partial matches
  });

  const results = fuse.search(display);

  if (!results.length || results[0].score === undefined) {
    return { score: 0, reason: `No name match found for "${displayName}"` };
  }

  // Fuse score is inverse (0 = best); convert to 0–1 where 1 = best
  const score = Math.max(0, 1 - results[0].score);

  if (score < 0.3) {
    return { score: 0, reason: `Name "${displayName}" does not resemble "${candidateName}"` };
  }

  return {
    score,
    reason: `Name "${displayName}" fuzzy-matches "${candidateName}" (score: ${(score * 100).toFixed(0)}%)`,
  };
}
