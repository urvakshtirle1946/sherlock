// transcriptAnalysis.ts
// Signal extractor: detect when the interviewer addresses someone by the
// candidate's name in the transcript.
//
// Weight: 20% — when it fires, it's nearly definitive (the interviewer
// directly linked a name to a voice). But it only fires when Whisper
// transcription is available and the interviewer actually uses the name.
//
// Pattern: "Hi Rahul", "Can you hear me Rahul", "Rahul can you explain",
//           "thank you Rahul", "@Rahul" etc.
//
// Note: this uses a regex/NER heuristic, NOT an LLM.
// The LLM is only used downstream for prose explanation, never for scoring.

export interface SignalResult {
  score: number;
  confidence: number;
  reason: string;
}

/**
 * Scans a transcript chunk for direct address of the candidate by name.
 * Returns score 1.0 if a strong pattern fires, 0.6 for a weaker one (just
 * the name appearing in context), 0 if not found.
 *
 * @param transcriptText - Whisper transcription of the current audio chunk
 * @param candidateName  - Full name from the session record
 */
export function transcriptAnalysisSignal(
  transcriptText: string,
  candidateName: string
): Omit<SignalResult, 'confidence'> {
  if (!transcriptText || !candidateName) {
    return { score: 0, reason: 'No transcript or candidate name available' };
  }

  const text = transcriptText.toLowerCase();
  const nameLower = candidateName.trim().toLowerCase();
  const firstName = nameLower.split(/\s+/)[0];

  // ── Strong patterns: direct address with greeting or question marker ────────
  // Examples: "hi rahul", "okay rahul,", "rahul can you", "thanks rahul"
  const strongPatterns = [
    new RegExp(`\\b(hi|hey|hello|okay|ok|thanks|thank you|alright)\\s+${escapeRegex(firstName)}\\b`),
    new RegExp(`\\b${escapeRegex(firstName)}\\s+(can you|could you|would you|please|are you)\\b`),
    new RegExp(`\\b(can you hear me|are you there)\\s*,?\\s*${escapeRegex(firstName)}\\b`),
    // Full name direct address
    new RegExp(`\\b${escapeRegex(nameLower)}\\b.*\\?`),
  ];

  for (const pattern of strongPatterns) {
    if (pattern.test(text)) {
      return {
        score: 1,
        reason: `Interviewer directly addressed candidate by name ("${firstName}")`,
      };
    }
  }

  // ── Weak patterns: name appears in transcript but not as a clear address ───
  if (text.includes(firstName) || text.includes(nameLower)) {
    return {
      score: 0.5,
      reason: `Candidate name "${firstName}" appears in transcript (not a confirmed direct address)`,
    };
  }

  return {
    score: 0,
    reason: `No reference to "${candidateName}" found in transcript`,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
