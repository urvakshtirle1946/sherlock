// explanationEngine.ts
// Converts the Confidence Engine's numeric evidence breakdown into a
// human-readable explanation string.
//
// Two-path design:
//   • If OPENAI_API_KEY is present → GPT-4o-mini formats the pre-computed
//     numbers into polished prose. The LLM receives the breakdown as JSON
//     and is explicitly instructed NOT to change the numbers. Its only job
//     is formatting. See systemPrompt below.
//   • If OPENAI_API_KEY is absent → a deterministic template produces a
//     perfectly readable explanation. The system is fully functional without
//     the API key.
//
// IMPORTANT: The LLM never touches the confidence score or weights.
// Scoring lives entirely in confidenceEngine.ts, in plain inspectable code.

import OpenAI from 'openai';
import { EvidenceEntry, PredictionResult } from './confidenceEngine';

let openai: OpenAI | null = null;
let modelName = 'gpt-4o-mini';

if (process.env.NVIDIA_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: 'https://integrate.api.nvidia.com/v1',
  });
  modelName = 'meta/llama-3.1-70b-instruct';
  console.log('[explanationEngine] NVIDIA API Key available — using Llama 3.1 instruct via NVIDIA NIM');
} else if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  modelName = 'gpt-4o-mini';
  console.log('[explanationEngine] OpenAI available — prose explanations enabled');
} else {
  console.log('[explanationEngine] No NVIDIA_API_KEY or OPENAI_API_KEY — using template fallback');
}

// ── LLM system prompt — strictly constrains the model to prose only ─────────
const SYSTEM_PROMPT = `You are a concise explanation writer for a candidate-identification system.
You will receive a JSON object with a participant name, a confidence score (0-1), and per-signal evidence.
Your job: write ONE clear, factual paragraph (2-4 sentences) explaining WHY this person is the likely candidate.
Rules:
1. Do NOT change any numbers. Quote them exactly as provided.
2. Do NOT make up signals that aren't in the evidence.
3. Do NOT use hedging language like "might", "possibly", or "could be".
4. Write in plain English. No markdown, no bullet points.
5. If ambiguous=true, acknowledge the uncertainty explicitly.`;

/**
 * Build a deterministic template explanation from evidence breakdown.
 * Used when OpenAI is unavailable or as a fallback.
 */
function buildTemplateExplanation(result: PredictionResult): string {
  const top = Object.entries(result.evidenceBreakdown)
    .filter(([, e]) => e.contribution > 0)
    .sort(([, a], [, b]) => b.contribution - a.contribution)
    .slice(0, 3);

  const topSignals = top
    .map(([type, e]) => {
      const label = type.replace(/_/g, ' ');
      return `${label} (${(e.contribution * 100).toFixed(0)}% contribution: ${e.reason})`;
    })
    .join('; ');

  const ambiguityNote = result.ambiguous
    ? ' Note: confidence is close to the next-ranked participant — treat this prediction with caution.'
    : '';

  return (
    `${result.displayName} is the most likely candidate with a confidence score of ` +
    `${(result.confidenceScore * 100).toFixed(0)}%. ` +
    `Key evidence: ${topSignals}.${ambiguityNote}`
  );
}

/**
 * Generate a prose explanation for the top prediction.
 * Falls back gracefully to the template if OpenAI is unavailable or errors out.
 */
export async function generateExplanation(result: PredictionResult): Promise<string> {
  // Always build the template first — it's the ground truth
  const template = buildTemplateExplanation(result);

  if (!openai) return template;

  const payload = {
    participantName: result.displayName,
    confidenceScore: result.confidenceScore,
    ambiguous: result.ambiguous,
    evidence: result.evidenceBreakdown,
  };

  try {
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(payload, null, 2) },
      ],
      max_tokens: 200,
      temperature: 0.3, // low temperature → consistent, factual output
    });

    const prose = response.choices[0]?.message?.content?.trim();
    return prose || template;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[explanationEngine] LLM generation error, falling back to template:', msg);
    return template;
  }
}

/**
 * Build the structured per-signal breakdown string for the dashboard
 * Explainability Panel (separate from the prose paragraph).
 */
export function formatEvidenceBreakdown(breakdown: Record<string, EvidenceEntry>): string {
  const lines = Object.entries(breakdown)
    .filter(([, e]) => e.rawScore > 0)
    .sort(([, a], [, b]) => b.contribution - a.contribution)
    .map(([type, e]) => {
      const label = type.replace(/_/g, ' ');
      const contrib = (e.contribution * 100).toFixed(0);
      const raw = (e.rawScore * 100).toFixed(0);
      return `• ${label}: ${contrib}% (raw ${raw}%, weight ${(e.weight * 100).toFixed(0)}%) — ${e.reason}`;
    });

  return lines.join('\n') || '• No active signals';
}
