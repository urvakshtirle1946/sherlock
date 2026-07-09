'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSessionStore } from '../../../store/sessionStore';
import { useSocket } from '../../../hooks/useSocket';
import { SummaryCards } from '../../../components/SummaryCards';
import { ParticipantCard } from '../../../components/ParticipantCard';
import { RankingList } from '../../../components/RankingList';
import { ConfidenceGraph } from '../../../components/ConfidenceGraph';
import { ExplainabilityPanel } from '../../../components/ExplainabilityPanel';
import { SimulatorPanel } from '../../../components/SimulatorPanel';
import { MonitoringPanel } from '../../../components/MonitoringPanel';
import { Eye, ShieldAlert, Cpu, Play, Square, Link as LinkIcon, RefreshCw } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function SessionDashboard() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id as string;

  const session = useSessionStore((state) => state.session);
  const participants = useSessionStore((state) => state.participants);
  const predictions = useSessionStore((state) => state.predictions);
  
  const setSession = useSessionStore((state) => state.setSession);
  const setParticipants = useSessionStore((state) => state.setParticipants);
  const setMonitoringEvents = useSessionStore((state) => state.setMonitoringEvents);
  const monitoringEvents = useSessionStore((state) => state.monitoringEvents);
  const clearStore = useSessionStore((state) => state.clearStore);

  const [loading, setLoading] = useState(true);
  const [ingestionRunning, setIngestionRunning] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);

  // Hook up WebSocket
  const { emit } = useSocket(sessionId);

  // Load initial data
  const loadData = async () => {
    try {
      const [sessionRes, participantsRes, monitoringRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/sessions/${sessionId}`),
        fetch(`${API_BASE_URL}/api/sessions/${sessionId}/participants`),
        fetch(`${API_BASE_URL}/api/sessions/${sessionId}/monitoring`),
      ]);

      if (!sessionRes.ok || !participantsRes.ok) {
        throw new Error('Failed to load session details');
      }

      const sessionData = await sessionRes.json();
      const participantsData = await participantsRes.json();
      const monitoringData = monitoringRes.ok ? await monitoringRes.json() : [];

      setSession(sessionData);
      setParticipants(participantsData);
      // Events come back newest-first from DB — reverse for chronological display
      setMonitoringEvents(
        monitoringData.map((e: any) => ({
          type: e.type,
          deviceId: e.deviceId,
          detail: e.detail || '',
          timestamp: e.timestamp,
          metadata: e.metadata,
        })).reverse()
      );
    } catch (err) {
      console.error('[Dashboard] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      loadData();
    }
    return () => {
      // Don't wipe the store during sub-page swaps to keep graphs intact,
      // but wipe when navigating back to home.
    };
  }, [sessionId]);

  const handleStartIngestion = async () => {
    if (!session?.meetingUrl) return alert('No meeting URL configured for this session.');
    
    try {
      // Set session status to active on backend
      await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      
      // Update local state
      setSession({ ...session, status: 'active', startedAt: new Date().toISOString() });
      setIngestionRunning(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStopIngestion = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ended' }),
      });
      setSession({ ...session!, status: 'ended', endedAt: new Date().toISOString() });
      setIngestionRunning(false);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center space-y-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-gray-400">Loading Sherlock session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
        <div className="glass-panel p-6 max-w-sm text-center border-rose-500/20">
          <ShieldAlert className="w-8 h-8 text-rose-500 mx-auto mb-3" />
          <h3 className="font-semibold text-white mb-1">Session Not Found</h3>
          <p className="text-xs text-gray-400 mb-4">The requested session does not exist or has expired.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-4 py-2 rounded-lg cursor-pointer"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  const activeParticipants = participants.filter((p) => !p.leftAt);

  return (
    <main className="min-h-screen p-6 cyber-grid flex flex-col">
      
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-6 border-b border-white/5 gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 pulse-glow">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center space-x-2">
              <span>Candidate Identifier Session</span>
            </h1>
            <p className="text-xs text-gray-400">
              Candidate: <strong className="text-gray-300">{session.candidateName}</strong> ({session.candidateEmail})
            </p>
          </div>
        </div>

        {/* CONTROLS AREA */}
        <div className="flex items-center space-x-3">
          {session.ingestionMode !== 'live' && (
            <button
              onClick={() => setShowSimulator(!showSimulator)}
              className={`text-xs px-3.5 py-2 rounded-lg font-medium cursor-pointer transition-colors border ${
                showSimulator 
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' 
                  : 'bg-slate-800 hover:bg-slate-700 border-white/5 text-gray-200'
              }`}
            >
              {showSimulator ? 'Close Simulator' : 'Open Simulator Panel'}
            </button>
          )}

          {session.ingestionMode === 'live' ? (
            session.status === 'active' ? (
              <button
                onClick={handleStopIngestion}
                className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold py-2 px-3.5 rounded-lg cursor-pointer transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Recall Bot</span>
              </button>
            ) : (
              <div className="bg-slate-905 border border-white/5 text-gray-500 text-xs py-2 px-3.5 rounded-lg font-semibold select-none">
                Recall Bot Concluded
              </div>
            )
          ) : session.status !== 'active' ? (
            <button
              onClick={handleStartIngestion}
              disabled={session.status === 'ended'}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold py-2 px-3.5 rounded-lg cursor-pointer transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Ingestion</span>
            </button>
          ) : (
            <button
              onClick={handleStopIngestion}
              className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold py-2 px-3.5 rounded-lg cursor-pointer transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop Ingestion</span>
            </button>
          )}

          {session.meetingUrl && (
            <a
              href={session.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/5 text-gray-400 hover:text-white transition-colors"
              title="Open Meeting Link"
            >
              <LinkIcon className="w-4 h-4" />
            </a>
          )}
        </div>
      </header>

      {/* RECALL BOT BANNER */}
      {session.ingestionMode === 'live' && session.status === 'active' && (
        <div className="mb-6 p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between text-xs text-cyan-400 shadow-lg shadow-cyan-950/10 gap-2">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse flex-shrink-0" />
            <span><strong>Recall.ai Live Ingestion Active:</strong> Bot is joining and monitoring the meeting room.</span>
          </div>
          {session.recallBotId && (
            <span className="text-[10px] text-gray-500 font-mono self-end sm:self-center">Bot ID: {session.recallBotId}</span>
          )}
        </div>
      )}

      {/* TOP SUMMARY CARDS */}
      <SummaryCards />

      {/* GRID CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow">
        
        {/* LEFT COLUMN: GRAPH & EXPLANATION PANEL */}
        <div className={`space-y-6 ${showSimulator ? 'lg:col-span-4' : 'lg:col-span-8'}`}>
          <ConfidenceGraph />
          <ExplainabilityPanel />
        </div>

        {/* MIDDLE COLUMN: LIVE RANKINGS + MONITORING */}
        <div className={`space-y-6 ${showSimulator ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
          <RankingList predictions={predictions} />

          {/* Candidate Monitor panel — shows fingerprint, tab blur, face & posture events */}
          <MonitoringPanel events={monitoringEvents} sessionId={sessionId} />
          
          {/* SIMULATOR SHORTCUT INFO BOX */}
          {!showSimulator && session.ingestionMode !== 'live' && (
            <div className="glass-panel p-4 bg-slate-900/40 text-xs text-gray-400 border-white/5">
              <strong className="text-gray-300 block mb-1">Developer Mode</strong>
              You can simulate meeting participants and inject audio or camera signals in real-time by opening the <strong>Simulator Panel</strong> in the top menu bar.
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SIMULATOR PANEL (Conditional) */}
        {showSimulator && (
          <div className="lg:col-span-5 h-full">
            <SimulatorPanel sessionId={sessionId} emit={emit} />
          </div>
        )}
      </div>

      {/* PARTICIPANTS SECTION */}
      <section className="mt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
          Participants Stream
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {participants.map((p) => {
            const pred = predictions.find((pr) => pr.participantId === p.participantId);
            return (
              <ParticipantCard
                key={p.participantId}
                participant={p}
                prediction={pred}
              />
            );
          })}
          {participants.length === 0 && (
            <div className="col-span-3 glass-panel p-8 text-center text-gray-500 text-sm">
              {session.ingestionMode === 'live'
                ? 'Recall.ai bot is connecting. Once participants join, they will appear here in real-time.'
                : 'No participants connected. Start the ingestion bot or add fake participants in the Simulator.'
              }
            </div>
          )}
        </div>
      </section>

    </main>
  );
}
