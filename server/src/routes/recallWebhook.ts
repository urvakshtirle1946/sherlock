// routes/recallWebhook.ts
import { Router, Request, Response } from 'express';
import Session from '../models/Session';
import Participant from '../models/Participant';
import ParticipantSignal, { SignalType } from '../models/ParticipantSignal';
import { SIGNAL_WEIGHTS } from '../engines/confidenceEngine';
import { nameMatchSignal } from '../signals/nameMatch';
import { emailMatchSignal } from '../signals/emailMatch';
import { voiceActivitySignal } from '../signals/voiceActivity';
import { transcriptAnalysisSignal } from '../signals/transcriptAnalysis';
import { joinOrderSignal } from '../signals/joinOrder';
import { cameraPresenceSignal } from '../signals/cameraPresence';
import { screenShareSignal } from '../signals/screenShare';

const router = Router();

// In-memory mapping to track speaking start times: "sessionId:participantId" -> epoch timestamp
const speakingStartTimes = new Map<string, number>();

// POST /api/webhooks/recall
router.post('/', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    console.warn('[recallWebhook] Webhook received without sessionId query parameter.');
    return res.status(400).json({ error: 'Missing sessionId query parameter' });
  }

  const { event, data } = req.body;
  if (!event || !data) {
    console.warn('[recallWebhook] Invalid payload - missing event or data:', JSON.stringify(req.body).slice(0, 500));
    return res.status(400).json({ error: 'Invalid webhook payload structure' });
  }

  // Log raw payload for debugging (truncated)
  console.log(`[recallWebhook] Received event="${event}" for session=${sessionId}`);
  console.log(`[recallWebhook] Payload: ${JSON.stringify(req.body).slice(0, 800)}`);

  // Respond with 200 immediately to prevent Recall.ai from retrying or timing out
  res.status(200).json({ status: 'received' });

  // Process the webhook asynchronously to avoid blocking the HTTP response
  processWebhookEvent(sessionId, event, data, req.app.get('io')).catch((err) => {
    console.error(`[recallWebhook] Error processing event ${event} for session ${sessionId}:`, err);
  });
});

// Recall.ai real-time webhook payload structure:
// {
//   "event": "participant_events.join",
//   "data": {
//     "data": {                  <-- nested "data.data"
//       "participant": { "id": int, "name": string, "email": string, ... },
//       "timestamp": { "absolute": string, "relative": float }
//     },
//     "bot": { "id": string },
//     ...
//   }
// }
async function processWebhookEvent(
  sessionId: string,
  event: string,
  data: any,
  io: any
): Promise<void> {
  const session = await Session.findById(sessionId);
  if (!session) {
    console.warn(`[recallWebhook] Session ${sessionId} not found for event: ${event}`);
    return;
  }

  // The actual event data is nested under data.data
  const innerData = data?.data ?? data;

  console.log(`[recallWebhook] Processing event: ${event} | innerData keys: ${Object.keys(innerData || {}).join(', ')}`);

  switch (event) {
    case 'participant_events.join': {
      const pData = innerData?.participant;
      if (!pData) {
        console.warn(`[recallWebhook] participant_events.join: no participant in payload`);
        return;
      }

      // Ignore bots to avoid registering ourselves
      const name = pData.name ?? '';
      if (pData.is_host === undefined && (name.toLowerCase().includes('bot') || name.toLowerCase().includes('sherlock'))) {
        console.log(`[recallWebhook] Ignoring likely bot participant: ${name}`);
        return;
      }

      const participantId = String(pData.id);
      console.log(`[recallWebhook] Participant join: id=${participantId} name="${name}" email="${pData.email}"`);

      // Check if participant already exists in this session
      let participant = await Participant.findOne({ sessionId, participantId });
      if (!participant) {
        // Count existing participants for join index
        const existingCount = await Participant.countDocuments({ sessionId });

        participant = await Participant.create({
          sessionId,
          participantId,
          displayName: name,
          email: pData.email ?? '',
          joinedAt: innerData?.timestamp?.absolute ? new Date(innerData.timestamp.absolute) : new Date(),
          cameraOn: false,
          microphoneOn: false,
          screenSharing: false,
          totalSpeakingSeconds: 0,
        });

        // Compute and save initial signals
        await saveSignal(sessionId, participantId, 'name_match', nameMatchSignal(name, session.candidateName));
        if (pData.email) {
          await saveSignal(sessionId, participantId, 'email_match', emailMatchSignal(pData.email, session.candidateEmail));
        }
        await saveSignal(sessionId, participantId, 'join_order', joinOrderSignal(existingCount));

        console.log(`[recallWebhook] Created participant ${participantId} and computed initial signals.`);
      }

      io.to(`session:${sessionId}`).emit('participant_join', participant);
      break;
    }

    case 'participant_events.leave': {
      const pData = innerData?.participant;
      if (!pData) return;

      const participantId = String(pData.id);
      await Participant.findOneAndUpdate(
        { sessionId, participantId },
        { leftAt: new Date() }
      );

      // Stop speaking interval tracking if left
      speakingStartTimes.delete(`${sessionId}:${participantId}`);

      io.to(`session:${sessionId}`).emit('participant_leave', { participantId });
      console.log(`[recallWebhook] Participant ${participantId} left.`);
      break;
    }

    case 'participant_events.update': {
      // Participant updated their name/email
      const pData = innerData?.participant;
      if (!pData) return;

      const participantId = String(pData.id);
      const name = pData.name ?? '';
      const email = pData.email ?? '';

      await Participant.findOneAndUpdate(
        { sessionId, participantId },
        { displayName: name, email },
        { new: true }
      );

      // Re-run name/email signals with updated info
      if (name) {
        await saveSignal(sessionId, participantId, 'name_match', nameMatchSignal(name, session.candidateName));
      }
      if (email) {
        await saveSignal(sessionId, participantId, 'email_match', emailMatchSignal(email, session.candidateEmail));
      }

      console.log(`[recallWebhook] Participant ${participantId} updated: name="${name}" email="${email}"`);
      io.to(`session:${sessionId}`).emit('participant_update', { participantId, displayName: name, email });
      break;
    }

    case 'participant_events.speech_on': {
      const pData = innerData?.participant;
      const participantId = pData ? String(pData.id) : null;
      if (!participantId) return;

      const key = `${sessionId}:${participantId}`;
      speakingStartTimes.set(key, Date.now());

      await Participant.findOneAndUpdate({ sessionId, participantId }, { microphoneOn: true });
      console.log(`[recallWebhook] Participant ${participantId} speech_on`);
      break;
    }

    case 'participant_events.speech_off': {
      const pData = innerData?.participant;
      const participantId = pData ? String(pData.id) : null;
      if (!participantId) return;

      const key = `${sessionId}:${participantId}`;
      const startTime = speakingStartTimes.get(key);
      speakingStartTimes.delete(key);

      let durationSec = 0;
      if (startTime) {
        durationSec = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      }

      const participant = await Participant.findOneAndUpdate(
        { sessionId, participantId },
        { $inc: { totalSpeakingSeconds: durationSec }, microphoneOn: false },
        { new: true }
      );

      if (participant) {
        // Calculate voice activity ratio
        const startMs = session.startedAt ? session.startedAt.getTime() : session.createdAt.getTime();
        const totalSec = Math.max(1, (Date.now() - startMs) / 1000);
        const result = voiceActivitySignal({
          participantSpeakingSeconds: participant.totalSpeakingSeconds,
          totalMeetingSeconds: totalSec,
        });

        await saveSignal(sessionId, participantId, 'voice_activity', result);
        io.to(`session:${sessionId}`).emit('signal_generated', {
          participantId,
          type: 'voice_activity',
          ...result,
        });
      }
      console.log(`[recallWebhook] Participant ${participantId} speech_off (${durationSec}s)`);
      break;
    }

    case 'participant_events.webcam_on':
    case 'participant_events.webcam_off': {
      const pData = innerData?.participant;
      const participantId = pData ? String(pData.id) : null;
      if (!participantId) return;

      const isOn = event === 'participant_events.webcam_on';
      await Participant.findOneAndUpdate({ sessionId, participantId }, { cameraOn: isOn });

      const result = cameraPresenceSignal({ cameraOnRatio: isOn ? 1 : 0, currentlyOn: isOn });
      await saveSignal(sessionId, participantId, 'camera_presence', result);

      io.to(`session:${sessionId}`).emit('signal_generated', {
        participantId,
        type: 'camera_presence',
        ...result,
      });
      console.log(`[recallWebhook] Participant ${participantId} webcam ${isOn ? 'on' : 'off'}`);
      break;
    }

    case 'participant_events.screenshare_on':
    case 'participant_events.screenshare_off': {
      const pData = innerData?.participant;
      const participantId = pData ? String(pData.id) : null;
      if (!participantId) return;

      const isSharing = event === 'participant_events.screenshare_on';
      await Participant.findOneAndUpdate({ sessionId, participantId }, { screenSharing: isSharing });

      const result = screenShareSignal({
        currentlySharing: isSharing,
        totalSharingSeconds: isSharing ? 5 : 0,
        totalMeetingSeconds: 60,
      });
      await saveSignal(sessionId, participantId, 'screen_share', result);

      io.to(`session:${sessionId}`).emit('signal_generated', {
        participantId,
        type: 'screen_share',
        ...result,
      });
      break;
    }

    case 'transcript.data': {
      // Recall.ai transcript.data payload has:
      // data.data.participant + data.data.words (array of {text, start_timestamp, end_timestamp})
      const tData = innerData;
      if (!tData?.participant) return;

      const participantId = String(tData.participant.id);

      // Reconstruct full text from words array
      const text = Array.isArray(tData.words)
        ? tData.words.map((w: any) => w.text).join(' ')
        : (tData.text ?? '');

      if (!text) return;

      const participant = await Participant.findOne({ sessionId, participantId });
      if (participant) {
        const result = transcriptAnalysisSignal(text, session.candidateName);
        await saveSignal(sessionId, participantId, 'transcript_reference', result);

        io.to(`session:${sessionId}`).emit('signal_generated', {
          participantId,
          type: 'transcript_reference',
          ...result,
        });
        console.log(`[recallWebhook] Transcript for participant ${participantId}: "${text.slice(0, 80)}..."`);
      }
      break;
    }

    case 'transcript.partial_data':
      // Partial transcript - skip for now, wait for finalized transcript.data
      break;

    default:
      console.log(`[recallWebhook] Unhandled event: ${event}`);
  }
}

async function saveSignal(
  sessionId: string,
  participantId: string,
  type: SignalType,
  result: { score: number; reason: string }
) {
  const weight = SIGNAL_WEIGHTS[type] ?? 0;
  await ParticipantSignal.create({
    sessionId,
    participantId,
    type,
    value: result.score,
    weight,
    confidence: result.score * weight,
    reason: result.reason,
    timestamp: new Date(),
  }).catch((e) => console.error(`[recallWebhook] Error saving signal ${type}:`, e));
}

export default router;
