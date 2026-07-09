// routes/signals.ts
// Manual signal injection endpoint — used by the simulator and, optionally,
// for testing specific signal types in isolation.
import { Router, Request, Response } from 'express';
import ParticipantSignal, { SignalType } from '../models/ParticipantSignal';
import { SIGNAL_WEIGHTS } from '../engines/confidenceEngine';

const router = Router();

// Validate session ID parameter format to prevent MongoDB CastError
router.param('id', (req, res, next, id) => {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return res.status(404).json({ error: 'Session not found (invalid ID format)' });
  }
  next();
});


// POST /api/sessions/:id/signals — inject a single signal
router.post('/:id/signals', async (req: Request, res: Response) => {
  try {
    const { participantId, type, value, reason } = req.body as {
      participantId: string;
      type: SignalType;
      value: number;
      reason: string;
    };

    const weight = SIGNAL_WEIGHTS[type] ?? 0;
    const signal = await ParticipantSignal.create({
      sessionId: req.params.id,
      participantId,
      type,
      value: Math.min(Math.max(value, 0), 1),
      weight,
      confidence: Math.min(Math.max(value, 0), 1) * weight,
      reason,
      timestamp: new Date(),
    });
    res.status(201).json(signal);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// GET /api/sessions/:id/signals — fetch signal history for a session
router.get('/:id/signals', async (req: Request, res: Response) => {
  const { participantId, type, limit } = req.query;
  const query: Record<string, unknown> = { sessionId: req.params.id };
  if (participantId) query.participantId = participantId;
  if (type) query.type = type;
  const signals = await ParticipantSignal.find(query)
    .sort({ timestamp: -1 })
    .limit(parseInt((limit as string) ?? '500', 10));
  res.json(signals);
});

export default router;
