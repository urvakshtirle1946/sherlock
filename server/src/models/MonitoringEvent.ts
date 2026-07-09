import mongoose, { Document, Schema } from 'mongoose';

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

export interface IMonitoringEvent extends Document {
  sessionId: string;
  type: string;
  deviceId?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  createdAt: Date;
}

const MonitoringEventSchema = new Schema<IMonitoringEvent>(
  {
    sessionId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    deviceId: { type: String },
    detail: { type: String },
    metadata: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model<IMonitoringEvent>('MonitoringEvent', MonitoringEventSchema);
