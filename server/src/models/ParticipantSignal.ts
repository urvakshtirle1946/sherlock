import mongoose, { Document, Schema } from 'mongoose';

// Every distinct signal event is stored as a separate doc.
// This gives us a full timestamped history that powers the
// confidence-over-time graph and session replay.
export type SignalType =
  | 'name_match'
  | 'email_match'
  | 'face_match'
  | 'voice_activity'
  | 'screen_share'
  | 'camera_presence'
  | 'join_order'
  | 'transcript_reference';

export interface IParticipantSignal extends Document {
  sessionId: mongoose.Types.ObjectId;
  participantId: string;
  type: SignalType;
  // Raw score from the extractor, 0–1
  value: number;
  // The weight applied during this computation (mirrors SIGNAL_WEIGHTS)
  weight: number;
  // value × weight — weighted contribution to the total
  confidence: number;
  // Human-readable reason string from the extractor
  reason: string;
  timestamp: Date;
}

const ParticipantSignalSchema = new Schema<IParticipantSignal>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
    participantId: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'name_match',
        'email_match',
        'face_match',
        'voice_activity',
        'screen_share',
        'camera_presence',
        'join_order',
        'transcript_reference',
      ],
      required: true,
    },
    value: { type: Number, required: true, min: 0, max: 1 },
    weight: { type: Number, required: true },
    confidence: { type: Number, required: true },
    reason: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false } // we manage timestamp ourselves
);

ParticipantSignalSchema.index({ sessionId: 1, participantId: 1, type: 1, timestamp: -1 });

export default mongoose.model<IParticipantSignal>('ParticipantSignal', ParticipantSignalSchema);
