'use client';

import React from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';

export interface MonitoringEvent {
  type: string;
  deviceId?: string;
  detail: string;
  timestamp: string;
  metadata?: {
    details?: {
      os: string;
      browser: string;
      deviceType: 'mobile' | 'tablet' | 'desktop';
      screen: string;
      cpuCores: number;
      gpu: string;
      ram?: string;
    };
    ipAddress?: string;
  };
}

interface MonitoringPanelProps {
  events: MonitoringEvent[];
  sessionId: string;
}

export function MonitoringPanel({ events, sessionId }: MonitoringPanelProps) {
  const monitorUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/monitor/${sessionId}`
      : `/monitor/${sessionId}`;

  return (
    <Card className="bg-black border-zinc-800 rounded-[3px] p-4 space-y-3 h-full flex flex-col shadow-none">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
          Proctoring Monitor
        </h3>
        <a
          href={monitorUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[9px] text-zinc-400 hover:text-white uppercase font-bold tracking-wider font-mono transition-colors"
        >
          Open monitor →
        </a>
      </div>

      <p className="text-[9px] text-zinc-500 uppercase leading-relaxed font-mono">
        TRACKS CLIENT FINGERPRINT · TAB VISIBILITY · FACE & POSTURE WARNINGS.
      </p>

      {/* Shareable Link Box */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-[2px] p-2.5 space-y-1.5 font-mono">
        <div className="flex items-center justify-between text-[8px] text-zinc-500 font-bold uppercase tracking-wider">
          <span>Candidate Monitoring Link</span>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(monitorUrl);
              alert('Copied candidate monitor link to clipboard!');
            }}
            variant="outline"
            size="sm"
            className="h-5 text-[8px] px-1.5 uppercase font-bold rounded-[2px] border-zinc-800 hover:bg-zinc-900 cursor-pointer"
          >
            Copy URL
          </Button>
        </div>
        <div className="bg-black border border-zinc-900 rounded-[2px] px-2 py-1 text-[8px] text-white select-all font-mono truncate">
          {monitorUrl.toUpperCase()}
        </div>
      </div>

      <div className="flex-grow overflow-y-auto space-y-1.5 max-h-48 font-mono text-[9px]">
        {events.length === 0 ? (
          <p className="text-[10px] text-zinc-500 text-center py-4 uppercase">
            No monitoring events yet. Share the monitor link with the candidate.
          </p>
        ) : (
          events.slice(0, 30).map((ev, i) => {
            const cleanType = ev.type.replace(/_/g, ' ').toUpperCase();
            
            // Symbol tag flag based on type severity
            let symbol = '[+]';
            if (ev.type === 'tab_blur' || ev.type === 'camera_off' || ev.type === 'face_missing' || ev.type === 'posture_warning') {
              symbol = '[!]';
            }

            return (
              <div
                key={`${ev.timestamp}-${i}`}
                className="flex items-start gap-1.5 py-1 border-b border-zinc-900 last:border-0"
              >
                <span className={symbol === '[!]' ? 'text-white font-bold' : 'text-zinc-600'}>
                  {symbol}
                </span>
                <div className="flex-grow min-w-0">
                  <span className="font-bold text-zinc-300">
                    {cleanType}
                  </span>
                  {ev.detail && (
                    <span className="text-zinc-500 ml-1">— {ev.detail.toUpperCase()}</span>
                  )}
                  {ev.type === 'device_fingerprint' && ev.metadata?.details && (
                    <div className="mt-1.5 p-2 bg-zinc-950 rounded-[2px] border border-zinc-900 space-y-1 text-zinc-500 text-[8px] leading-normal uppercase">
                      <div className="flex justify-between border-b border-zinc-900 pb-0.5 mb-1">
                        <span className="text-zinc-600 font-semibold">IP ADDRESS:</span>
                        <span className="text-white font-bold">{ev.metadata.ipAddress || 'UNKNOWN'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 font-semibold">PLATFORM:</span>
                        <span className="text-zinc-300">{ev.metadata.details.os} · {ev.metadata.details.browser}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 font-semibold">DEVICE TYPE:</span>
                        <span className="text-zinc-300">{ev.metadata.details.deviceType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 font-semibold">SCREEN SIZE:</span>
                        <span className="text-zinc-300">{ev.metadata.details.screen}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 font-semibold">PROCESSOR:</span>
                        <span className="text-zinc-300">{ev.metadata.details.cpuCores} CPU CORES</span>
                      </div>
                      {ev.metadata.details.ram && (
                        <div className="flex justify-between">
                          <span className="text-zinc-600 font-semibold">SYSTEM MEMORY:</span>
                          <span className="text-zinc-300">{ev.metadata.details.ram}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-zinc-600 font-semibold">GPU RENDERER:</span>
                        <span className="text-zinc-300 truncate max-w-[130px]">{ev.metadata.details.gpu}</span>
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-zinc-600 flex-shrink-0">
                  {new Date(ev.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                  })}
                </span>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
