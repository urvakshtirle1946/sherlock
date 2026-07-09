'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSessionStore } from '../../../../store/sessionStore';
import { useSocket } from '../../../../hooks/useSocket';
import { SimulatorPanel } from '../../../../components/SimulatorPanel';
import { Cpu, ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';

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
      <div className="min-h-screen flex items-center justify-center bg-black text-white font-mono">
        <div className="flex flex-col items-center space-y-3">
          <RefreshCw className="w-6 h-6 text-white animate-spin" />
          <p className="text-xs uppercase tracking-wider text-zinc-500">Loading Simulator...</p>
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
    <main className="min-h-screen p-6 bg-black flex flex-col h-screen font-mono">
      
      {/* HEADER */}
      <header className="flex items-center justify-between pb-6 mb-6 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-[2px] bg-zinc-950 border border-zinc-800 flex items-center justify-center text-white">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white uppercase tracking-wider">Standalone Simulator</h1>
            <p className="text-[9px] text-zinc-400 uppercase mt-0.5">
              Generating events for: <strong className="text-white">{session.candidateName}</strong>
            </p>
          </div>
        </div>

        <Button
          onClick={() => router.push(`/session/${sessionId}`)}
          variant="outline"
          size="sm"
          className="h-8 text-[9px] font-bold uppercase rounded-[2px] border-zinc-800 bg-black text-white hover:bg-zinc-900 cursor-pointer"
        >
          <ArrowLeft className="w-3 h-3 mr-1.5" />
          <span>Back to Dashboard</span>
        </Button>
      </header>

      {/* Standalone Simulator Panel */}
      <div className="flex-grow overflow-hidden">
        <SimulatorPanel sessionId={sessionId} emit={emit} />
      </div>

    </main>
  );
}
