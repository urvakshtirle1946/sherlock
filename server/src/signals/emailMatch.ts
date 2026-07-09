// emailMatch.ts
// Signal extractor: match participant email against the candidate's email.
//
// Email is a very strong signal when present (15% weight) because it's an
// account-level identifier, not a display-name the user chose.
// It is often absent (external participants, anonymised IDs) so this signal
// produces score=0 rather than penalising participants without a visible email.

export interface SignalResult {
  score: number;
  confidence: number;
  reason: string;
}

/**
 * Returns 1.0 for an exact email match, 0.7 for same domain + matching local
 * part prefix (handles corporate variants like first.last@company.com vs
 * firstlast@company.com), and 0 otherwise.
 */
export function emailMatchSignal(
  participantEmail: string | undefined,
  candidateEmail: string
): Omit<SignalResult, 'confidence'> {
  if (!participantEmail) {
    return { score: 0, reason: 'Participant email not available' };
  }

  const pEmail = participantEmail.trim().toLowerCase();
  const cEmail = candidateEmail.trim().toLowerCase();

  if (pEmail === cEmail) {
    return { score: 1, reason: `Exact email match: ${pEmail}` };
  }

  // Parse both
  const [pLocal, pDomain] = pEmail.split('@');
  const [cLocal, cDomain] = cEmail.split('@');

  if (!pDomain || !cDomain) {
    return { score: 0, reason: 'Malformed email address' };
  }

  // Same domain + the local parts share ≥60% of characters (handles
  // first.last vs firstlast, or first vs firstname)
  if (pDomain === cDomain) {
    const commonLen = longestCommonSubstring(pLocal, cLocal);
    const similarity = commonLen / Math.max(pLocal.length, cLocal.length);
    const hasContainment = pLocal.includes(cLocal) || cLocal.includes(pLocal);
    const hasSharedPrefix = pLocal.startsWith(cLocal.slice(0, 3)) || cLocal.startsWith(pLocal.slice(0, 3));

    if (similarity >= 0.5 || (hasContainment && hasSharedPrefix)) {
      return {
        score: 0.7,
        reason: `Same email domain, similar local part: ${pEmail} ≈ ${cEmail}`,
      };
    }
    return {
      score: 0.2,
      reason: `Same email domain, different local part: ${pEmail} vs ${cEmail}`,
    };
  }

  return { score: 0, reason: `Email domain mismatch: ${pEmail} vs ${cEmail}` };
}

/** Returns the length of the longest common substring between two strings. */
function longestCommonSubstring(a: string, b: string): number {
  let max = 0;
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        max = Math.max(max, dp[i][j]);
      }
    }
  }
  return max;
}
