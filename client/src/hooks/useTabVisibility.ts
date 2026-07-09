import { useEffect, useRef, useState, useCallback } from 'react';
import { MONITORING_CONFIG } from '../lib/monitoring/config';

export interface TabVisibilityState {
  isVisible: boolean;
  blurCount: number;
  totalAwayMs: number;
  currentAwayMs: number;
}

/**
 * Tab blur/focus detection via the native Page Visibility API.
 * Tab lock is intentionally NOT attempted — browsers block it.
 */
export function useTabVisibility(onBlur?: (awayMs: number) => void, onFocus?: () => void) {
  const [state, setState] = useState<TabVisibilityState>({
    isVisible: true,
    blurCount: 0,
    totalAwayMs: 0,
    currentAwayMs: 0,
  });

  const blurStartRef = useRef<number | null>(null);
  const awayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      blurStartRef.current = Date.now();
      setState((s) => ({ ...s, isVisible: false, blurCount: s.blurCount + 1 }));

      awayTimerRef.current = setTimeout(() => {
        if (blurStartRef.current) {
          const awayMs = Date.now() - blurStartRef.current;
          onBlur?.(awayMs);
        }
      }, MONITORING_CONFIG.TAB_AWAY_THRESHOLD_MS);
    } else {
      if (awayTimerRef.current) {
        clearTimeout(awayTimerRef.current);
        awayTimerRef.current = null;
      }

      let awayDuration = 0;
      if (blurStartRef.current) {
        awayDuration = Date.now() - blurStartRef.current;
        blurStartRef.current = null;
      }

      setState((s) => ({
        ...s,
        isVisible: true,
        totalAwayMs: s.totalAwayMs + awayDuration,
        currentAwayMs: 0,
      }));

      onFocus?.();
    }
  }, [onBlur, onFocus]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (awayTimerRef.current) clearTimeout(awayTimerRef.current);
    };
  }, [handleVisibilityChange]);

  return state;
}
