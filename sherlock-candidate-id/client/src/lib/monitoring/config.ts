// Business-logic thresholds only — signal interpretation (CV) is delegated to libraries.
export const MONITORING_CONFIG = {
  /** How long tab can be hidden before flagging (ms) */
  TAB_AWAY_THRESHOLD_MS: 5_000,
  /** Default interview duration if session has no explicit value (minutes) */
  DEFAULT_INTERVIEW_DURATION_MINUTES: 60,
  /** Max torso lean from vertical before posture warning (degrees) */
  POSTURE_LEAN_THRESHOLD_DEG: 25,
  /** How often to run posture/face checks on the video stream (ms) */
  VISION_CHECK_INTERVAL_MS: 1_000,
  /** How often to batch-report monitoring events to server (ms) */
  REPORT_INTERVAL_MS: 3_000,
} as const;

export type MonitoringEventType =
  | 'device_fingerprint'
  | 'tab_blur'
  | 'tab_focus'
  | 'camera_denied'
  | 'camera_on'
  | 'camera_off'
  | 'face_missing'
  | 'face_detected'
  | 'posture_warning'
  | 'posture_ok'
  | 'timer_started'
  | 'timer_ended'
  | 'session_ready';

export interface MonitoringEventPayload {
  type: MonitoringEventType;
  sessionId: string;
  deviceId?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}
