import React, { useState, useEffect } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { Card } from './ui/card';
import { Shield, Users, Clock, Cpu } from 'lucide-react';

export function SummaryCards() {
  const session = useSessionStore((state) => state.session);
  const predictions = useSessionStore((state) => state.predictions);
  const participants = useSessionStore((state) => state.participants);
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    if (!session || session.status !== 'active') return;
    
    const start = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    
    const timer = setInterval(() => {
      const diffSecs = Math.floor((Date.now() - start) / 1000);
      const m = String(Math.floor(diffSecs / 60)).padStart(2, '0');
      const s = String(diffSecs % 60).padStart(2, '0');
      setElapsed(`${m}:${s}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [session]);

  const activeParticipants = participants.filter((p) => !p.leftAt);
  const topCandidate = predictions.length > 0 ? predictions[0] : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* CARD 1: Leading Candidate */}
      <Card className="bg-black border-zinc-800 rounded-[3px] shadow-none p-4 flex items-center space-x-3.5">
        <div className="p-2 border border-zinc-800 bg-zinc-950 text-white rounded-[2px]">
          <Shield className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Top Candidate</p>
          <h3 className="text-sm font-bold text-white truncate uppercase font-mono">
            {topCandidate ? topCandidate.displayName : 'DETECTING...'}
          </h3>
        </div>
      </Card>

      {/* CARD 2: Confidence */}
      <Card className="bg-black border-zinc-800 rounded-[3px] shadow-none p-4 flex items-center space-x-3.5">
        <div className="p-2 border border-zinc-800 bg-zinc-950 text-white rounded-[2px]">
          <Cpu className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Confidence Score</p>
          <h3 className="text-sm font-bold text-white font-mono">
            {topCandidate ? `${Math.round(topCandidate.confidenceScore * 100)}%` : '0%'}
          </h3>
        </div>
      </Card>

      {/* CARD 3: Participant Count */}
      <Card className="bg-black border-zinc-800 rounded-[3px] shadow-none p-4 flex items-center space-x-3.5">
        <div className="p-2 border border-zinc-800 bg-zinc-950 text-white rounded-[2px]">
          <Users className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Active Speakers</p>
          <h3 className="text-sm font-bold text-white font-mono">
            {activeParticipants.length} <span className="text-[10px] text-zinc-500 font-normal">({participants.length} JOINED)</span>
          </h3>
        </div>
      </Card>

      {/* CARD 4: Clock */}
      <Card className="bg-black border-zinc-800 rounded-[3px] shadow-none p-4 flex items-center space-x-3.5">
        <div className="p-2 border border-zinc-800 bg-zinc-950 text-white rounded-[2px]">
          <Clock className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Session Duration</p>
          <h3 className="text-sm font-bold text-white font-mono">
            {session?.status === 'ended' ? 'ENDED' : elapsed}
          </h3>
        </div>
      </Card>
    </div>
  );
}
