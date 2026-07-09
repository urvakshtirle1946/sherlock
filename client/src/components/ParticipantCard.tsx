import React from 'react';
import { Participant, Prediction } from '../store/sessionStore';
import { Camera, Mic, ScreenShare, Mail, UserCheck, Volume2, Sparkles } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

interface ParticipantCardProps {
  participant: Participant;
  prediction?: Prediction;
}

export function ParticipantCard({ participant, prediction }: ParticipantCardProps) {
  const isLeft = !!participant.leftAt;
  const confidence = prediction ? Math.round(prediction.confidenceScore * 100) : 0;
  
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
    <Card className={`bg-black border-zinc-800 rounded-[3px] p-4 relative overflow-hidden transition-all duration-300 shadow-none ${isLeft ? 'opacity-40' : 'hover:border-zinc-700'}`}>
      {/* Ambiguity and Left tags */}
      <div className="absolute top-2 right-2 flex space-x-1.5">
        {prediction?.ambiguous && (
          <Badge variant="outline" className="text-[8px] py-0 px-1 bg-transparent text-amber-500 border-amber-500/30 uppercase rounded-[2px] font-mono">
            AMBIGUOUS
          </Badge>
        )}
        {isLeft && (
          <Badge variant="outline" className="text-[8px] py-0 px-1 bg-transparent text-zinc-500 border-zinc-800 uppercase rounded-[2px] font-mono">
            DISCONNECTED
          </Badge>
        )}
        {!isLeft && prediction?.rank === 1 && !prediction.ambiguous && (
          <Badge variant="outline" className="text-[8px] py-0 px-1 bg-transparent text-white border-white uppercase rounded-[2px] font-mono">
            TOP CANDIDATE
          </Badge>
        )}
      </div>

      <div className="flex items-start justify-between mb-3 mt-1">
        <div>
          <h4 className="font-bold text-white text-sm truncate max-w-[180px] uppercase font-mono">{participant.displayName}</h4>
          <span className="text-[9px] text-zinc-500 font-mono select-all uppercase">{participant.participantId.slice(0, 8)}...</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-white font-mono">{confidence}%</span>
          <p className="text-[8px] text-zinc-500 uppercase tracking-wider font-semibold">Confidence</p>
        </div>
      </div>

      {/* Grid of indicators */}
      <div className="grid grid-cols-2 gap-2 text-[10px] mb-4 font-mono">
        {/* Email indicator */}
        <div className="flex items-center space-x-2 text-zinc-400">
          <Mail className="w-3 h-3 text-zinc-500" />
          <span className="truncate" title={participant.email || 'No email detected'}>
            {participant.email ? (
              <span className="text-zinc-300">
                {participant.email.split('@')[0].toUpperCase()}
              </span>
            ) : (
              <span className="text-zinc-600 italic">NO EMAIL</span>
            )}
          </span>
        </div>

        {/* Speaking time */}
        <div className="flex items-center space-x-2 text-zinc-400">
          <Volume2 className="w-3 h-3 text-zinc-500" />
          <span>SPEAK: <strong className="font-bold text-white">{Math.round(participant.totalSpeakingSeconds)}S</strong></span>
        </div>

        {/* Name Match */}
        <div className="flex items-center space-x-2 text-zinc-400">
          <UserCheck className="w-3 h-3 text-zinc-500" />
          <span>NAME: <strong className="font-bold text-white">{nameMatch}%</strong></span>
        </div>

        {/* Face Match */}
        <div className="flex items-center space-x-2 text-zinc-400">
          <Sparkles className="w-3 h-3 text-zinc-500" />
          <span>
            FACE:{' '}
            {faceMatch !== null ? (
              <strong className="font-bold text-white">
                {faceMatch}%
              </strong>
            ) : (
              <span className="text-zinc-600 italic">NONE</span>
            )}
          </span>
        </div>
      </div>

      {/* Hardware Status footer bar */}
      <div className="flex items-center justify-between border-t border-zinc-900 pt-2.5 mt-2 text-[9px] font-mono">
        <div className="flex space-x-3">
          <span className={`flex items-center space-x-1 ${participant.cameraOn ? 'text-white' : 'text-zinc-600'}`} title="Camera status">
            <Camera className="w-3 h-3" />
            <span className="font-bold">{participant.cameraOn ? 'CAM_ON' : 'CAM_OFF'}</span>
          </span>
          <span className={`flex items-center space-x-1 ${participant.microphoneOn ? 'text-white' : 'text-zinc-600'}`} title="Microphone status">
            <Mic className="w-3 h-3" />
            <span className="font-bold">{participant.microphoneOn ? 'MIC_ON' : 'MIC_OFF'}</span>
          </span>
        </div>
        <span className={`flex items-center space-x-1 ${participant.screenSharing ? 'text-white' : 'text-zinc-600'}`} title="Screen share status">
          <ScreenShare className="w-3 h-3" />
          <span className="font-bold">{participant.screenSharing ? 'SHARING' : 'SCREEN_OFF'}</span>
        </span>
      </div>
    </Card>
  );
}
