import { useCallback, useRef } from 'react';
import type { MonitoringEventPayload } from '../lib/monitoring/config';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useMonitoringReporter(sessionId: string) {
  const queueRef = useRef<MonitoringEventPayload[]>([]);
  const deviceIdRef = useRef<string | null>(null);

  const setDeviceId = useCallback((id: string) => {
    deviceIdRef.current = id;
  }, []);

  const report = useCallback(
    (type: MonitoringEventPayload['type'], detail?: string, metadata?: Record<string, unknown>) => {
      const event: MonitoringEventPayload = {
        type,
        sessionId,
        deviceId: deviceIdRef.current ?? undefined,
        detail,
        metadata,
        timestamp: new Date().toISOString(),
      };
      queueRef.current.push(event);

      // Fire-and-forget immediate send for critical events
      fetch(`${API_BASE_URL}/api/sessions/${sessionId}/monitoring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      }).catch((err) => console.warn('[monitoring] report failed:', err));
    },
    [sessionId]
  );

  return { report, setDeviceId };
}
