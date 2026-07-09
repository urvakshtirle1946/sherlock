import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { MONITORING_CONFIG } from './config';

// MediaPipe Pose landmark indices (from the official model spec)
const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
} as const;

function midpoint(a: NormalizedLandmark, b: NormalizedLandmark) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

/** Degrees of lean from vertical between shoulder midpoint and hip midpoint. */
function torsoLeanDegrees(shoulders: { x: number; y: number }, hips: { x: number; y: number }): number {
  const dx = hips.x - shoulders.x;
  const dy = hips.y - shoulders.y;
  const angleRad = Math.atan2(dx, -dy);
  return Math.abs(angleRad * (180 / Math.PI));
}

export interface PostureAssessment {
  ok: boolean;
  leanDegrees: number;
  reason: string;
}

/**
 * Business-logic layer on top of MediaPipe pose keypoints.
 * The model supplies landmarks; we only apply product thresholds here.
 */
export function assessPosture(landmarks: NormalizedLandmark[]): PostureAssessment {
  const ls = landmarks[LM.LEFT_SHOULDER];
  const rs = landmarks[LM.RIGHT_SHOULDER];
  const lh = landmarks[LM.LEFT_HIP];
  const rh = landmarks[LM.RIGHT_HIP];

  if (!ls || !rs || !lh || !rh) {
    return { ok: false, leanDegrees: 0, reason: 'Upper body not visible in frame' };
  }

  const shoulders = midpoint(ls, rs);
  const hips = midpoint(lh, rh);
  const lean = torsoLeanDegrees(shoulders, hips);

  if (lean > MONITORING_CONFIG.POSTURE_LEAN_THRESHOLD_DEG) {
    return {
      ok: false,
      leanDegrees: lean,
      reason: `Torso leaning ${lean.toFixed(0)}° — sit upright`,
    };
  }

  return { ok: true, leanDegrees: lean, reason: 'Posture OK' };
}
