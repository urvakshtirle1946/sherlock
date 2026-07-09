'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import {
  getFaceLandmarker,
  getPoseLandmarker,
  detectFace,
  detectPose,
  disposeVisionModels,
} from '../lib/monitoring/mediapipe';
import { assessPosture } from '../lib/monitoring/postureAnalysis';
import { MONITORING_CONFIG } from '../lib/monitoring/config';

export interface CameraMonitorState {
  permissionGranted: boolean;
  permissionDenied: boolean;
  faceDetected: boolean;
  postureOk: boolean;
  postureReason: string;
  ready: boolean;
  mediaPipeError?: string;
}

interface UseCameraMonitorOptions {
  enabled?: boolean;
  onFaceMissing?: () => void;
  onFaceDetected?: () => void;
  onPostureWarning?: (reason: string) => void;
  onPostureOk?: () => void;
  onCameraOff?: () => void;
}

/**
 * Camera gate + ongoing face/posture monitoring via MediaPipe.
 * Session won't be "ready" until getUserMedia is granted AND a face is detected.
 */
export function useCameraMonitor(options: UseCameraMonitorOptions) {
  const { enabled, onFaceMissing, onFaceDetected, onPostureWarning, onPostureOk, onCameraOff } =
    options;

  const webcamRef = useRef<Webcam>(null);
  const [state, setState] = useState<CameraMonitorState>({
    permissionGranted: false,
    permissionDenied: false,
    faceDetected: false,
    postureOk: true,
    postureReason: '',
    ready: false,
    mediaPipeError: undefined,
  });

  const lastFaceRef = useRef<boolean | null>(null);
  const lastPostureRef = useRef<boolean | null>(null);
  const modelsReadyRef = useRef(false);

  // Store callbacks in refs to avoid useEffect triggers on anonymous function re-creation
  const onFaceMissingRef = useRef(onFaceMissing);
  const onFaceDetectedRef = useRef(onFaceDetected);
  const onPostureWarningRef = useRef(onPostureWarning);
  const onPostureOkRef = useRef(onPostureOk);
  const onCameraOffRef = useRef(onCameraOff);

  useEffect(() => {
    onFaceMissingRef.current = onFaceMissing;
    onFaceDetectedRef.current = onFaceDetected;
    onPostureWarningRef.current = onPostureWarning;
    onPostureOkRef.current = onPostureOk;
    onCameraOffRef.current = onCameraOff;
  });

  const handleUserMedia = useCallback(() => {
    setState((s) => ({ ...s, permissionGranted: true, permissionDenied: false }));
  }, []);

  const handleUserMediaError = useCallback(() => {
    setState((s) => ({
      ...s,
      permissionGranted: false,
      permissionDenied: true,
      ready: false,
    }));
    onCameraOffRef.current?.();
  }, []);

  useEffect(() => {
    if (!state.permissionGranted) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function init() {
      try {
        await getFaceLandmarker();
        await getPoseLandmarker();
        if (cancelled) return;
        modelsReadyRef.current = true;

        intervalId = setInterval(async () => {
          const video = webcamRef.current?.video;
          if (
            !video ||
            video.readyState < 2 ||
            video.videoWidth === 0 ||
            video.videoHeight === 0 ||
            !modelsReadyRef.current
          ) {
            return;
          }

          const ts = performance.now();

          try {
            const faceLm = await getFaceLandmarker();
            const faceResult = detectFace(faceLm, video, ts);
            const hasFace = (faceResult.faceLandmarks?.length ?? 0) > 0;

            if (hasFace !== lastFaceRef.current) {
              lastFaceRef.current = hasFace;
              if (hasFace) onFaceDetectedRef.current?.();
              else onFaceMissingRef.current?.();
            }

            const poseLm = await getPoseLandmarker();
            const poseResult = detectPose(poseLm, video, ts);
            const landmarks = poseResult.landmarks?.[0];
            let postureOk = true;
            let postureReason = 'Posture OK';

            if (landmarks) {
              const assessment = assessPosture(landmarks);
              postureOk = assessment.ok;
              postureReason = assessment.reason;

              if (postureOk !== lastPostureRef.current) {
                lastPostureRef.current = postureOk;
                if (postureOk) onPostureOkRef.current?.();
                else onPostureWarningRef.current?.(postureReason);
              }
            }

            setState((s) => ({
              ...s,
              faceDetected: hasFace,
              postureOk,
              postureReason,
              ready: s.permissionGranted && hasFace,
              mediaPipeError: undefined, // Clear any previous errors if a frame processed successfully
            }));
          } catch (err) {
            console.warn('[cameraMonitor] Frame processing error:', err);
            const msg = err instanceof Error ? err.message : String(err);
            setState((s) => ({ ...s, mediaPipeError: `Frame error: ${msg}` }));
          }
        }, MONITORING_CONFIG.VISION_CHECK_INTERVAL_MS);
      } catch (err) {
        console.error('[cameraMonitor] MediaPipe init failed:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setState((s) => ({ ...s, mediaPipeError: `Init error: ${msg}` }));
      }
    }

    init();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      disposeVisionModels();
      modelsReadyRef.current = false;
    };
  }, [state.permissionGranted]);

  return { webcamRef, state, handleUserMedia, handleUserMediaError };
}
