'use client';

import React from 'react';
import { SessionForm } from '../components/SessionForm';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Terminal } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-black">
      <div className="max-w-md w-full mx-auto space-y-6">
        
        {/* LOGO & TITLE HEADER */}
        <div className="text-center flex flex-col items-center border border-zinc-800 p-6 bg-zinc-950/40 rounded-[3px]">
          <h2 className="text-lg font-bold tracking-tight text-white uppercase">
            SHERLOCK AUDITOR
          </h2>
          <p className="mt-2 text-[10px] text-zinc-400 leading-relaxed max-w-[320px] uppercase font-mono">
            Candidate Verification & Proctoring under Uncertainty
          </p>
        </div>

        {/* SETUP CONTAINER */}
        <Card className="bg-black border-zinc-800 rounded-[3px] shadow-none">
          <CardHeader className="border-b border-zinc-800/60 pb-4 mb-4">
            <CardTitle className="text-xs font-semibold text-white uppercase tracking-wider">
              Configure Session
            </CardTitle>
            <CardDescription className="text-[10px] text-zinc-500 uppercase">
              Initialize candidate references & meeting links
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SessionForm />
          </CardContent>
        </Card>

        {/* INFORMATIONAL INFO FOOTER CARD */}
        <Card className="bg-zinc-950/20 border-zinc-900 rounded-[3px] shadow-none p-4 flex items-start space-x-3 text-[10px] leading-relaxed text-zinc-400">
          <Terminal className="w-4 h-4 text-white mt-0.5 flex-shrink-0" />
          <div>
            <strong className="text-zinc-200 font-semibold block mb-1 uppercase tracking-wider">Architecture Warning</strong>
            The system combines name matching, face similarity, and speaking duration. Launch this session and open the Participant Simulator in the next screen to start generating signals.
          </div>
        </Card>

      </div>
    </main>
  );
}
