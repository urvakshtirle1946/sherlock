// routes/participants.ts
import { Router, Request, Response } from 'express';
import Participant from '../models/Participant';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Validate session ID parameter format to prevent MongoDB CastError
router.param('id', (req, res, next, id) => {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return res.status(404).json({ error: 'Session not found (invalid ID format)' });
  }
  next();
});


// POST /api/sessions/:id/participants — add participant to session
router.post('/:id/participants', async (req: Request, res: Response) => {
  try {
    const { displayName, email, participantId } = req.body;
    const participant = await Participant.create({
      sessionId: req.params.id,
      participantId: participantId ?? uuidv4(),
      displayName,
      email: email?.toLowerCase(),
      joinedAt: new Date(),
      cameraOn: req.body.cameraOn ?? false,
      microphoneOn: req.body.microphoneOn ?? false,
      screenSharing: req.body.screenSharing ?? false,
      totalSpeakingSeconds: 0,
    });
    res.status(201).json(participant);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// PATCH /api/sessions/:id/participants/:pid — update state (camera, speaking, etc.)
router.patch('/:id/participants/:pid', async (req: Request, res: Response) => {
  const participant = await Participant.findOneAndUpdate(
    { sessionId: req.params.id, participantId: req.params.pid },
    { $set: req.body },
    { new: true }
  );
  if (!participant) return res.status(404).json({ error: 'Participant not found' });
  res.json(participant);
});

// DELETE /api/sessions/:id/participants/:pid — mark left
router.delete('/:id/participants/:pid', async (req: Request, res: Response) => {
  const participant = await Participant.findOneAndUpdate(
    { sessionId: req.params.id, participantId: req.params.pid },
    { leftAt: new Date() },
    { new: true }
  );
  if (!participant) return res.status(404).json({ error: 'Participant not found' });
  res.json(participant);
});

export default router;
