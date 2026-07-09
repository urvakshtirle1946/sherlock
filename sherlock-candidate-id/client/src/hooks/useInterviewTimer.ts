import { useEffect, useState, useRef } from 'react';

export interface InterviewTimerState {
  elapsedMs: number;
  remainingMs: number;
  isRunning: boolean;
  isExpired: boolean;
  formattedRemaining: string;
}

function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Simple countdown timer — product logic, no library needed.
 * Tied to session start and configured duration.
 */
export function useInterviewTimer(
  durationMinutes: number,
  startedAt: Date | null,
  active: boolean,
  onExpired?: () => void
) {
  const [state, setState] = useState<InterviewTimerState>({
    elapsedMs: 0,
    remainingMs: durationMinutes * 60_000,
    isRunning: false,
    isExpired: false,
    formattedRemaining: formatMs(durationMinutes * 60_000),
  });

  const expiredFiredRef = useRef(false);
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  const startedAtTime = startedAt?.getTime() ?? null;

  useEffect(() => {
    if (!active || !startedAtTime) {
      setState((s) => {
        if (!s.isRunning) return s;
        return { ...s, isRunning: false };
      });
      return;
    }

    const durationMs = durationMinutes * 60_000;

    const tick = () => {
      const elapsed = Date.now() - startedAtTime;
      const remaining = Math.max(0, durationMs - elapsed);
      const expired = remaining === 0;

      setState({
        elapsedMs: elapsed,
        remainingMs: remaining,
        isRunning: !expired,
        isExpired: expired,
        formattedRemaining: formatMs(remaining),
      });

      if (expired && !expiredFiredRef.current) {
        expiredFiredRef.current = true;
        onExpiredRef.current?.();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active, startedAtTime, durationMinutes]);

  return state;
}
