import { useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useSessionStore } from '../store/sessionStore';

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useSocket(sessionId: string | undefined) {
  const socketRef = useRef<any>(null);
  
  const addParticipant = useSessionStore((state) => state.addParticipant);
  const updateParticipant = useSessionStore((state) => state.updateParticipant);
  const removeParticipant = useSessionStore((state) => state.removeParticipant);
  const setPredictions = useSessionStore((state) => state.setPredictions);
  const addSignal = useSessionStore((state) => state.addSignal);
  const addMonitoringEvent = useSessionStore((state) => state.addMonitoringEvent);

  useEffect(() => {
    if (!sessionId) return;

    // Establish Socket.io connection
    const socket = io(SOCKET_SERVER_URL, {
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[socket] Connected to server, joining session:', sessionId);
      socket.emit('join_session', sessionId);
    });

    // ── participant joined ───────────────────────────────────────────────────
    socket.on('participant_join', (participant: any) => {
      console.log('[socket] participant_join:', participant);
      addParticipant({
        participantId: participant.participantId,
        displayName: participant.displayName,
        email: participant.email,
        joinedAt: participant.joinedAt || new Date().toISOString(),
        cameraOn: participant.cameraOn || false,
        microphoneOn: participant.microphoneOn || false,
        screenSharing: participant.screenSharing || false,
        totalSpeakingSeconds: participant.totalSpeakingSeconds || 0,
      });
    });

    // ── participant left ─────────────────────────────────────────────────────
    socket.on('participant_leave', (data: { participantId: string }) => {
      console.log('[socket] participant_leave:', data);
      updateParticipant(data.participantId, { leftAt: new Date().toISOString() });
    });

    // ── participant updated name/email (Recall.ai fires this after calendar match) ──
    socket.on('participant_update', (data: { participantId: string; displayName: string; email: string }) => {
      console.log('[socket] participant_update:', data);
      updateParticipant(data.participantId, { displayName: data.displayName, email: data.email });
    });

    // ── signal generated ─────────────────────────────────────────────────────
    socket.on('signal_generated', (data: any) => {
      console.log('[socket] signal_generated:', data);
      addSignal({
        participantId: data.participantId,
        type: data.type || 'unknown',
        score: data.score !== undefined ? data.score : data.value || 0,
        reason: data.reason || '',
        timestamp: new Date().toISOString(),
      });
      
      // Update camera/mic/screen states if embedded in signal
      if (data.type === 'camera_presence') {
        updateParticipant(data.participantId, { cameraOn: data.score > 0 });
      }
      if (data.type === 'screen_share') {
        updateParticipant(data.participantId, { screenSharing: data.score > 0 });
      }
      if (data.type === 'voice_activity') {
        updateParticipant(data.participantId, { microphoneOn: data.score > 0 });
      }
    });

    // ── monitoring event from candidate client ───────────────────────────────
    socket.on('monitoring_event', (data: any) => {
      console.log('[socket] monitoring_event:', data);
      addMonitoringEvent({
        type: data.type || 'unknown',
        deviceId: data.deviceId,
        detail: data.detail || '',
        timestamp: data.timestamp || new Date().toISOString(),
        metadata: data.metadata,
      });
    });

    // ── candidate prediction tick ────────────────────────────────────────────
    socket.on('candidate_prediction', (data: { predictions: any[]; explanation: string; ambiguous: boolean }) => {
      console.log('[socket] candidate_prediction:', data);
      setPredictions(data.predictions, data.explanation, data.ambiguous);
    });

    // ── confidence update nudge ──────────────────────────────────────────────
    socket.on('confidence_update', (data: { participantId: string; confidenceScore: number }) => {
      console.log('[socket] confidence_update:', data);
      // Handled as part of candidate_prediction usually, but can be logged or used for fast nudges
    });

    socket.on('disconnect', () => {
      console.log('[socket] Disconnected');
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId, addParticipant, updateParticipant, removeParticipant, setPredictions, addSignal, addMonitoringEvent]);

  const emit = (event: string, data: any) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  };

  return { socket: socketRef.current, emit };
}
