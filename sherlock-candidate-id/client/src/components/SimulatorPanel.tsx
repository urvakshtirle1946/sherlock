import React, { useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { Plus, Trash2, Camera, Mic, ScreenShare, MessageSquare, ShieldAlert, Cpu } from 'lucide-react';

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
    <div className="glass-panel p-4 h-full flex flex-col overflow-y-auto">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center space-x-2">
        <Cpu className="w-4 h-4 text-cyan-400" />
        <span>Participant Simulator Panel</span>
      </h3>

      {/* Add Participant Form */}
      <form onSubmit={handleAddParticipant} className="space-y-2 mb-4 pb-4 border-b border-white/5 flex-shrink-0">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Display Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="bg-slate-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
          <input
            type="email"
            placeholder="Email (Optional)"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="bg-slate-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <button
          type="submit"
          className="w-full flex items-center justify-center space-x-1 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-medium py-1.5 px-3 rounded text-xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Fake Participant</span>
        </button>
      </form>

      {/* Manual Signals Injector Block */}
      {activeList.length > 0 && (
        <div className="mb-4 pb-4 border-b border-white/5 bg-slate-900/40 p-2.5 rounded border border-white/5 flex-shrink-0">
          <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center space-x-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span>Manual Signal Overrider</span>
          </h4>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            <select
              value={customSignalType}
              onChange={(e) => setCustomSignalType(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded p-1 text-[10px] text-white focus:outline-none"
            >
              <option value="face_match">Face Match</option>
              <option value="email_match">Email Match</option>
              <option value="name_match">Name Match</option>
              <option value="camera_presence">Camera Presence</option>
              <option value="screen_share">Screen Share</option>
              <option value="voice_activity">Voice Activity</option>
              <option value="transcript_reference">Transcript Match</option>
            </select>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={customSignalValue}
              onChange={(e) => setCustomSignalValue(parseFloat(e.target.value))}
              className="bg-slate-900 border border-white/10 rounded p-1 text-[10px] text-white focus:outline-none"
              placeholder="Value 0.0 - 1.0"
            />
            <input
              type="text"
              value={customSignalReason}
              onChange={(e) => setCustomSignalReason(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded p-1 text-[10px] text-white focus:outline-none"
              placeholder="Reason / Log"
            />
          </div>
        </div>
      )}

      {/* Participant Actions list */}
      <div className="flex-grow space-y-3 overflow-y-auto">
        {activeList.map((p) => {
          const isSpeaking = activeSpeaker === p.participantId;
          const pred = predictions.find((pr) => pr.participantId === p.participantId);
          const conf = pred ? Math.round(pred.confidenceScore * 100) : 0;

          return (
            <div key={p.participantId} className="border border-white/5 bg-slate-900/30 rounded p-3 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white truncate max-w-[120px]">{p.displayName}</span>
                <div className="flex items-center space-x-1.5">
                  <span className="font-mono text-cyan-400 font-bold">{conf}%</span>
                  <button
                    onClick={() => handleRemoveParticipant(p.participantId)}
                    className="p-1 rounded text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    title="Remove participant"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Status Toggles */}
              <div className="grid grid-cols-3 gap-1 mb-3">
                <button
                  onClick={() => handleToggleSpeaking(p.participantId, isSpeaking)}
                  className={`flex items-center justify-center space-x-1 py-1 rounded cursor-pointer ${
                    isSpeaking ? 'bg-emerald-600 text-white font-medium' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                  }`}
                >
                  <Mic className="w-3 h-3" />
                  <span className="text-[9px] uppercase">{isSpeaking ? 'Speaking' : 'Mic Off'}</span>
                </button>
                <button
                  onClick={() => handleToggleCamera(p.participantId, p.cameraOn)}
                  className={`flex items-center justify-center space-x-1 py-1 rounded cursor-pointer ${
                    p.cameraOn ? 'bg-cyan-600 text-white font-medium' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                  }`}
                >
                  <Camera className="w-3 h-3" />
                  <span className="text-[9px] uppercase">{p.cameraOn ? 'Cam On' : 'Cam Off'}</span>
                </button>
                <button
                  onClick={() => handleToggleScreenShare(p.participantId, p.screenSharing)}
                  className={`flex items-center justify-center space-x-1 py-1 rounded cursor-pointer ${
                    p.screenSharing ? 'bg-purple-600 text-white font-medium' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                  }`}
                >
                  <ScreenShare className="w-3 h-3" />
                  <span className="text-[9px] uppercase">{p.screenSharing ? 'Sharing' : 'Share'}</span>
                </button>
              </div>

              {/* Transcript Injector */}
              <div className="flex items-center space-x-1.5 mb-2">
                <input
                  type="text"
                  placeholder="Inject speech..."
                  value={transcripts[p.participantId] || ''}
                  onChange={(e) => setTranscripts({ ...transcripts, [p.participantId]: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleInjectTranscript(p.participantId)}
                  className="flex-grow bg-slate-900 border border-white/10 rounded px-2 py-1 text-[10px] text-white focus:outline-none"
                />
                <button
                  onClick={() => handleInjectTranscript(p.participantId)}
                  className="bg-cyan-600 hover:bg-cyan-500 p-1.5 rounded text-white cursor-pointer"
                  title="Inject Transcript Line"
                >
                  <MessageSquare className="w-3 h-3" />
                </button>
              </div>

              {/* Custom Overrides Trigger */}
              <button
                onClick={() => handleInjectSignal(p.participantId)}
                className="w-full bg-slate-800 hover:bg-gray-700 text-cyan-400 hover:text-cyan-300 py-1 rounded text-[10px] font-medium border border-cyan-500/10 cursor-pointer"
              >
                Apply Override Match Settings
              </button>
            </div>
          );
        })}
        {activeList.length === 0 && (
          <p className="text-center text-xs text-gray-500 py-6">Add fake participants above to start the simulation.</p>
        )}
      </div>
    </div>
  );
}
