import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Sparkles, Video, Mail, User, Image as ImageIcon, ArrowRight } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function SessionForm() {
  const router = useRouter();
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [meetingPlatform, setMeetingPlatform] = useState('google_meet');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [ingestionMode, setIngestionMode] = useState<'demo' | 'live'>('demo');
  const [interviewDurationMinutes, setInterviewDurationMinutes] = useState(60);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName || !candidateEmail) {
      setError('Candidate Name and Email are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let photoUrl = '';

      // Upload photo if selected
      if (photo) {
        const formData = new FormData();
        formData.append('photo', photo);

        const uploadRes = await fetch(`${API_BASE_URL}/api/upload/reference-photo`, {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error('Reference photo upload failed');
        }

        const uploadData = await uploadRes.json();
        // The uploaded photo url returned is like /uploads/ref-123.jpg.
        // We prepend the base url so the client can query it directly.
        photoUrl = `${API_BASE_URL}${uploadData.url}`;
      }

      // Create session (live uses POST /join, demo uses POST /sessions)
      const endpoint = ingestionMode === 'live' ? '/api/sessions/join' : '/api/sessions';
      const sessionRes = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName,
          candidateEmail,
          candidatePhotoUrl: photoUrl,
          meetingUrl,
          meetingPlatform,
          ingestionMode,
        }),
      });

      const session = await sessionRes.json();
      if (!sessionRes.ok) {
        throw new Error(session.error || 'Failed to initialize session');
      }

      router.push(`/session/${session._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg p-3 text-xs leading-relaxed">
          {error}
        </div>
      )}

      {/* Input fields */}
      <div className="space-y-4">
        {/* Ingestion Mode */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Ingestion Mode
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className={`flex flex-col items-center justify-center p-3 border rounded-lg cursor-pointer transition-all ${ingestionMode === 'demo' ? 'bg-cyan-950/20 border-cyan-500/50 text-white shadow-lg shadow-cyan-950/20' : 'bg-slate-900/50 border-white/5 text-gray-400 hover:border-white/10'}`}>
              <input
                type="radio"
                name="ingestionMode"
                value="demo"
                checked={ingestionMode === 'demo'}
                onChange={() => setIngestionMode('demo')}
                className="sr-only"
              />
              <Sparkles className={`w-4 h-4 mb-1 ${ingestionMode === 'demo' ? 'text-cyan-400' : 'text-gray-500'}`} />
              <span className="text-xs font-semibold">Demo Mode</span>
              <span className="text-[9px] text-gray-500 mt-0.5">Manual Simulator</span>
            </label>

            <label className={`flex flex-col items-center justify-center p-3 border rounded-lg cursor-pointer transition-all ${ingestionMode === 'live' ? 'bg-cyan-950/20 border-cyan-500/50 text-white shadow-lg shadow-cyan-950/20' : 'bg-slate-900/50 border-white/5 text-gray-400 hover:border-white/10'}`}>
              <input
                type="radio"
                name="ingestionMode"
                value="live"
                checked={ingestionMode === 'live'}
                onChange={() => setIngestionMode('live')}
                className="sr-only"
              />
              <Video className={`w-4 h-4 mb-1 ${ingestionMode === 'live' ? 'text-cyan-400' : 'text-gray-500'}`} />
              <span className="text-xs font-semibold">Live Meeting</span>
              <span className="text-[9px] text-gray-500 mt-0.5">Recall.ai Bot</span>
            </label>
          </div>
        </div>

        {/* Interview Duration */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Interview Duration (minutes)
          </label>
          <input
            type="number"
            min={5}
            max={480}
            value={interviewDurationMinutes}
            onChange={(e) => setInterviewDurationMinutes(Number(e.target.value))}
            className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
          />
          <p className="text-[10px] text-gray-500 mt-1">
            Used by the candidate monitor page for the interview countdown timer.
          </p>
        </div>

        {/* Candidate Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Candidate Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
            <input
              type="text"
              required
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full bg-slate-900 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>

        {/* Candidate Email */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Candidate Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
            <input
              type="email"
              required
              value={candidateEmail}
              onChange={(e) => setCandidateEmail(e.target.value)}
              placeholder="e.g. rahul@company.com"
              className="w-full bg-slate-900 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>

        {/* Platform & Meeting URL */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Platform
            </label>
            <select
              value={meetingPlatform}
              onChange={(e) => setMeetingPlatform(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
            >
              <option value="google_meet">Google Meet</option>
              <option value="zoom">Zoom</option>
              <option value="teams">MS Teams</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Meeting URL
            </label>
            <div className="relative">
              <Video className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
              <input
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="e.g. https://meet.google.com/abc-defg-hij"
                className="w-full bg-slate-900 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Reference Photo Upload */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Reference Photo
          </label>
          <div className="flex items-center space-x-4">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Preview"
                className="w-14 h-14 object-cover rounded-lg border border-cyan-500/30"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-slate-900 border border-dashed border-white/10 flex items-center justify-center text-gray-600">
                <ImageIcon className="w-6 h-6" />
              </div>
            )}
            <div className="flex-grow">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
                id="ref-photo-file"
              />
              <label
                htmlFor="ref-photo-file"
                className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-200 cursor-pointer font-medium transition-colors"
              >
                <span>Choose Image</span>
              </label>
              <p className="text-[10px] text-gray-500 mt-1">PNG, JPG, or WEBP up to 5MB. Biometric verification reference.</p>
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center space-x-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors cursor-pointer shadow-lg shadow-cyan-900/20"
      >
        <span>{loading ? 'Initializing...' : 'Initialize Sherlock Session'}</span>
        {!loading && <ArrowRight className="w-4 h-4" />}
      </button>
    </form>
  );
}
