import React, { useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { Plus, Trash2, Camera, Mic, ScreenShare, MessageSquare, ShieldAlert, Cpu } from 'lucide-react';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';

interface SimulatorPanelProps {
  sessionId: string;
  emit: (event: string, data: any) => void;
}

export function SimulatorPanel({ sessionId, emit }: SimulatorPanelProps) {
  const participants = useSessionStore((state) => state.participants);
  const predictions = useSessionStore((state) => state.predictions);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);

  // Per-participant custom transcript inputs
  const [transcripts, setTranscripts] = useState<Record<string, string>>({});
  
  // Custom signal values
  const [customSignalType, setCustomSignalType] = useState('face_match');
  const [customSignalValue, setCustomSignalValue] = useState(0.8);
  const [customSignalReason, setCustomSignalReason] = useState('Biometric matching confirmed');

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    emit('sim:add_participant', {
      sessionId,
      displayName: newName.trim(),
      email: newEmail.trim() || undefined,
    });
    setNewName('');
    setNewEmail('');
  };

  const handleRemoveParticipant = (pid: string) => {
    emit('sim:remove_participant', { sessionId, participantId: pid });
    if (activeSpeaker === pid) {
      setActiveSpeaker(null);
    }
  };

  const handleToggleSpeaking = (pid: string, currentlySpeaking: boolean) => {
    emit('sim:set_speaking', {
      sessionId,
      participantId: pid,
      speaking: !currentlySpeaking,
    });
    if (!currentlySpeaking) {
      setActiveSpeaker(pid);
    } else if (activeSpeaker === pid) {
      setActiveSpeaker(null);
    }
  };

  const handleToggleCamera = (pid: string, currentlyOn: boolean) => {
    emit('sim:set_camera', {
      sessionId,
      participantId: pid,
      on: !currentlyOn,
    });
  };

  const handleToggleScreenShare = (pid: string, currentlySharing: boolean) => {
    emit('sim:set_screenshare', {
      sessionId,
      participantId: pid,
      sharing: !currentlySharing,
    });
  };

  const handleInjectTranscript = (pid: string) => {
    const text = transcripts[pid]?.trim();
    if (!text) return;
    
    emit('sim:inject_transcript', {
      sessionId,
      participantId: pid,
      text,
    });
    
    setTranscripts({ ...transcripts, [pid]: '' });
  };

  const handleInjectSignal = (pid: string) => {
    emit('sim:inject_signal', {
      sessionId,
      participantId: pid,
      type: customSignalType,
      value: customSignalValue,
      reason: customSignalReason || `Manual injection of ${customSignalType}`,
    });
  };

  const activeList = participants.filter((p) => !p.leftAt);

  return (
    <Card className="bg-black border-zinc-800 rounded-[3px] p-4 h-full flex flex-col overflow-y-auto shadow-none font-mono text-[10px]">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">
        Participant Simulator
      </h3>

      {/* Add Participant Form */}
      <form onSubmit={handleAddParticipant} className="space-y-2 mb-4 pb-4 border-b border-zinc-900 flex-shrink-0">
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="text"
            placeholder="DISPLAY NAME"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-7 text-[9px] bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-white rounded-[2px] uppercase"
          />
          <Input
            type="email"
            placeholder="EMAIL (OPTIONAL)"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="h-7 text-[9px] bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-white rounded-[2px] uppercase"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          className="w-full h-7 text-[9px] font-bold uppercase rounded-[2px] cursor-pointer"
        >
          <Plus className="w-3 h-3 mr-1" />
          <span>Add Fake Participant</span>
        </Button>
      </form>

      {/* Manual Signals Injector Block */}
      {activeList.length > 0 && (
        <div className="mb-4 pb-4 border-b border-zinc-900 bg-zinc-950 p-2.5 rounded-[2px] border border-zinc-900 flex-shrink-0 space-y-2">
          <h4 className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider flex items-center space-x-1">
            <ShieldAlert className="w-3 h-3 text-white" />
            <span>Manual Signal Overrider</span>
          </h4>
          <div className="grid grid-cols-3 gap-1.5">
            <select
              value={customSignalType}
              onChange={(e) => setCustomSignalType(e.target.value)}
              className="h-7 bg-black border border-zinc-800 rounded-[2px] p-1 text-[8px] text-white focus:outline-none uppercase"
            >
              <option value="face_match">FACE MATCH</option>
              <option value="email_match">EMAIL MATCH</option>
              <option value="name_match">NAME MATCH</option>
              <option value="camera_presence">CAM PRESENCE</option>
              <option value="screen_share">SCREEN SHARE</option>
              <option value="voice_activity">VOICE ACT</option>
              <option value="transcript_reference">TRANSCRIPT</option>
            </select>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={customSignalValue}
              onChange={(e) => setCustomSignalValue(parseFloat(e.target.value))}
              className="h-7 text-[8px] bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-white rounded-[2px]"
              placeholder="VALUE 0.0 - 1.0"
            />
            <Input
              type="text"
              value={customSignalReason}
              onChange={(e) => setCustomSignalReason(e.target.value)}
              className="h-7 text-[8px] bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-white rounded-[2px] uppercase"
              placeholder="REASON"
            />
          </div>
        </div>
      )}

      {/* Participant Actions list */}
      <div className="flex-grow space-y-3 overflow-y-auto pr-1">
        {activeList.map((p) => {
          const isSpeaking = activeSpeaker === p.participantId;
          const pred = predictions.find((pr) => pr.participantId === p.participantId);
          const conf = pred ? Math.round(pred.confidenceScore * 100) : 0;

          return (
            <div key={p.participantId} className="border border-zinc-900 bg-zinc-950/40 rounded-[2px] p-3 text-[10px]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white truncate max-w-[120px] uppercase">{p.displayName}</span>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-white">{conf}%</span>
                  <Button
                    onClick={() => handleRemoveParticipant(p.participantId)}
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-zinc-500 hover:text-white cursor-pointer rounded-[2px]"
                    title="Remove participant"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Status Toggles */}
              <div className="grid grid-cols-3 gap-1 mb-3">
                <Button
                  onClick={() => handleToggleSpeaking(p.participantId, isSpeaking)}
                  variant="outline"
                  size="sm"
                  className={`h-6 text-[8px] uppercase font-bold rounded-[2px] border-zinc-800 ${
                    isSpeaking ? 'bg-white text-black hover:bg-zinc-200' : 'bg-black text-zinc-400 hover:bg-zinc-900'
                  }`}
                >
                  <Mic className="w-2.5 h-2.5 mr-1" />
                  <span>{isSpeaking ? 'SPEAKING' : 'MIC_OFF'}</span>
                </Button>
                <Button
                  onClick={() => handleToggleCamera(p.participantId, p.cameraOn)}
                  variant="outline"
                  size="sm"
                  className={`h-6 text-[8px] uppercase font-bold rounded-[2px] border-zinc-800 ${
                    p.cameraOn ? 'bg-white text-black hover:bg-zinc-200' : 'bg-black text-zinc-400 hover:bg-zinc-900'
                  }`}
                >
                  <Camera className="w-2.5 h-2.5 mr-1" />
                  <span>{p.cameraOn ? 'CAM_ON' : 'CAM_OFF'}</span>
                </Button>
                <Button
                  onClick={() => handleToggleScreenShare(p.participantId, p.screenSharing)}
                  variant="outline"
                  size="sm"
                  className={`h-6 text-[8px] uppercase font-bold rounded-[2px] border-zinc-800 ${
                    p.screenSharing ? 'bg-white text-black hover:bg-zinc-200' : 'bg-black text-zinc-400 hover:bg-zinc-900'
                  }`}
                >
                  <ScreenShare className="w-2.5 h-2.5 mr-1" />
                  <span>{p.screenSharing ? 'SCREEN_ON' : 'SCREEN_OFF'}</span>
                </Button>
              </div>

              {/* Transcript Injector */}
              <div className="flex items-center space-x-1.5 mb-2">
                <Input
                  type="text"
                  placeholder="INJECT SPEECH..."
                  value={transcripts[p.participantId] || ''}
                  onChange={(e) => setTranscripts({ ...transcripts, [p.participantId]: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleInjectTranscript(p.participantId)}
                  className="flex-grow h-6 text-[8px] bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-white rounded-[2px] uppercase"
                />
                <Button
                  onClick={() => handleInjectTranscript(p.participantId)}
                  size="sm"
                  className="h-6 w-6 p-0 rounded-[2px] cursor-pointer"
                  title="Inject Transcript Line"
                >
                  <MessageSquare className="w-2.5 h-2.5" />
                </Button>
              </div>

              {/* Custom Overrides Trigger */}
              <Button
                onClick={() => handleInjectSignal(p.participantId)}
                variant="outline"
                size="sm"
                className="w-full h-6 text-[8px] uppercase font-bold border-zinc-800 rounded-[2px] cursor-pointer"
              >
                Apply Override Match Settings
              </Button>
            </div>
          );
        })}
        {activeList.length === 0 && (
          <p className="text-center text-[10px] text-zinc-500 py-6 uppercase font-mono">Add fake participants above to start the simulation.</p>
        )}
      </div>
    </Card>
  );
}
