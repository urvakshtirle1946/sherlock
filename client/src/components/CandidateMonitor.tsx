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
import { Card } from './ui/card';
import { Button } from './ui/button';

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
      <div className="min-h-screen flex items-center justify-center bg-black text-zinc-500 font-mono text-xs uppercase">
        Loading session…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white font-mono text-xs uppercase">
        Session not found.
      </div>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto flex flex-col gap-6 font-mono text-[10px]">
      {/* Header */}
      <header className="text-center space-y-1">
        <div className="w-8 h-8 rounded-[2px] bg-zinc-950 border border-zinc-800 flex items-center justify-center text-white mx-auto mb-3">
          <Monitor className="w-4 h-4" />
        </div>
        <h1 className="text-sm font-bold text-white uppercase tracking-wider">Interview Monitor</h1>
        <p className="text-[9px] text-zinc-400 uppercase mt-0.5">
          {session.candidateName} · {session.candidateEmail}
        </p>
      </header>

      {/* Scope notice */}
      <Card className="bg-zinc-950/20 border border-zinc-900 rounded-[2px] p-3 text-[9px] text-zinc-500 leading-relaxed uppercase shadow-none">
        This monitor detects tab switches and camera/posture via browser APIs.
        It cannot block other apps or lock your browser tab — that requires a native desktop agent.
      </Card>

      {/* Status cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatusCard
          icon={<Fingerprint className="w-3.5 h-3.5" />}
          label="Device ID"
          value={fingerprintLoading ? '…' : deviceId?.slice(0, 12) ?? '—'}
          ok={!!deviceId}
          sub="FingerprintJS"
        />
        <StatusCard
          icon={tabVisibility.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          label="Tab Focus"
          value={tabVisibility.isVisible ? 'FOCUSED' : 'AWAY'}
          ok={tabVisibility.isVisible}
          sub={`${tabVisibility.blurCount} SWITCH${tabVisibility.blurCount !== 1 ? 'ES' : ''}`}
        />
        <StatusCard
          icon={cameraState.faceDetected ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}
          label="Camera / Face"
          value={
            cameraState.permissionDenied
              ? 'DENIED'
              : cameraState.faceDetected
                ? 'FACE OK'
                : 'NO FACE'
          }
          ok={cameraState.faceDetected}
          sub="MediaPipe Face"
        />
        <StatusCard
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Timer"
          value={monitoringActive ? timer.formattedRemaining : `${durationMinutes}:00`}
          ok={!timer.isExpired}
          sub={monitoringActive ? (timer.isRunning ? 'RUNNING' : 'ENDED') : 'NOT STARTED'}
        />
      </div>

      {/* Posture */}
      {monitoringActive && (
        <div
          className={`border rounded-[2px] p-3 flex items-center gap-2 text-[9px] uppercase bg-black ${
            cameraState.postureOk ? 'border-zinc-800 text-zinc-300' : 'border-amber-800 text-amber-500'
          }`}
        >
          {cameraState.postureOk ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-white" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
          )}
          <span>{cameraState.postureReason?.toUpperCase() || 'CHECKING POSTURE…'}</span>
          <span className="ml-auto text-[8px] text-zinc-600">MediaPipe Pose</span>
        </div>
      )}

      {cameraState.mediaPipeError && (
        <div className="bg-black border border-zinc-900 text-zinc-500 rounded-[2px] p-3 text-[9px] leading-relaxed uppercase">
          <p className="font-bold text-white mb-1">Face/Posture Detector Error:</p>
          <code className="text-[8px] break-all">{cameraState.mediaPipeError}</code>
          <p className="mt-2 text-zinc-600 text-[8px]">
            Make sure you have an active internet connection to download the MediaPipe models, and that your webcam is not in use by another application.
          </p>
        </div>
      )}

      {/* Webcam preview */}
      <Card className="bg-black border border-zinc-800 rounded-[2px] p-4 space-y-3 shadow-none">
        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
          Camera Preview
        </p>
        <div className="relative rounded-[2px] overflow-hidden bg-black border border-zinc-900 aspect-video">
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
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-[9px] text-zinc-500 uppercase">
              Allow camera access to continue
            </div>
          )}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {!monitoringActive ? (
          <Button
            onClick={handleStartMonitoring}
            disabled={!cameraState.ready || fingerprintLoading}
            size="sm"
            className="w-full h-10 text-[10px] font-bold uppercase rounded-[2px] cursor-pointer"
          >
            {!cameraState.permissionGranted
              ? 'Waiting for camera permission…'
              : !cameraState.faceDetected
                ? 'Position your face in frame…'
                : 'Start Interview Monitoring'}
          </Button>
        ) : (
          <div className="border border-zinc-800 bg-zinc-950 p-3 text-center text-[10px] text-white uppercase rounded-[2px] font-bold">
            Monitoring active · {timer.formattedRemaining} remaining
          </div>
        )}

        {session.meetingUrl && (
          <a
            href={session.meetingUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 text-[9px] text-zinc-400 hover:text-white uppercase font-bold tracking-wider transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
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
    <Card className="bg-black border border-zinc-800 rounded-[2px] p-3 space-y-1 shadow-none">
      <div className="flex items-center gap-1.5 text-[8px] text-zinc-500 uppercase tracking-wider font-bold">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-[10px] font-bold text-white uppercase">{value}</p>
      <p className="text-[8px] text-zinc-600 uppercase">{sub}</p>
    </Card>
  );
}
