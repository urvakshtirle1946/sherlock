import mongoose, { Document, Schema } from 'mongoose';

// Per-signal contribution detail stored alongside the total score.
// Enables the Explainability Panel to show exactly what drove the prediction.
export interface EvidenceBreakdown {
  [signalType: string]: {
    rawScore: number;   // 0–1 from the extractor
    weight: number;     // from SIGNAL_WEIGHTS
    contribution: number; // rawScore × weight
    reason: string;     // human-readable from the extractor
  };
}

export interface ICandidatePrediction extends Document {
  sessionId: mongoose.Types.ObjectId;
  participantId: string;
  // Final weighted sum, 0–1
  confidenceScore: number;
  evidenceBreakdown: EvidenceBreakdown;
  // Prose explanation (from LLM or template fallback)
  explanation: string;
  // True when top-2 participants are within 5 percentage points of each other.
  // The dashboard should surface this explicitly — never silently force a pick.
  ambiguous: boolean;
  createdAt: Date;
}

const EvidenceBreakdownSchema = new Schema(
  {
    rawScore: Number,
    weight: Number,
    contribution: Number,
    reason: String,
  },
  { _id: false }
);

const CandidatePredictionSchema = new Schema<ICandidatePrediction>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
    participantId: { type: String, required: true },
    confidenceScore: { type: Number, required: true, min: 0, max: 1 },
    evidenceBreakdown: { type: Map, of: EvidenceBreakdownSchema, default: {} },
    explanation: { type: String, default: '' },
    ambiguous: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CandidatePredictionSchema.index({ sessionId: 1, createdAt: -1 });

export default mongoose.model<ICandidatePrediction>('CandidatePrediction', CandidatePredictionSchema);
