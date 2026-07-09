import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Sparkles, Video, Mail, User, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

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
        photoUrl = `${API_BASE_URL}${uploadData.url}`;
      }

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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="border border-zinc-800 bg-black text-zinc-400 rounded-[2px] p-3 text-[10px] uppercase font-mono leading-relaxed">
          [error] {error}
        </div>
      )}

      {/* Input fields */}
      <div className="space-y-4">
        {/* Ingestion Mode */}
        <div>
          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Ingestion Mode
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className={`flex flex-col items-center justify-center p-3 border rounded-[2px] cursor-pointer transition-all ${ingestionMode === 'demo' ? 'bg-zinc-950 border-white text-white' : 'bg-black border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>
              <input
                type="radio"
                name="ingestionMode"
                value="demo"
                checked={ingestionMode === 'demo'}
                onChange={() => setIngestionMode('demo')}
                className="sr-only"
              />
              <Sparkles className="w-3.5 h-3.5 mb-1" />
              <span className="text-[10px] font-semibold uppercase">Demo Mode</span>
              <span className="text-[8px] text-zinc-500 uppercase mt-0.5">Manual Simulator</span>
            </label>

            <label className={`flex flex-col items-center justify-center p-3 border rounded-[2px] cursor-pointer transition-all ${ingestionMode === 'live' ? 'bg-zinc-950 border-white text-white' : 'bg-black border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>
              <input
                type="radio"
                name="ingestionMode"
                value="live"
                checked={ingestionMode === 'live'}
                onChange={() => setIngestionMode('live')}
                className="sr-only"
              />
              <Video className="w-3.5 h-3.5 mb-1" />
              <span className="text-[10px] font-semibold uppercase">Live Meeting</span>
              <span className="text-[8px] text-zinc-500 uppercase mt-0.5">Recall.ai Bot</span>
            </label>
          </div>
        </div>

        {/* Interview Duration */}
        <div>
          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Interview Duration (minutes)
          </label>
          <Input
            type="number"
            min={5}
            max={480}
            value={interviewDurationMinutes}
            onChange={(e) => setInterviewDurationMinutes(Number(e.target.value))}
            className="h-8 text-xs bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-white rounded-[2px]"
          />
        </div>

        {/* Candidate Name */}
        <div>
          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Candidate Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-2 w-3.5 h-3.5 text-zinc-500" />
            <Input
              type="text"
              required
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="RAHUL SHARMA"
              className="h-8 pl-9 text-xs bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-white rounded-[2px] uppercase"
            />
          </div>
        </div>

        {/* Candidate Email */}
        <div>
          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Candidate Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-2 w-3.5 h-3.5 text-zinc-500" />
            <Input
              type="email"
              required
              value={candidateEmail}
              onChange={(e) => setCandidateEmail(e.target.value)}
              placeholder="RAHUL@COMPANY.COM"
              className="h-8 pl-9 text-xs bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-white rounded-[2px] uppercase"
            />
          </div>
        </div>

        {/* Platform & Meeting URL */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Platform
            </label>
            <select
              value={meetingPlatform}
              onChange={(e) => setMeetingPlatform(e.target.value)}
              className="h-8 w-full bg-black border border-zinc-800 text-xs text-white px-2 focus:outline-none focus:border-white rounded-[2px]"
            >
              <option value="google_meet">GOOGLE MEET</option>
              <option value="zoom">ZOOM</option>
              <option value="teams">MS TEAMS</option>
              <option value="other">OTHER</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Meeting URL
            </label>
            <div className="relative">
              <Video className="absolute left-3 top-2 w-3.5 h-3.5 text-zinc-500" />
              <Input
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="HTTPS://MEET.GOOGLE.COM/ABC-DEFG-HIJ"
                className="h-8 pl-9 text-xs bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-white rounded-[2px]"
              />
            </div>
          </div>
        </div>

        {/* Reference Photo Upload */}
        <div>
          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Reference Photo
          </label>
          <div className="flex items-center space-x-4">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Preview"
                className="w-10 h-10 object-cover rounded-[2px] border border-zinc-800"
              />
            ) : (
              <div className="w-10 h-10 rounded-[2px] bg-black border border-dashed border-zinc-800 flex items-center justify-center text-zinc-600">
                <ImageIcon className="w-4 h-4" />
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
                className="inline-flex items-center justify-center h-8 bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-200 cursor-pointer font-semibold uppercase px-4 rounded-[2px] hover:bg-zinc-900 transition-colors"
              >
                <span>CHOOSE IMAGE</span>
              </label>
              <p className="text-[8px] text-zinc-500 uppercase mt-1">PNG, JPG, or WEBP up to 5MB. Biometric verification reference.</p>
            </div>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        size="sm"
        className="w-full h-8 text-[10px] font-bold uppercase rounded-[2px] cursor-pointer"
      >
        <span>{loading ? 'INITIALIZING...' : 'INITIALIZE SHERLOCK SESSION'}</span>
        {!loading && <ArrowRight className="w-3.5 h-3.5 ml-1.5" />}
      </Button>
    </form>
  );
}
