import mongoose, { Document, Schema } from 'mongoose';

export type SessionStatus = 'pending' | 'active' | 'ended';

export interface ISession extends Document {
  candidateName: string;
  candidateEmail: string;
  candidatePhotoUrl: string; // path to uploaded reference photo
  meetingPlatform: 'google_meet' | 'zoom' | 'teams' | 'other';
  meetingUrl: string;
  startedAt?: Date;
  endedAt?: Date;
  status: SessionStatus;
  ingestionMode: 'demo' | 'live';
  recallBotId?: string;
  interviewDurationMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    candidateName: { type: String, required: true, trim: true },
    candidateEmail: { type: String, required: true, trim: true, lowercase: true },
    candidatePhotoUrl: { type: String, default: '' },
    meetingPlatform: {
      type: String,
      enum: ['google_meet', 'zoom', 'teams', 'other'],
      default: 'google_meet',
    },
    meetingUrl: { type: String, default: '' },
    startedAt: { type: Date },
    endedAt: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'active', 'ended'],
      default: 'pending',
    },
    ingestionMode: {
      type: String,
      enum: ['demo', 'live'],
      default: 'demo',
    },
    recallBotId: { type: String, default: '' },
    interviewDurationMinutes: { type: Number, default: 60, min: 5, max: 480 },
  },
  { timestamps: true }
);

export default mongoose.model<ISession>('Session', SessionSchema);
