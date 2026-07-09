// utils/confidenceLoop.ts
// Runs every TICK_MS (3 seconds) per active session.
// For each active session:
//   1. Load latest signals for all participants
//   2. Run computePredictions
//   3. Persist top prediction to MongoDB
//   4. Generate explanation
//   5. Emit candidate_prediction + confidence_update via Socket.io

import { Server as SocketServer } from 'socket.io';
import Session from '../models/Session';
import Participant from '../models/Participant';
import ParticipantSignal, { SignalType } from '../models/ParticipantSignal';
import CandidatePrediction from '../models/CandidatePrediction';
import { computePredictions, ParticipantInput } from '../engines/confidenceEngine';
import { generateExplanation } from '../engines/explanationEngine';

const TICK_MS = 3000; // recompute every 3 seconds
// Keep only signals from the last SIGNAL_WINDOW_MS for a rolling window
const SIGNAL_WINDOW_MS = 60_000; // 60 seconds

export function registerConfidenceLoop(io: SocketServer): void {
  setInterval(async () => {
    try {
      const activeSessions = await Session.find({ status: 'active' }).select('_id').lean();
      for (const session of activeSessions) {
        await tickSession(io, String(session._id));
      }
    } catch (err) {
      console.error('[confidenceLoop] tick error:', err);
    }
  }, TICK_MS);

  console.log(`[confidenceLoop] started (tick every ${TICK_MS / 1000} s)`);
}

async function tickSession(io: SocketServer, sessionId: string): Promise<void> {
  const participants = await Participant.find({ sessionId, leftAt: { $exists: false } }).lean();
  if (!participants.length) return;

  // Fetch all signals generated during the session to get the latest value of each type
  const recentSignals = await ParticipantSignal.find({ sessionId }).lean();

  // Build a signal map per participant: { [participantId]: { [signalType]: latest } }
  const signalMap: Record<string, Record<string, { rawScore: number; reason: string }>> = {};
  for (const sig of recentSignals) {
    if (!signalMap[sig.participantId]) signalMap[sig.participantId] = {};
    const existing = signalMap[sig.participantId][sig.type];
    // Keep the latest signal for each type
    if (!existing || sig.timestamp > (existing as any)._ts) {
      signalMap[sig.participantId][sig.type] = {
        rawScore: sig.value,
        reason: sig.reason,
        _ts: sig.timestamp,
      } as any;
    }
  }

  const inputs: ParticipantInput[] = participants.map((p) => ({
    participantId: p.participantId,
    displayName: p.displayName,
    signals: signalMap[p.participantId] ?? {},
  }));

  const predictions = computePredictions(inputs);
  if (!predictions.length) return;

  const top = predictions[0];

  // Generate explanation (async, but we don't block the tick)
  const explanation = await generateExplanation(top).catch(() =>
    `${top.displayName} is the most likely candidate (${(top.confidenceScore * 100).toFixed(0)}% confidence).`
  );

  // Persist top prediction
  await CandidatePrediction.create({
    sessionId,
    participantId: top.participantId,
    confidenceScore: top.confidenceScore,
    evidenceBreakdown: top.evidenceBreakdown,
    explanation,
    ambiguous: top.ambiguous,
  });

  // Emit to all clients watching this session
  const room = `session:${sessionId}`;
  io.to(room).emit('candidate_prediction', {
    sessionId,
    predictions,
    explanation,
    ambiguous: top.ambiguous,
    ts: Date.now(),
  });
  io.to(room).emit('confidence_update', {
    sessionId,
    participantId: top.participantId,
    confidenceScore: top.confidenceScore,
    ts: Date.now(),
  });
}
