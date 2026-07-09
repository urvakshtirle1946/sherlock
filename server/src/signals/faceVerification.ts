// faceVerification.ts
// Pure JS/TS version of Face Verification Signal Extractor.
// Uses @tensorflow/tfjs and pure JS decoders (jpeg-js, pngjs) to decode
// images and feed 3D tensors directly to face-api.js.
// This completely avoids native gyp C++ binaries for 'canvas'.

import * as faceapi from 'face-api.js';
import * as tf from '@tensorflow/tfjs';
import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import * as path from 'path';
import * as fs from 'fs';

export interface SignalResult {
  score: number;
  confidence: number;
  reason: string;
}

let modelsLoaded = false;
const MODEL_DIR = path.resolve(__dirname, '../../models/face-api');

/**
 * Load face-api models once at server startup.
 */
export async function loadFaceApiModels(): Promise<void> {
  if (modelsLoaded) return;
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);
  modelsLoaded = true;
  console.log('[faceVerification] face-api models loaded');
}

/**
 * Decodes a base64 image (JPEG or PNG) into a tf.Tensor3D in pure JS.
 */
function base64ToTensor(base64: string): tf.Tensor3D {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  try {
    // Try JPEG
    const raw = jpeg.decode(buffer, { useTArray: true });
    return tf.tidy(() => {
      const numPixels = raw.width * raw.height;
      const values = new Int32Array(numPixels * 3);
      for (let i = 0; i < numPixels; i++) {
        values[i * 3] = raw.data[i * 4];
        values[i * 3 + 1] = raw.data[i * 4 + 1];
        values[i * 3 + 2] = raw.data[i * 4 + 2];
      }
      return tf.tensor3d(values, [raw.height, raw.width, 3], 'int32');
    });
  } catch (jpegErr) {
    try {
      // Try PNG
      const png = PNG.sync.read(buffer);
      return tf.tidy(() => {
        const numPixels = png.width * png.height;
        const values = new Int32Array(numPixels * 3);
        for (let i = 0; i < numPixels; i++) {
          values[i * 3] = png.data[i * 4];
          values[i * 3 + 1] = png.data[i * 4 + 1];
          values[i * 3 + 2] = png.data[i * 4 + 2];
        }
        return tf.tensor3d(values, [png.height, png.width, 3], 'int32');
      });
    } catch (pngErr) {
      throw new Error(`Failed to decode image as JPEG or PNG`);
    }
  }
}

/**
 * Given a base64 image string, detect the face and return its 128-d descriptor.
 */
async function descriptorFromBase64(
  base64: string
): Promise<Float32Array | null> {
  const tensor = base64ToTensor(base64);
  try {
    const detection = await faceapi
      .detectSingleFace(tensor as any, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    return detection ? detection.descriptor : null;
  } finally {
    tensor.dispose(); // Prevent memory leaks
  }
}

/**
 * Cosine similarity between two Float32Arrays.
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Main face verification signal.
 */
export async function faceVerificationSignal(
  frameBase64: string,
  referenceBase64: string
): Promise<Omit<SignalResult, 'confidence'>> {
  if (!modelsLoaded) {
    return { score: 0, reason: 'Face-api models not yet loaded — skipping frame' };
  }

  try {
    const [frameDescriptor, referenceDescriptor] = await Promise.all([
      descriptorFromBase64(frameBase64),
      descriptorFromBase64(referenceBase64),
    ]);

    if (!referenceDescriptor) {
      return { score: 0, reason: 'No face detected in reference photo' };
    }
    if (!frameDescriptor) {
      return { score: 0, reason: 'No face detected in participant video frame' };
    }

    const similarity = cosineSimilarity(frameDescriptor, referenceDescriptor);
    const score = Math.max(0, (similarity - 0.5) / 0.5);

    if (score < 0.2) {
      return {
        score,
        reason: `Low face similarity (${(similarity * 100).toFixed(0)}% cosine) — likely different person`,
      };
    }

    return {
      score,
      reason: `Face similarity ${(similarity * 100).toFixed(0)}% — ${
        score > 0.7 ? 'strong' : 'moderate'
      } match to reference photo`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[faceVerification] error:', msg);
    return { score: 0, reason: `Face verification error: ${msg}` };
  }
}

// ── Cached wrapper ──────────────────────────────────────────────────────────
const referenceCache = new Map<string, Float32Array | null>();
const frameCache = new Map<string, { descriptor: Float32Array; ts: number }>();
const FRAME_CACHE_TTL_MS = 5000;

export async function faceVerificationCached(
  sessionId: string,
  participantId: string,
  frameBase64: string,
  referenceBase64: string
): Promise<Omit<SignalResult, 'confidence'>> {
  if (!modelsLoaded) {
    return { score: 0, reason: 'Face-api models not yet loaded' };
  }

  try {
    if (!referenceCache.has(sessionId)) {
      referenceCache.set(sessionId, await descriptorFromBase64(referenceBase64));
    }
    const referenceDescriptor = referenceCache.get(sessionId)!;
    if (!referenceDescriptor) {
      return { score: 0, reason: 'No face detected in reference photo' };
    }

    const cacheKey = `${sessionId}:${participantId}`;
    const cached = frameCache.get(cacheKey);
    let frameDescriptor: Float32Array | null = null;

    if (cached && Date.now() - cached.ts < FRAME_CACHE_TTL_MS) {
      frameDescriptor = cached.descriptor;
    } else {
      frameDescriptor = await descriptorFromBase64(frameBase64);
      if (frameDescriptor) {
        frameCache.set(cacheKey, { descriptor: frameDescriptor, ts: Date.now() });
      }
    }

    if (!frameDescriptor) {
      return { score: 0, reason: 'No face detected in participant video frame' };
    }

    const similarity = cosineSimilarity(frameDescriptor, referenceDescriptor);
    const score = Math.max(0, (similarity - 0.5) / 0.5);

    return {
      score,
      reason: `Face similarity ${(similarity * 100).toFixed(0)}% — ${
        score > 0.7 ? 'strong' : score > 0.4 ? 'moderate' : 'weak'
      } match to reference photo`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[faceVerification] cached error:', msg);
    return { score: 0, reason: `Face verification error: ${msg}` };
  }
}

export function clearFaceCache(sessionId: string): void {
  referenceCache.delete(sessionId);
}
