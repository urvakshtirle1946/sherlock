// signals/index.ts — barrel export for all signal extractors
export { nameMatchSignal } from './nameMatch';
export { emailMatchSignal } from './emailMatch';
export { faceVerificationSignal, faceVerificationCached, loadFaceApiModels, clearFaceCache } from './faceVerification';
export { voiceActivitySignal } from './voiceActivity';
export { transcriptAnalysisSignal } from './transcriptAnalysis';
export { joinOrderSignal } from './joinOrder';
export { cameraPresenceSignal } from './cameraPresence';
export { screenShareSignal } from './screenShare';
export type { SignalResult } from './nameMatch';
