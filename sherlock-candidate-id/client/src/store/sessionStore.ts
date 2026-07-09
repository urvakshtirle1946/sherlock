import { create } from 'zustand';

export interface Session {
  _id: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhotoUrl: string;
  meetingPlatform: string;
  meetingUrl: string;
  status: 'pending' | 'active' | 'ended';
  startedAt?: string;
  endedAt?: string;
  ingestionMode?: 'demo' | 'live';
  recallBotId?: string;
  interviewDurationMinutes?: number;
}

export interface Participant {
  participantId: string;
  displayName: string;
  email?: string;
  joinedAt: string;
  leftAt?: string;
  cameraOn: boolean;
  microphoneOn: boolean;
  screenSharing: boolean;
  totalSpeakingSeconds: number;
}

export interface EvidenceEntry {
  rawScore: number;
  weight: number;
  contribution: number;
  reason: string;
}

export interface Prediction {
  participantId: string;
  displayName: string;
  confidenceScore: number;
  evidenceBreakdown: Record<string, EvidenceEntry>;
  rank: number;
  ambiguous: boolean;
}

export interface Signal {
  participantId: string;
  type: string;
  score: number;
  reason: string;
  timestamp: string;
}

export interface MonitoringEvent {
  type: string;
  deviceId?: string;
  detail: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface HistoryDataPoint {
  time: string; // HH:MM:SS
  [participantName: string]: number | string; // participant displayName -> confidenceScore
}

interface SessionState {
  session: Session | null;
  participants: Participant[];
  predictions: Prediction[];
  explanation: string;
  ambiguous: boolean;
  signals: Signal[];
  monitoringEvents: MonitoringEvent[];
  history: HistoryDataPoint[];
  
  setSession: (session: Session) => void;
  setParticipants: (participants: Participant[]) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (participantId: string) => void;
  updateParticipant: (participantId: string, updates: Partial<Participant>) => void;
  setPredictions: (predictions: Prediction[], explanation: string, ambiguous: boolean) => void;
  addSignal: (signal: Signal) => void;
  addMonitoringEvent: (event: MonitoringEvent) => void;
  setMonitoringEvents: (events: MonitoringEvent[]) => void;
  clearStore: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  participants: [],
  predictions: [],
  explanation: 'Waiting for signals...',
  ambiguous: false,
  signals: [],
  monitoringEvents: [],
  history: [],

  setSession: (session) => set({ session }),
  setParticipants: (participants) => set({ participants }),
  addParticipant: (participant) =>
    set((state) => {
      // Avoid duplicates
      if (state.participants.some((p) => p.participantId === participant.participantId)) {
        return state;
      }
      return { participants: [...state.participants, participant] };
    }),
  removeParticipant: (participantId) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.participantId !== participantId),
    })),
  updateParticipant: (participantId, updates) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.participantId === participantId ? { ...p, ...updates } : p
      ),
    })),
  setPredictions: (predictions, explanation, ambiguous) =>
    set((state) => {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      // Update history graph data
      const newPoint: HistoryDataPoint = { time: timeStr };
      predictions.forEach((p) => {
        newPoint[p.displayName] = Math.round(p.confidenceScore * 100);
      });

      // Keep last 30 data points for readability
      const updatedHistory = [...state.history, newPoint].slice(-30);

      return {
        predictions,
        explanation,
        ambiguous,
        history: updatedHistory,
      };
    }),
  addSignal: (signal) =>
    set((state) => ({
      signals: [signal, ...state.signals].slice(0, 100),
    })),
  addMonitoringEvent: (event) =>
    set((state) => ({
      monitoringEvents: [event, ...state.monitoringEvents].slice(0, 100),
    })),
  setMonitoringEvents: (events) =>
    set({ monitoringEvents: events }),
  clearStore: () =>
    set({
      session: null,
      participants: [],
      predictions: [],
      explanation: 'Waiting for signals...',
      ambiguous: false,
      signals: [],
      monitoringEvents: [],
      history: [],
    }),
}));

