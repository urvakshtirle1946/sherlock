'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSessionStore } from '../../../../store/sessionStore';
import { useSocket } from '../../../../hooks/useSocket';
import { SimulatorPanel } from '../../../../components/SimulatorPanel';
import { Cpu, ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function StandaloneSimulator() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id as string;

  const session = useSessionStore((state) => state.session);
  const setSession = useSessionStore((state) => state.setSession);
  const setParticipants = useSessionStore((state) => state.setParticipants);
  const [loading, setLoading] = useState(true);

  // Hook up WebSocket
  const { emit } = useSocket(sessionId);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const [sessionRes, participantsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/sessions/${sessionId}`),
          fetch(`${API_BASE_URL}/api/sessions/${sessionId}/participants`),
        ]);

        if (!sessionRes.ok || !participantsRes.ok) {
          throw new Error('Failed to load session details');
        }

        setSession(await sessionRes.json());
        setParticipants(await participantsRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      loadSession();
    }
  }, [sessionId, setSession, setParticipants]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center space-y-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-gray-400">Loading Simulator...</p>
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

  return (
    <main className="min-h-screen p-6 cyber-grid flex flex-col h-screen">
      
      {/* HEADER */}
      <header className="flex items-center justify-between pb-6 mb-6 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Standalone Participant Simulator</h1>
            <p className="text-xs text-gray-400">
              Generating events for: <strong className="text-gray-300">{session.candidateName}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={() => router.push(`/session/${sessionId}`)}
          className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-gray-200 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </button>
      </header>

      {/* Standalone Simulator Panel */}
      <div className="flex-grow overflow-hidden">
        <SimulatorPanel sessionId={sessionId} emit={emit} />
      </div>

    </main>
  );
}
