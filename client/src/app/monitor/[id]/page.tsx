'use client';

import { useParams } from 'next/navigation';
import { CandidateMonitor } from '../../../components/CandidateMonitor';

export default function MonitorPage() {
  const params = useParams();
  const sessionId = params?.id as string;
  return <CandidateMonitor sessionId={sessionId} />;
}
