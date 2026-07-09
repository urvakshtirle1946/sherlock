'use client';

import React from 'react';
import { SessionForm } from '../components/SessionForm';
import { Eye, ShieldAlert, Sparkles, Terminal } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-height-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 cyber-grid">
      <div className="max-w-md w-full mx-auto space-y-8">
        
        {/* LOGO & TITLE HEADER */}
        <div className="text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-cyan-900/20 pulse-glow">
            <Eye className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center space-x-1.5">
            <span>Sherlock Candidate Identifier</span>
          </h2>
          <p className="mt-2 text-xs text-gray-400 leading-relaxed max-w-[320px]">
            Biometric and behavioural analysis under uncertainty. Identifies the actual candidate in video interviews.
          </p>
        </div>

        {/* SETUP CONTAINER */}
        <div className="glass-panel p-6 border-cyan-500/10 shadow-2xl shadow-cyan-950/20">
          <div className="flex items-center space-x-2 border-b border-white/5 pb-4 mb-4">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Configure Session</h3>
          </div>

          <SessionForm />
        </div>

        {/* INFORMATIONAL INFO FOOTER CARD */}
        <div className="glass-panel p-4 bg-slate-900/40 flex items-start space-x-3 text-xs leading-relaxed text-gray-400 border-white/5">
          <Terminal className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
          <div>
            <strong className="text-gray-300 font-medium block mb-1">Architecture Warning</strong>
            The system combines name matching, face similarity, and speaking duration. Launch this session and open the Participant Simulator in the next screen to start generating signals.
          </div>
        </div>

      </div>
    </main>
  );
}
