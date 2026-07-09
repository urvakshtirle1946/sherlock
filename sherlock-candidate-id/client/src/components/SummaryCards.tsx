import React, { useState, useEffect } from 'react';
import { useSessionStore } from '../store/sessionStore';
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
      <div className="glass-panel glass-panel-hover p-4 flex items-center space-x-4">
        <div className="p-3 rounded-lg bg-cyan-500/10 text-cyan-400">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Top Candidate</p>
          <h3 className="text-lg font-semibold text-white truncate max-w-[150px]">
            {topCandidate ? topCandidate.displayName : 'Detecting...'}
          </h3>
        </div>
      </div>

      {/* CARD 2: Confidence */}
      <div className="glass-panel glass-panel-hover p-4 flex items-center space-x-4">
        <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
          <Cpu className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Confidence Score</p>
          <h3 className="text-lg font-semibold text-white">
            {topCandidate ? `${Math.round(topCandidate.confidenceScore * 100)}%` : '0%'}
          </h3>
        </div>
      </div>

      {/* CARD 3: Participant Count */}
      <div className="glass-panel glass-panel-hover p-4 flex items-center space-x-4">
        <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Active Speakers</p>
          <h3 className="text-lg font-semibold text-white">
            {activeParticipants.length} <span className="text-xs text-gray-400">({participants.length} joined)</span>
          </h3>
        </div>
      </div>

      {/* CARD 4: Clock */}
      <div className="glass-panel glass-panel-hover p-4 flex items-center space-x-4">
        <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400">
          <Clock className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">Session Duration</p>
          <h3 className="text-lg font-semibold text-white">
            {session?.status === 'ended' ? 'Ended' : elapsed}
          </h3>
        </div>
      </div>
    </div>
  );
}
