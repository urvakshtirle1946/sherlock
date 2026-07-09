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
import { ShieldAlert, Cpu, Play, Square, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';

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
  }, [sessionId]);

  const handleStartIngestion = async () => {
    if (!session?.meetingUrl) return alert('No meeting URL configured for this session.');
    
    try {
      await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      
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
      <div className="min-h-screen flex items-center justify-center bg-black text-white font-mono">
        <div className="flex flex-col items-center space-y-3">
          <RefreshCw className="w-6 h-6 text-white animate-spin" />
          <p className="text-xs uppercase tracking-wider text-zinc-500">Loading Sherlock session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-6 font-mono">
        <Card className="bg-black border-zinc-800 rounded-[3px] p-6 max-w-sm text-center shadow-none">
          <ShieldAlert className="w-6 h-6 text-white mx-auto mb-3" />
          <h3 className="font-bold text-white mb-1 uppercase text-xs">Session Not Found</h3>
          <p className="text-[10px] text-zinc-500 mb-4 uppercase">The requested session does not exist or has expired.</p>
          <Button
            onClick={() => router.push('/')}
            size="sm"
            className="text-[9px] font-bold uppercase rounded-[2px] cursor-pointer"
          >
            Go Back Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-6 bg-black flex flex-col font-mono">
      
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-6 border-b border-zinc-800 gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-[2px] bg-zinc-950 border border-zinc-800 flex items-center justify-center text-white">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white uppercase tracking-wider">
              Verification Session Dashboard
            </h1>
            <p className="text-[9px] text-zinc-400 uppercase mt-0.5">
              Candidate: <strong className="text-white">{session.candidateName}</strong> ({session.candidateEmail})
            </p>
          </div>
        </div>

        {/* CONTROLS AREA */}
        <div className="flex items-center space-x-3">
          {session.ingestionMode !== 'live' && (
            <Button
              onClick={() => setShowSimulator(!showSimulator)}
              variant="outline"
              size="sm"
              className={`h-8 text-[9px] font-bold uppercase rounded-[2px] border-zinc-800 cursor-pointer ${
                showSimulator ? 'bg-white text-black hover:bg-zinc-200' : 'bg-black text-white hover:bg-zinc-900'
              }`}
            >
              {showSimulator ? 'Close Simulator' : 'Open Simulator'}
            </Button>
          )}

          {session.ingestionMode === 'live' ? (
            session.status === 'active' ? (
              <Button
                onClick={handleStopIngestion}
                variant="outline"
                size="sm"
                className="h-8 text-[9px] font-bold uppercase rounded-[2px] border-zinc-800 bg-black text-white hover:bg-zinc-900 cursor-pointer"
              >
                <Square className="w-3 h-3 mr-1.5" />
                <span>Stop Recall Bot</span>
              </Button>
            ) : (
              <div className="bg-zinc-950 border border-zinc-900 text-zinc-500 text-[9px] font-bold uppercase py-2 px-3 rounded-[2px] select-none">
                Recall Bot Concluded
              </div>
            )
          ) : session.status !== 'active' ? (
            <Button
              onClick={handleStartIngestion}
              disabled={session.status === 'ended'}
              size="sm"
              className="h-8 text-[9px] font-bold uppercase rounded-[2px] cursor-pointer"
            >
              <Play className="w-3 h-3 mr-1.5" />
              <span>Start Ingestion</span>
            </Button>
          ) : (
            <Button
              onClick={handleStopIngestion}
              variant="outline"
              size="sm"
              className="h-8 text-[9px] font-bold uppercase rounded-[2px] border-zinc-800 bg-black text-white hover:bg-zinc-900 cursor-pointer"
            >
              <Square className="w-3 h-3 mr-1.5" />
              <span>Stop Ingestion</span>
            </Button>
          )}

          {session.meetingUrl && (
            <a
              href={session.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center h-8 w-8 rounded-[2px] bg-black border border-zinc-800 text-zinc-500 hover:text-white transition-colors"
              title="Open Meeting Link"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </header>

      {/* DEMO MODE BANNER */}
      {session.ingestionMode !== 'live' && (
        <div className="mb-6 p-3 bg-zinc-950 border border-zinc-800 rounded-[2px] flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-zinc-400 gap-2 shadow-none font-mono">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-[1px] bg-white flex-shrink-0 animate-pulse" />
            <span><strong>WORKING IN DEMO MODE:</strong> YOU ARE SIMULATING BEHAVIOR. USE THE SIMULATOR PANEL TO INJECT FAKE SIGNALS.</span>
          </div>
          <Button
            onClick={() => setShowSimulator(true)}
            variant="outline"
            size="sm"
            className="h-6 text-[8px] px-2 uppercase font-bold border-zinc-800 rounded-[2px] cursor-pointer"
          >
            Open Simulator Panel
          </Button>
        </div>
      )}

      {/* RECALL BOT BANNER */}
      {session.ingestionMode === 'live' && session.status === 'active' && (
        <div className="mb-6 p-3 bg-zinc-950 border border-zinc-800 rounded-[2px] flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-zinc-400 gap-2 shadow-none font-mono">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-[1px] bg-white flex-shrink-0 animate-pulse" />
            <span><strong>RECALL.AI LIVE INGESTION ACTIVE:</strong> BOT IS MONITORING THE MEETING ROOM.</span>
          </div>
          {session.recallBotId && (
            <span className="text-[8px] text-zinc-600 font-mono">BOT ID: {session.recallBotId}</span>
          )}
        </div>
      )}

      {/* TOP SUMMARY CARDS */}
      <SummaryCards />

      {/* NEXT STEPS / OPERATIONAL GUIDE CHECKLIST */}
      <Card className="mb-6 bg-zinc-950/60 border border-zinc-800 rounded-[2px] p-4 shadow-none font-mono text-[10px] space-y-3">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">
          Verification Checklist & Guide
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-zinc-400">
          <div className="border border-zinc-900 bg-black p-3 rounded-[2px] space-y-1">
            <span className="text-white font-bold block">01. SHARE MONITOR LINK</span>
            <p className="text-[9px] text-zinc-500 leading-normal uppercase">
              Copy the candidate monitor URL from the proctoring panel below and send it to the candidate.
            </p>
          </div>
          <div className="border border-zinc-900 bg-black p-3 rounded-[2px] space-y-1">
            <span className="text-white font-bold block">02. CANDIDATE CONNECTS</span>
            <p className="text-[9px] text-zinc-500 leading-normal uppercase">
              The candidate opens the link, authorizes camera permissions, and starts proctoring reporting.
            </p>
          </div>
          <div className="border border-zinc-900 bg-black p-3 rounded-[2px] space-y-1">
            <span className="text-white font-bold block">03. START INGESTION</span>
            <p className="text-[9px] text-zinc-500 leading-normal uppercase">
              {session.ingestionMode === 'live'
                ? "Click 'Start Ingestion' above to invite the Recall.ai Bot into the meeting room."
                : "Open the 'Simulator' above to create participants and inject simulated voice/face metrics."}
            </p>
          </div>
          <div className="border border-zinc-900 bg-black p-3 rounded-[2px] space-y-1">
            <span className="text-white font-bold block">04. MONITOR SIGNALS</span>
            <p className="text-[9px] text-zinc-500 leading-normal uppercase">
              Review live confidence match scores, evidence explainability logs, and proctoring blur events.
            </p>
          </div>
        </div>
      </Card>

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

          {/* Candidate Monitor panel */}
          <MonitoringPanel events={monitoringEvents} sessionId={sessionId} />
          
          {/* SIMULATOR SHORTCUT INFO BOX */}
          {!showSimulator && session.ingestionMode !== 'live' && (
            <Card className="p-4 bg-zinc-950/40 text-[9px] text-zinc-500 border border-zinc-900 rounded-[2px] shadow-none uppercase space-y-1">
              <strong className="text-zinc-300 block mb-0.5 font-bold">Developer Mode</strong>
              You can simulate meeting participants and inject audio or camera signals in real-time by opening the <strong>Simulator Panel</strong> in the top menu bar.
            </Card>
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
      <section className="mt-8 border-t border-zinc-900 pt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4 font-mono">
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
            <div className="col-span-3 border border-dashed border-zinc-800 p-8 text-center text-zinc-600 text-xs rounded-[2px] uppercase font-mono">
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
