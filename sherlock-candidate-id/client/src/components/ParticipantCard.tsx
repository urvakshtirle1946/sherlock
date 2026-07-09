import React from 'react';
import { Participant, Prediction } from '../store/sessionStore';
import { Camera, Mic, ScreenShare, Mail, UserCheck, Volume2, Sparkles, Check, X } from 'lucide-react';

interface ParticipantCardProps {
  participant: Participant;
  prediction?: Prediction;
}

export function ParticipantCard({ participant, prediction }: ParticipantCardProps) {
  const isLeft = !!participant.leftAt;
  const confidence = prediction ? Math.round(prediction.confidenceScore * 100) : 0;
  
  // Find name match and email match percentage from the evidence breakdown if available
  const nameMatch = prediction?.evidenceBreakdown?.['name_match']
    ? Math.round(prediction.evidenceBreakdown['name_match'].rawScore * 100)
    : 0;

  const emailMatch = prediction?.evidenceBreakdown?.['email_match']
    ? Math.round(prediction.evidenceBreakdown['email_match'].rawScore * 100)
    : null;

  const faceMatch = prediction?.evidenceBreakdown?.['face_match']
    ? Math.round(prediction.evidenceBreakdown['face_match'].rawScore * 100)
    : null;

  return (
    <div className={`glass-panel p-4 relative overflow-hidden transition-all duration-300 ${isLeft ? 'opacity-40' : 'glass-panel-hover border-cyan-500/10'}`}>
      {/* Ambiguity and Left tags */}
      <div className="absolute top-2 right-2 flex space-x-1.5">
        {prediction?.ambiguous && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 pulse-glow">
            Ambiguous
          </span>
        )}
        {isLeft && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
            Disconnected
          </span>
        )}
        {!isLeft && prediction?.rank === 1 && !prediction.ambiguous && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 pulse-glow">
            Top Candidate
          </span>
        )}
      </div>

      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-white text-base truncate max-w-[180px]">{participant.displayName}</h4>
          <span className="text-xs text-gray-400 font-mono select-all">{participant.participantId.slice(0, 8)}...</span>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold text-cyan-400 font-mono">{confidence}%</span>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Confidence</p>
        </div>
      </div>

      {/* Grid of indicators */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-4">
        {/* Email indicator */}
        <div className="flex items-center space-x-2 text-gray-300">
          <Mail className="w-3.5 h-3.5 text-gray-400" />
          <span className="truncate" title={participant.email || 'No email detected'}>
            {participant.email ? (
              <span className={emailMatch && emailMatch > 0 ? 'text-emerald-400 font-medium' : 'text-gray-300'}>
                {participant.email.split('@')[0]}
              </span>
            ) : (
              <span className="text-gray-500 italic">No email</span>
            )}
          </span>
        </div>

        {/* Speaking time */}
        <div className="flex items-center space-x-2 text-gray-300">
          <Volume2 className="w-3.5 h-3.5 text-gray-400" />
          <span>Speaking: <strong className="font-mono text-white">{Math.round(participant.totalSpeakingSeconds)}s</strong></span>
        </div>

        {/* Name Match */}
        <div className="flex items-center space-x-2 text-gray-300">
          <UserCheck className="w-3.5 h-3.5 text-gray-400" />
          <span>Name Match: <strong className={`font-mono ${nameMatch > 70 ? 'text-emerald-400' : nameMatch > 30 ? 'text-amber-400' : 'text-rose-400'}`}>{nameMatch}%</strong></span>
        </div>

        {/* Face Match */}
        <div className="flex items-center space-x-2 text-gray-300">
          <Sparkles className="w-3.5 h-3.5 text-gray-400" />
          <span>
            Face Match:{' '}
            {faceMatch !== null ? (
              <strong className={`font-mono ${faceMatch > 70 ? 'text-emerald-400' : faceMatch > 30 ? 'text-amber-400' : 'text-rose-400'}`}>
                {faceMatch}%
              </strong>
            ) : (
              <span className="text-gray-500 italic">No face frame</span>
            )}
          </span>
        </div>
      </div>

      {/* Hardware Status footer bar */}
      <div className="flex items-center justify-between border-t border-white/5 pt-2.5 mt-2">
        <div className="flex space-x-3">
          <span className={`flex items-center space-x-1 ${participant.cameraOn ? 'text-cyan-400' : 'text-gray-500'}`} title="Camera status">
            <Camera className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase font-mono">{participant.cameraOn ? 'ON' : 'OFF'}</span>
          </span>
          <span className={`flex items-center space-x-1 ${participant.microphoneOn ? 'text-emerald-400' : 'text-gray-500'}`} title="Microphone status">
            <Mic className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase font-mono">{participant.microphoneOn ? 'ON' : 'OFF'}</span>
          </span>
        </div>
        <span className={`flex items-center space-x-1 ${participant.screenSharing ? 'text-purple-400' : 'text-gray-500'}`} title="Screen share status">
          <ScreenShare className="w-3.5 h-3.5" />
          <span className="text-[10px] uppercase font-mono">{participant.screenSharing ? 'SHARING' : 'INACTIVE'}</span>
        </span>
      </div>
    </div>
  );
}
