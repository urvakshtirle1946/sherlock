'use client';

import React from 'react';
import {
  Fingerprint,
  EyeOff,
  Camera,
  AlertTriangle,
  Clock,
  Activity,
} from 'lucide-react';

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

const EVENT_ICONS: Record<string, React.ReactNode> = {
  device_fingerprint: <Fingerprint className="w-3 h-3" />,
  tab_blur: <EyeOff className="w-3 h-3" />,
  tab_focus: <Activity className="w-3 h-3" />,
  camera_on: <Camera className="w-3 h-3" />,
  camera_off: <Camera className="w-3 h-3" />,
  face_missing: <AlertTriangle className="w-3 h-3" />,
  posture_warning: <AlertTriangle className="w-3 h-3" />,
  timer_started: <Clock className="w-3 h-3" />,
  timer_ended: <Clock className="w-3 h-3" />,
};

const EVENT_COLORS: Record<string, string> = {
  tab_blur: 'text-amber-400',
  face_missing: 'text-rose-400',
  posture_warning: 'text-amber-400',
  camera_off: 'text-rose-400',
  camera_denied: 'text-rose-400',
  timer_ended: 'text-gray-400',
  session_ready: 'text-emerald-400',
  device_fingerprint: 'text-cyan-400',
};

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
    <div className="glass-panel p-4 space-y-3 h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          Candidate Monitor
        </h3>
        <a
          href={monitorUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Open monitor →
        </a>
      </div>

      <p className="text-[10px] text-gray-500 leading-relaxed">
        FingerprintJS device ID · Page Visibility tab blur · MediaPipe face/posture · interview timer.
        Background app blocking and tab lock are not in scope.
      </p>

      {/* Shareable Link Box */}
      <div className="bg-slate-900/50 border border-white/5 rounded-lg p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-[9px] text-gray-500 font-semibold uppercase tracking-wider">
          <span>Candidate Monitoring Link</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(monitorUrl);
              alert('Copied candidate monitor link to clipboard!');
            }}
            className="text-cyan-400 hover:text-cyan-300 cursor-pointer font-semibold uppercase focus:outline-none"
          >
            Copy URL
          </button>
        </div>
        <div className="bg-slate-950/80 border border-white/5 rounded px-2 py-1 text-[10px] text-cyan-300 select-all font-mono truncate">
          {monitorUrl}
        </div>
      </div>

      <div className="flex-grow overflow-y-auto space-y-1.5 max-h-48">
        {events.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4">
            No monitoring events yet. Share the monitor link with the candidate.
          </p>
        ) : (
          events.slice(0, 30).map((ev, i) => (
            <div
              key={`${ev.timestamp}-${i}`}
              className="flex items-start gap-2 text-[10px] py-1 border-b border-white/3"
            >
              <span className={`mt-0.5 flex-shrink-0 ${EVENT_COLORS[ev.type] ?? 'text-gray-500'}`}>
                {EVENT_ICONS[ev.type] ?? <Activity className="w-3 h-3" />}
              </span>
              <div className="flex-grow min-w-0">
                <span className={`font-medium ${EVENT_COLORS[ev.type] ?? 'text-gray-300'}`}>
                  {ev.type.replace(/_/g, ' ')}
                </span>
                {ev.detail && (
                  <span className="text-gray-500 ml-1">— {ev.detail}</span>
                )}
                {ev.type === 'device_fingerprint' && ev.metadata?.details && (
                  <div className="mt-1.5 p-2 bg-slate-950/50 rounded border border-white/5 space-y-1 text-gray-400 font-mono text-[9px] leading-normal">
                    <div className="flex justify-between border-b border-white/3 pb-0.5 mb-1">
                      <span className="text-gray-600">IP ADDRESS:</span>
                      <span className="text-cyan-400 font-bold">{ev.metadata.ipAddress || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">PLATFORM:</span>
                      <span className="text-white font-medium">{ev.metadata.details.os} · {ev.metadata.details.browser}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">DEVICE TYPE:</span>
                      <span className="text-white uppercase font-medium">{ev.metadata.details.deviceType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">SCREEN SIZE:</span>
                      <span className="text-white font-medium">{ev.metadata.details.screen}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">PROCESSOR:</span>
                      <span className="text-white font-medium">{ev.metadata.details.cpuCores} CPU cores</span>
                    </div>
                    {ev.metadata.details.ram && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">SYSTEM MEMORY:</span>
                        <span className="text-white font-medium">{ev.metadata.details.ram}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">GPU RENDERER:</span>
                      <span className="text-gray-300 font-medium truncate max-w-[130px]" title={ev.metadata.details.gpu}>{ev.metadata.details.gpu}</span>
                    </div>
                  </div>
                )}
              </div>
              <span className="text-gray-600 flex-shrink-0 font-mono">
                {new Date(ev.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
