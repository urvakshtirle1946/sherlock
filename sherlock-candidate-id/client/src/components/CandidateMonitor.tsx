'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import {
  Camera,
  CameraOff,
  Clock,
  Eye,
  EyeOff,
  Fingerprint,
  Monitor,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { getDeviceFingerprint } from '../lib/monitoring/deviceFingerprint';
import { MONITORING_CONFIG } from '../lib/monitoring/config';
import { useTabVisibility } from '../hooks/useTabVisibility';
import { useInterviewTimer } from '../hooks/useInterviewTimer';
import { useCameraMonitor } from '../hooks/useCameraMonitor';
import { useMonitoringReporter } from '../hooks/useMonitoringReporter';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface SessionInfo {
  _id: string;
  candidateName: string;
  candidateEmail: string;
  meetingUrl: string;
  status: string;
  startedAt?: string;
  interviewDurationMinutes?: number;
}

interface CandidateMonitorProps {
  sessionId: string;
}

export function CandidateMonitor({ sessionId }: CandidateMonitorProps) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [fingerprintLoading, setFingerprintLoading] = useState(true);
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [loading, setLoading] = useState(true);

  const { report, setDeviceId: setReporterDeviceId } = useMonitoringReporter(sessionId);

  const durationMinutes =
    session?.interviewDurationMinutes ?? MONITORING_CONFIG.DEFAULT_INTERVIEW_DURATION_MINUTES;

  const startedAt = monitoringActive
    ? new Date(session?.startedAt ?? Date.now())
    : null;

  const timer = useInterviewTimer(durationMinutes, startedAt, monitoringActive, () => {
    report('timer_ended', 'Interview duration elapsed');
  });

  const tabVisibility = useTabVisibility(
    (awayMs) => report('tab_blur', `Tab hidden for ${Math.round(awayMs / 1000)}s`),
    () => report('tab_focus', 'Tab regained focus')
  );

  const { webcamRef, state: cameraState, handleUserMedia, handleUserMediaError } =
    useCameraMonitor({
      onFaceMissing: () => {
        if (monitoringActive) report('face_missing', 'Face not visible in camera');
      },
      onFaceDetected: () => {
        if (monitoringActive) report('face_detected', 'Face visible in camera');
      },
      onPostureWarning: (reason) => {
        if (monitoringActive) report('posture_warning', reason);
      },
      onPostureOk: () => {
        if (monitoringActive) report('posture_ok', 'Posture within acceptable range');
      },
      onCameraOff: () => {
        if (monitoringActive) report('camera_off', 'Camera access lost or denied');
      },
    });

  // Load session
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/sessions/${sessionId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Session not found');
        return r.json();
      })
      .then((data) => {
        if (data.error || !data._id) {
          setSession(null);
        } else {
          setSession(data);
        }
      })
      .catch((err) => {
        console.error(err);
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  // Device fingerprint via FingerprintJS
  useEffect(() => {
    getDeviceFingerprint()
      .then((fp) => {
        setDeviceId(fp.visitorId);
        setReporterDeviceId(fp.visitorId);
        report('device_fingerprint', `Device identified: ${fp.visitorId.slice(0, 8)}…`, {
          visitorId: fp.visitorId,
          confidence: fp.confidence,
          details: fp.details,
        });
      })
      .catch(console.error)
      .finally(() => setFingerprintLoading(false));
  }, [report, setReporterDeviceId]);

  // Periodically send face verification frames to server
  useEffect(() => {
    if (!monitoringActive) return;

    const interval = setInterval(() => {
      if (webcamRef.current) {
        const screenshot = webcamRef.current.getScreenshot();
        if (screenshot) {
          fetch(`${API_BASE_URL}/api/sessions/${sessionId}/face-match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ frame: screenshot }),
          }).catch((err) => console.warn('[face-match] capture failed:', err));
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [monitoringActive, sessionId]);

  const handleStartMonitoring = useCallback(async () => {
    if (!cameraState.permissionGranted) {
      report('camera_denied', 'Camera permission required to start');
      return;
    }

    // Mark session active on server
    await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    }).catch(console.error);

    setMonitoringActive(true);
    report('timer_started', `Interview timer started (${durationMinutes} min)`);
    report('session_ready', 'Monitoring session active');
    report('camera_on', 'Camera stream active');
  }, [cameraState.permissionGranted, sessionId, durationMinutes, report]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Loading session…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rose-400 text-sm">
        Session not found.
      </div>
    );
  }

  return (
    <main className="min-h-screen p-6 cyber-grid max-w-2xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <header className="text-center space-y-1">
        <div className="w-10 h-10 rounded-lg bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto mb-3">
          <Monitor className="w-5 h-5" />
        </div>
        <h1 className="text-lg font-bold text-white">Interview Monitor</h1>
        <p className="text-xs text-gray-400">
          {session.candidateName} · {session.candidateEmail}
        </p>
      </header>

      {/* Scope notice — background blocking / tab lock not possible */}
      <div className="glass-panel p-3 text-[10px] text-gray-500 border-white/5 leading-relaxed">
        This monitor detects tab switches and camera/posture via browser APIs.
        It cannot block other apps or lock your browser tab — that requires a native desktop agent.
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatusCard
          icon={<Fingerprint className="w-4 h-4" />}
          label="Device ID"
          value={fingerprintLoading ? '…' : deviceId?.slice(0, 12) ?? '—'}
          ok={!!deviceId}
          sub="FingerprintJS"
        />
        <StatusCard
          icon={tabVisibility.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          label="Tab Focus"
          value={tabVisibility.isVisible ? 'Focused' : 'Away'}
          ok={tabVisibility.isVisible}
          sub={`${tabVisibility.blurCount} switch${tabVisibility.blurCount !== 1 ? 'es' : ''}`}
        />
        <StatusCard
          icon={cameraState.faceDetected ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
          label="Camera / Face"
          value={
            cameraState.permissionDenied
              ? 'Denied'
              : cameraState.faceDetected
                ? 'Face OK'
                : 'No face'
          }
          ok={cameraState.faceDetected}
          sub="MediaPipe Face"
        />
        <StatusCard
          icon={<Clock className="w-4 h-4" />}
          label="Timer"
          value={monitoringActive ? timer.formattedRemaining : `${durationMinutes}:00`}
          ok={!timer.isExpired}
          sub={monitoringActive ? (timer.isRunning ? 'Running' : 'Ended') : 'Not started'}
        />
      </div>

      {/* Posture */}
      {monitoringActive && (
        <div
          className={`glass-panel p-3 flex items-center gap-2 text-xs ${
            cameraState.postureOk ? 'border-emerald-500/20 text-emerald-400' : 'border-amber-500/20 text-amber-400'
          }`}
        >
          {cameraState.postureOk ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{cameraState.postureReason || 'Checking posture…'}</span>
          <span className="ml-auto text-[10px] text-gray-500">MediaPipe Pose</span>
        </div>
      )}

      {cameraState.mediaPipeError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg p-3 text-xs leading-relaxed">
          <p className="font-semibold mb-1">Face/Posture Detector Error:</p>
          <code className="text-[10px] break-all">{cameraState.mediaPipeError}</code>
          <p className="mt-2 text-gray-500 text-[10px]">
            Make sure you have an active internet connection to download the MediaPipe models, and that your webcam is not in use by another application.
          </p>
        </div>
      )}

      {/* Webcam preview — always mounted so permission can be requested pre-start */}
      <div className="glass-panel p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Camera Preview
        </p>
        <div className="relative rounded-lg overflow-hidden bg-slate-900 aspect-video">
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored
            onUserMedia={handleUserMedia}
            onUserMediaError={handleUserMediaError}
            className="w-full h-full object-cover"
            videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
          />
          {!cameraState.permissionGranted && !cameraState.permissionDenied && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-xs text-gray-400">
              Allow camera access to continue
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {!monitoringActive ? (
          <button
            onClick={handleStartMonitoring}
            disabled={!cameraState.ready || fingerprintLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-lg cursor-pointer transition-colors"
          >
            {!cameraState.permissionGranted
              ? 'Waiting for camera permission…'
              : !cameraState.faceDetected
                ? 'Position your face in frame…'
                : 'Start Interview Monitoring'}
          </button>
        ) : (
          <div className="glass-panel p-3 text-center text-xs text-emerald-400 border-emerald-500/20">
            Monitoring active · {timer.formattedRemaining} remaining
          </div>
        )}

        {session.meetingUrl && (
          <a
            href={session.meetingUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open meeting link
          </a>
        )}
      </div>
    </main>
  );
}

function StatusCard({
  icon,
  label,
  value,
  ok,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ok: boolean;
  sub: string;
}) {
  return (
    <div className={`glass-panel p-3 space-y-1 ${ok ? 'border-white/5' : 'border-amber-500/20'}`}>
      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-wider">
        {icon}
        <span>{label}</span>
      </div>
      <p className={`text-sm font-semibold ${ok ? 'text-white' : 'text-amber-400'}`}>{value}</p>
      <p className="text-[10px] text-gray-600">{sub}</p>
    </div>
  );
}
