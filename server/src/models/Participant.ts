import mongoose, { Document, Schema } from 'mongoose';

export interface IParticipant extends Document {
  sessionId: mongoose.Types.ObjectId;
  // participantId is the meeting-provider ID (e.g. Meet tile ID or simulator-generated UUID)
  participantId: string;
  displayName: string;
  email?: string; // populated if detectable from meeting metadata
  joinedAt: Date;
  leftAt?: Date;
  cameraOn: boolean;
  microphoneOn: boolean;
  screenSharing: boolean;
  // Cumulative speaking seconds, updated on each voice-activity tick
  totalSpeakingSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantSchema = new Schema<IParticipant>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
    participantId: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date },
    cameraOn: { type: Boolean, default: false },
    microphoneOn: { type: Boolean, default: false },
    screenSharing: { type: Boolean, default: false },
    totalSpeakingSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound index so we can quickly look up a specific participant within a session
ParticipantSchema.index({ sessionId: 1, participantId: 1 }, { unique: true });

export default mongoose.model<IParticipant>('Participant', ParticipantSchema);
