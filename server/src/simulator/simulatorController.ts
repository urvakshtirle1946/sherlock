// simulator/simulatorController.ts
// Socket.io event handlers for the participant simulator.
//
// The simulator emits the SAME signal-pipeline events as the real ingestion
// path. The Confidence Engine never knows which source the events came from.
//
// Events the frontend can emit:
//   sim:add_participant    — add a fake participant to the session
//   sim:remove_participant — mark a participant as left
//   sim:set_speaking       — toggle speaking on/off (updates speaking seconds)
//   sim:set_camera         — toggle camera on/off
//   sim:set_screenshare    — toggle screen share
//   sim:inject_transcript  — push a transcript line into signal pipeline
//   sim:inject_signal      — manually set any signal type/value for a participant

import { Server as SocketServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import Participant from '../models/Participant';
import Session from '../models/Session';
import ParticipantSignal, { SignalType } from '../models/ParticipantSignal';
import { SIGNAL_WEIGHTS } from '../engines/confidenceEngine';
import { nameMatchSignal } from '../signals/nameMatch';
import { emailMatchSignal } from '../signals/emailMatch';
import { voiceActivitySignal } from '../signals/voiceActivity';
import { transcriptAnalysisSignal } from '../signals/transcriptAnalysis';
import { joinOrderSignal } from '../signals/joinOrder';
import { cameraPresenceSignal } from '../signals/cameraPresence';
import { screenShareSignal } from '../signals/screenShare';

// Track speaking-tick intervals per participant (in-memory, lost on restart — fine for sim)
const speakingIntervals = new Map<string, NodeJS.Timeout>();
// Track cumulative speaking seconds per participant
const speakingSeconds = new Map<string, number>();
// Track session start time for ratio calculations
const sessionStartTimes = new Map<string, number>();

export function registerSimulatorHandlers(io: SocketServer): void {
  io.on('connection', (socket: Socket) => {
    // ── Add participant ───────────────────────────────────────────────────────
    socket.on(
      'sim:add_participant',
      async (data: { sessionId: string; displayName: string; email?: string }) => {
        try {
          const session = await Session.findById(data.sessionId);
          if (!session) return;

          // Count existing participants for join-order signal
          const existingCount = await Participant.countDocuments({ sessionId: data.sessionId });

          const participantId = uuidv4();
          const participant = await Participant.create({
            sessionId: data.sessionId,
            participantId,
            displayName: data.displayName,
            email: data.email,
            joinedAt: new Date(),
            cameraOn: false,
            microphoneOn: false,
            screenSharing: false,
            totalSpeakingSeconds: 0,
          });

          // Ensure session is active
          if (session.status === 'pending') {
            await Session.findByIdAndUpdate(data.sessionId, {
              status: 'active',
              startedAt: new Date(),
            });
            sessionStartTimes.set(data.sessionId, Date.now());
          }

          // Compute and persist static signals immediately on join
          await persistInitialSignals(data.sessionId, participant.participantId, {
            displayName: data.displayName,
            email: data.email,
            joinIndex: existingCount,
            candidateName: session.candidateName,
            candidateEmail: session.candidateEmail,
          });

          io.to(`session:${data.sessionId}`).emit('participant_join', participant);
          console.log(`[simulator] participant joined: ${data.displayName}`);
        } catch (err) {
          console.error('[simulator] add_participant error:', err);
        }
      }
    );

    // ── Remove participant ────────────────────────────────────────────────────
    socket.on('sim:remove_participant', async (data: { sessionId: string; participantId: string }) => {
      await Participant.findOneAndUpdate(
        { sessionId: data.sessionId, participantId: data.participantId },
        { leftAt: new Date() }
      );
      // Stop speaking interval if running
      stopSpeakingInterval(data.participantId);
      io.to(`session:${data.sessionId}`).emit('participant_leave', data);
    });

    // ── Toggle speaking ───────────────────────────────────────────────────────
    socket.on(
      'sim:set_speaking',
      async (data: { sessionId: string; participantId: string; speaking: boolean }) => {
        const key = `${data.sessionId}:${data.participantId}`;

        if (data.speaking) {
          // Increment speaking seconds every second
          speakingIntervals.set(
            key,
            setInterval(async () => {
              const prev = speakingSeconds.get(key) ?? 0;
              const next = prev + 1;
              speakingSeconds.set(key, next);

              await Participant.findOneAndUpdate(
                { sessionId: data.sessionId, participantId: data.participantId },
                { $inc: { totalSpeakingSeconds: 1 }, microphoneOn: true }
              );

              // Push voice_activity signal
              const sessionStart = sessionStartTimes.get(data.sessionId) ?? Date.now();
              const totalMeetingSeconds = (Date.now() - sessionStart) / 1000;
              const result = voiceActivitySignal({
                participantSpeakingSeconds: next,
                totalMeetingSeconds,
              });
              await saveSignal(data.sessionId, data.participantId, 'voice_activity', result);
              io.to(`session:${data.sessionId}`).emit('signal_generated', {
                participantId: data.participantId,
                type: 'voice_activity',
                ...result,
              });
            }, 1000)
          );
        } else {
          stopSpeakingInterval(key);
          await Participant.findOneAndUpdate(
            { sessionId: data.sessionId, participantId: data.participantId },
            { microphoneOn: false }
          );
        }
      }
    );

    // ── Toggle camera ─────────────────────────────────────────────────────────
    socket.on(
      'sim:set_camera',
      async (data: { sessionId: string; participantId: string; on: boolean }) => {
        await Participant.findOneAndUpdate(
          { sessionId: data.sessionId, participantId: data.participantId },
          { cameraOn: data.on }
        );

        const result = cameraPresenceSignal({ cameraOnRatio: data.on ? 1 : 0, currentlyOn: data.on });
        await saveSignal(data.sessionId, data.participantId, 'camera_presence', result);

        io.to(`session:${data.sessionId}`).emit('signal_generated', {
          participantId: data.participantId,
          type: 'camera_presence',
          ...result,
        });
      }
    );

    // ── Toggle screen share ───────────────────────────────────────────────────
    socket.on(
      'sim:set_screenshare',
      async (data: { sessionId: string; participantId: string; sharing: boolean }) => {
        await Participant.findOneAndUpdate(
          { sessionId: data.sessionId, participantId: data.participantId },
          { screenSharing: data.sharing }
        );

        const result = screenShareSignal({
          currentlySharing: data.sharing,
          totalSharingSeconds: 0,
          totalMeetingSeconds: 60,
        });
        await saveSignal(data.sessionId, data.participantId, 'screen_share', result);

        io.to(`session:${data.sessionId}`).emit('signal_generated', {
          participantId: data.participantId,
          type: 'screen_share',
          ...result,
        });
      }
    );

    // ── Inject transcript ─────────────────────────────────────────────────────
    socket.on(
      'sim:inject_transcript',
      async (data: { sessionId: string; participantId: string; text: string }) => {
        const session = await Session.findById(data.sessionId);
        if (!session) return;

        const result = transcriptAnalysisSignal(data.text, session.candidateName);
        await saveSignal(data.sessionId, data.participantId, 'transcript_reference', result);

        io.to(`session:${data.sessionId}`).emit('signal_generated', {
          participantId: data.participantId,
          type: 'transcript_reference',
          ...result,
        });
      }
    );

    // ── Inject arbitrary signal ───────────────────────────────────────────────
    socket.on(
      'sim:inject_signal',
      async (data: { sessionId: string; participantId: string; type: SignalType; value: number; reason: string }) => {
        const weight = SIGNAL_WEIGHTS[data.type] ?? 0;
        await ParticipantSignal.create({
          sessionId: data.sessionId,
          participantId: data.participantId,
          type: data.type,
          value: data.value,
          weight,
          confidence: data.value * weight,
          reason: data.reason,
          timestamp: new Date(),
        });

        io.to(`session:${data.sessionId}`).emit('signal_generated', {
          participantId: data.participantId,
          type: data.type,
          score: data.value,
          reason: data.reason,
        });
      }
    );
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface InitialSignalData {
  displayName: string;
  email?: string;
  joinIndex: number;
  candidateName: string;
  candidateEmail: string;
}

async function persistInitialSignals(
  sessionId: string,
  participantId: string,
  data: InitialSignalData
) {
  const { displayName, email, joinIndex, candidateName, candidateEmail } = data;

  const nameResult = nameMatchSignal(displayName, candidateName);
  await saveSignal(sessionId, participantId, 'name_match', nameResult);

  if (email) {
    const emailResult = emailMatchSignal(email, candidateEmail);
    await saveSignal(sessionId, participantId, 'email_match', emailResult);
  }

  const joinResult = joinOrderSignal(joinIndex);
  await saveSignal(sessionId, participantId, 'join_order', joinResult);
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
  });
}

function stopSpeakingInterval(key: string) {
  const interval = speakingIntervals.get(key);
  if (interval) {
    clearInterval(interval);
    speakingIntervals.delete(key);
  }
}
