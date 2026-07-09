// routes/sessions.ts
import { Router, Request, Response } from 'express';
import Session from '../models/Session';
import Participant from '../models/Participant';
import CandidatePrediction from '../models/CandidatePrediction';
import ParticipantSignal, { SignalType } from '../models/ParticipantSignal';
import { SIGNAL_WEIGHTS } from '../engines/confidenceEngine';
import { faceVerificationCached } from '../signals/faceVerification';
import fs from 'fs';
import path from 'path';

const router = Router();

// Validate session ID parameter format to prevent MongoDB CastError
router.param('id', (req, res, next, id) => {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return res.status(404).json({ error: 'Session not found (invalid ID format)' });
  }
  next();
});


// POST /api/sessions — create a new session
router.post('/', async (req: Request, res: Response) => {
  try {
    const { candidateName, candidateEmail, candidatePhotoUrl, meetingUrl, meetingPlatform } =
      req.body;
    const session = await Session.create({
      candidateName,
      candidateEmail: candidateEmail?.toLowerCase(),
      candidatePhotoUrl: candidatePhotoUrl ?? '',
      meetingUrl: meetingUrl ?? '',
      meetingPlatform: meetingPlatform ?? 'google_meet',
      status: 'pending',
    });
    res.status(201).json(session);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// POST /api/sessions/join — create session and call Recall.ai bot to join the live meeting
router.post('/join', async (req: Request, res: Response) => {
  try {
    const { candidateName, candidateEmail, candidatePhotoUrl, meetingUrl, meetingPlatform } = req.body;

    const recallApiKey = process.env.RECALLAI_API_KEY;
    if (!recallApiKey) {
      return res.status(400).json({
        error: 'RECALLAI_API_KEY is not configured in .env. Live Meet mode requires a Recall.ai API key.',
      });
    }

    // 1. Create the session in the database with status 'active' and ingestionMode 'live'
    const session = await Session.create({
      candidateName,
      candidateEmail: candidateEmail?.toLowerCase(),
      candidatePhotoUrl: candidatePhotoUrl ?? '',
      meetingUrl: meetingUrl ?? '',
      meetingPlatform: meetingPlatform ?? 'google_meet',
      status: 'active', // active immediately for live ingestion
      ingestionMode: 'live',
      startedAt: new Date(),
    });

    // 2. Prepare Webhook Callback URL
    // IMPORTANT: Recall.ai requires a trailing "/" BEFORE any query parameters.
    // See: https://docs.recall.ai/docs/real-time-webhook-endpoints
    let hostUrl = process.env.HOST_URL;
    if (!hostUrl) {
      const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
      const host = req.get('host') || 'localhost:4000';
      // Normalize protocol to https for cloud tunnels/deployments to satisfy Recall.ai
      const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
      const normalizedProto = !isLocalhost ? 'https' : proto;
      hostUrl = `${normalizedProto}://${host}`;
    }
    const webhookUrl = `${hostUrl}/api/webhooks/recall/?sessionId=${session._id}`;

    const region = process.env.RECALLAI_REGION || 'us-east-1';
    const recallApiUrl = `https://${region}.recall.ai/api/v1/bot/`;

    console.log(`[sessionsRoute] Calling Recall.ai (${region}) to join meeting ${meetingUrl} with webhook ${webhookUrl}`);

    // 3. Post to Recall.ai
    const recallResponse = await fetch(recallApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${recallApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meeting_url: meetingUrl,
        bot_name: 'Sherlock Ingestion Bot',
        recording_config: {
          realtime_endpoints: [
            {
              type: 'webhook',
              url: webhookUrl,
              events: [
                'participant_events.join',
                'participant_events.leave',
                'participant_events.speech_on',
                'participant_events.speech_off',
                'participant_events.webcam_on',
                'participant_events.webcam_off',
                'participant_events.screenshare_on',
                'participant_events.screenshare_off',
                'transcript.data'
              ]
            }
          ],
          transcript: {
            provider: {
              recallai_streaming: {}
            }
          }
        }
      })
    });

    if (!recallResponse.ok) {
      const errorText = await recallResponse.text();
      console.error(`[sessionsRoute] Recall.ai API returned error status ${recallResponse.status}: ${errorText}`);
      
      // Delete the created session to roll back
      await Session.findByIdAndDelete(session._id);

      return res.status(recallResponse.status).json({
        error: `Recall.ai API error: ${errorText}`,
      });
    }

    const recallData: any = await recallResponse.json();
    const recallBotId = recallData.id;

    // 4. Save the Recall Bot ID on the session
    session.recallBotId = recallBotId;
    await session.save();

    console.log(`[sessionsRoute] Recall.ai bot successfully created with ID: ${recallBotId}`);
    res.status(201).json(session);
  } catch (err) {
    console.error(`[sessionsRoute] Exception in /join:`, err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/sessions — list sessions
router.get('/', async (_req: Request, res: Response) => {
  const sessions = await Session.find().sort({ createdAt: -1 }).limit(50);
  res.json(sessions);
});

// GET /api/sessions/:id
import { startPlaywrightBot } from '../ingestion/playwrightBot';

const runningBots = new Map<string, () => Promise<void>>();

router.get('/:id', async (req: Request, res: Response) => {
  const session = await Session.findById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// PATCH /api/sessions/:id/status
router.patch('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body;
  const update: Record<string, unknown> = { status };
  if (status === 'active') update.startedAt = new Date();
  if (status === 'ended') update.endedAt = new Date();

  try {
    const session = await Session.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (status === 'active' && session.meetingUrl) {
      const io = req.app.get('io');
      console.log(`[sessionsRoute] Starting Playwright bot for URL: ${session.meetingUrl}`);
      
      // Start bot in background
      startPlaywrightBot(String(session._id), session.meetingUrl, io)
        .then((stopFn) => {
          runningBots.set(String(session._id), stopFn);
          console.log(`[sessionsRoute] Playwright bot running for session ${session._id}`);
        })
        .catch((err) => {
          console.error(`[sessionsRoute] Failed to start Playwright bot:`, err);
        });
    }

    if (status === 'ended') {
      const stopFn = runningBots.get(String(session._id));
      if (stopFn) {
        console.log(`[sessionsRoute] Stopping Playwright bot for session ${session._id}`);
        await stopFn().catch((e) => console.error(`[sessionsRoute] Error stopping bot:`, e));
        runningBots.delete(String(session._id));
      }

      // Terminate Recall.ai bot if this was a live ingestion session
      if (session.ingestionMode === 'live' && session.recallBotId) {
        const recallApiKey = process.env.RECALLAI_API_KEY;
        if (recallApiKey) {
          const region = process.env.RECALLAI_REGION || 'us-east-1';
          const recallDeleteUrl = `https://${region}.recall.ai/api/v1/bot/${session.recallBotId}/`;
          
          console.log(`[sessionsRoute] Deleting Recall.ai bot ${session.recallBotId} on region ${region} for session ${session._id}`);
          fetch(recallDeleteUrl, {
            method: 'DELETE',
            headers: {
              'Authorization': `Token ${recallApiKey}`,
            }
          }).then((res) => {
            if (!res.ok) {
              console.error(`[sessionsRoute] Failed to delete Recall.ai bot ${session.recallBotId}: status ${res.status}`);
            } else {
              console.log(`[sessionsRoute] Successfully deleted Recall.ai bot ${session.recallBotId}`);
            }
          }).catch((err) => {
            console.error(`[sessionsRoute] Error deleting Recall.ai bot ${session.recallBotId}:`, err);
          });
        }
      }
    }

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/sessions/:id/predictions — history for confidence graph
router.get('/:id/predictions', async (req: Request, res: Response) => {
  const predictions = await CandidatePrediction.find({ sessionId: req.params.id })
    .sort({ createdAt: -1 })
    .limit(200);
  res.json(predictions);
});

// GET /api/sessions/:id/participants
router.get('/:id/participants', async (req: Request, res: Response) => {
  const participants = await Participant.find({ sessionId: req.params.id });
  res.json(participants);
});

// POST /api/sessions/:id/face-match — receive a webcam frame and run face verification
router.post('/:id/face-match', async (req: Request, res: Response) => {
  try {
    const { frame } = req.body;
    if (!frame) return res.status(400).json({ error: 'Missing frame' });

    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (!session.candidatePhotoUrl) {
      return res.status(400).json({ error: 'No reference photo uploaded for this session' });
    }

    const filename = path.basename(session.candidatePhotoUrl);
    const refPath = path.resolve(process.env.UPLOAD_DIR ?? 'uploads', filename);

    if (!fs.existsSync(refPath)) {
      return res.status(404).json({ error: 'Reference photo file not found on server' });
    }

    const referenceBase64 = `data:image/jpeg;base64,${fs.readFileSync(refPath, 'base64')}`;

    // Find the participant in the call that matches the candidate name
    const candidateName = session.candidateName;
    const participant = await Participant.findOne({
      sessionId: req.params.id,
      displayName: { $regex: new RegExp(candidateName, 'i') },
    });

    if (!participant) {
      const result = await faceVerificationCached(
        req.params.id,
        'temp-candidate',
        frame,
        referenceBase64
      );
      return res.json({ status: 'no_participant_yet', result });
    }

    const result = await faceVerificationCached(
      req.params.id,
      participant.participantId,
      frame,
      referenceBase64
    );

    const weight = SIGNAL_WEIGHTS['face_match'] ?? 0;
    await ParticipantSignal.create({
      sessionId: req.params.id,
      participantId: participant.participantId,
      type: 'face_match',
      value: result.score,
      weight,
      confidence: result.score * weight,
      reason: result.reason,
      timestamp: new Date(),
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`session:${req.params.id}`).emit('signal_generated', {
        participantId: participant.participantId,
        type: 'face_match',
        score: result.score,
        reason: result.reason,
      });
    }

    res.json({ status: 'success', result });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
