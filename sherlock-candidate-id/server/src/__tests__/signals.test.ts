// __tests__/signals.test.ts
// Unit tests for all signal extractors.
// Each test uses mocked/inline input — no database, no live meeting.
// Run with: cd server && npm test

import { nameMatchSignal } from '../signals/nameMatch';
import { emailMatchSignal } from '../signals/emailMatch';
import { voiceActivitySignal } from '../signals/voiceActivity';
import { transcriptAnalysisSignal } from '../signals/transcriptAnalysis';
import { joinOrderSignal } from '../signals/joinOrder';
import { cameraPresenceSignal } from '../signals/cameraPresence';
import { screenShareSignal } from '../signals/screenShare';
import { computePredictions, SIGNAL_WEIGHTS } from '../engines/confidenceEngine';

// ── Name Match ────────────────────────────────────────────────────────────────
describe('nameMatchSignal', () => {
  it('returns score=1 for exact match', () => {
    const result = nameMatchSignal('Rahul Sharma', 'Rahul Sharma');
    expect(result.score).toBe(1);
  });

  it('returns high score for first-name-only match', () => {
    const result = nameMatchSignal('Rahul', 'Rahul Sharma');
    expect(result.score).toBeGreaterThan(0.6);
  });

  it('returns score=0 for completely unrelated name', () => {
    const result = nameMatchSignal('MacBook Pro', 'Rahul Sharma');
    expect(result.score).toBe(0);
  });

  it('handles missing display name gracefully', () => {
    const result = nameMatchSignal('', 'Rahul Sharma');
    expect(result.score).toBe(0);
    expect(result.reason).toBeTruthy();
  });

  it('returns moderate score for "R. Sharma" variant', () => {
    const result = nameMatchSignal('R. Sharma', 'Rahul Sharma');
    expect(result.score).toBeGreaterThan(0.3);
  });
});

// ── Email Match ───────────────────────────────────────────────────────────────
describe('emailMatchSignal', () => {
  it('returns score=1 for exact email match', () => {
    const result = emailMatchSignal('rahul@company.com', 'rahul@company.com');
    expect(result.score).toBe(1);
  });

  it('returns score≈0.7 for same domain, similar local part', () => {
    const result = emailMatchSignal('rahul.sharma@company.com', 'rahul@company.com');
    expect(result.score).toBeGreaterThanOrEqual(0.7);
  });

  it('returns score=0 for completely different email', () => {
    const result = emailMatchSignal('bob@other.com', 'rahul@company.com');
    expect(result.score).toBe(0);
  });

  it('returns score=0 when participant email is absent', () => {
    const result = emailMatchSignal(undefined, 'rahul@company.com');
    expect(result.score).toBe(0);
    expect(result.reason).toContain('not available');
  });
});

// ── Voice Activity ────────────────────────────────────────────────────────────
describe('voiceActivitySignal', () => {
  it('returns score proportional to speaking ratio', () => {
    const result = voiceActivitySignal({ participantSpeakingSeconds: 60, totalMeetingSeconds: 120 });
    expect(result.score).toBeCloseTo(0.5, 1);
  });

  it('returns score=0 when meeting has not started', () => {
    const result = voiceActivitySignal({ participantSpeakingSeconds: 0, totalMeetingSeconds: 0 });
    expect(result.score).toBe(0);
  });

  it('caps score at 1 even if ratio > 1', () => {
    const result = voiceActivitySignal({ participantSpeakingSeconds: 200, totalMeetingSeconds: 100 });
    expect(result.score).toBe(1);
  });

  it('applies long-turn bonus for speeches ≥ 30s', () => {
    const withBonus = voiceActivitySignal({
      participantSpeakingSeconds: 60,
      totalMeetingSeconds: 240,
      longestContinuousSpeechSeconds: 35,
    });
    const withoutBonus = voiceActivitySignal({ participantSpeakingSeconds: 60, totalMeetingSeconds: 240 });
    expect(withBonus.score).toBeGreaterThan(withoutBonus.score);
  });
});

// ── Transcript Analysis ───────────────────────────────────────────────────────
describe('transcriptAnalysisSignal', () => {
  it('returns score=1 for direct address with greeting', () => {
    const result = transcriptAnalysisSignal('Hi Rahul, can you explain your approach?', 'Rahul Sharma');
    expect(result.score).toBe(1);
  });

  it('returns score=1 for question-form direct address', () => {
    const result = transcriptAnalysisSignal('Rahul can you walk me through this?', 'Rahul Sharma');
    expect(result.score).toBe(1);
  });

  it('returns score=0.5 for name appearing without clear address', () => {
    const result = transcriptAnalysisSignal("I was reading about Rahul's solution", 'Rahul Sharma');
    expect(result.score).toBe(0.5);
  });

  it('returns score=0 when name is absent', () => {
    const result = transcriptAnalysisSignal('Can you explain the algorithm?', 'Rahul Sharma');
    expect(result.score).toBe(0);
  });
});

// ── Join Order ────────────────────────────────────────────────────────────────
describe('joinOrderSignal', () => {
  it('returns 1.0 for first joiner', () => {
    expect(joinOrderSignal(0).score).toBe(1.0);
  });

  it('returns 0.5 for second joiner', () => {
    expect(joinOrderSignal(1).score).toBe(0.5);
  });

  it('returns 0 for third+ joiner', () => {
    expect(joinOrderSignal(2).score).toBe(0);
    expect(joinOrderSignal(5).score).toBe(0);
  });
});

// ── Camera Presence ───────────────────────────────────────────────────────────
describe('cameraPresenceSignal', () => {
  it('returns score=1 for full camera-on session', () => {
    const result = cameraPresenceSignal({ cameraOnRatio: 1, currentlyOn: true });
    expect(result.score).toBe(1);
  });

  it('returns score=0 for camera always off', () => {
    const result = cameraPresenceSignal({ cameraOnRatio: 0, currentlyOn: false });
    expect(result.score).toBe(0);
  });

  it('returns partial score for 50% camera-on', () => {
    const result = cameraPresenceSignal({ cameraOnRatio: 0.5, currentlyOn: false });
    expect(result.score).toBeCloseTo(0.5, 1);
  });
});

// ── Screen Share ──────────────────────────────────────────────────────────────
describe('screenShareSignal', () => {
  it('returns high score (0.9) when currently sharing', () => {
    const result = screenShareSignal({ currentlySharing: true, totalSharingSeconds: 60, totalMeetingSeconds: 120 });
    expect(result.score).toBe(0.9);
  });

  it('returns score=0 when never shared', () => {
    const result = screenShareSignal({ currentlySharing: false, totalSharingSeconds: 0, totalMeetingSeconds: 120 });
    expect(result.score).toBe(0);
  });
});

// ── Confidence Engine ─────────────────────────────────────────────────────────
describe('computePredictions', () => {
  it('SIGNAL_WEIGHTS sum to 1.0 (excluding screen_share=0)', () => {
    const sum = Object.values(SIGNAL_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('ranks clear candidate first', () => {
    const participants = [
      {
        participantId: 'p1',
        displayName: 'Rahul Sharma',
        signals: {
          name_match: { rawScore: 1, reason: 'exact match' },
          email_match: { rawScore: 1, reason: 'exact' },
          face_match: { rawScore: 0.9, reason: 'strong match' },
          voice_activity: { rawScore: 0.7, reason: '70% speaking' },
          transcript_reference: { rawScore: 1, reason: 'addressed by name' },
          join_order: { rawScore: 1, reason: 'first' },
          camera_presence: { rawScore: 1, reason: 'camera on' },
        },
      },
      {
        participantId: 'p2',
        displayName: 'Interviewer',
        signals: {
          voice_activity: { rawScore: 0.3, reason: '30% speaking' },
          camera_presence: { rawScore: 1, reason: 'camera on' },
        },
      },
    ];

    const results = computePredictions(participants);
    expect(results[0].participantId).toBe('p1');
    expect(results[0].confidenceScore).toBeGreaterThan(0.7);
    expect(results[0].rank).toBe(1);
  });

  it('reports ambiguous when top-2 are within 5 pp', () => {
    const participants = [
      {
        participantId: 'p1',
        displayName: 'Guest 1',
        signals: { voice_activity: { rawScore: 0.55, reason: 'speaking' } },
      },
      {
        participantId: 'p2',
        displayName: 'Guest 2',
        signals: { voice_activity: { rawScore: 0.5, reason: 'speaking' } },
      },
    ];

    const results = computePredictions(participants);
    // Both scores are close — p1 should be rank 1 but ambiguous
    expect(results[0].ambiguous).toBe(true);
  });

  it('adversarial: chatty non-candidate does not beat face+email+transcript match', () => {
    const participants = [
      {
        participantId: 'candidate',
        displayName: 'Rahul Sharma',
        signals: {
          face_match: { rawScore: 0.9, reason: 'strong match' },
          email_match: { rawScore: 1, reason: 'exact' },
          transcript_reference: { rawScore: 1, reason: 'addressed' },
          voice_activity: { rawScore: 0.2, reason: '20% speaking' },
        },
      },
      {
        participantId: 'chatty',
        displayName: 'MacBook Pro',
        signals: {
          voice_activity: { rawScore: 0.9, reason: '90% speaking' },
        },
      },
    ];

    const results = computePredictions(participants);
    expect(results[0].participantId).toBe('candidate');
  });
});
