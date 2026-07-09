import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { HelpCircle } from 'lucide-react';
import { Card } from './ui/card';

export function ConfidenceGraph() {
  const history = useSessionStore((state) => state.history);
  const participants = useSessionStore((state) => state.participants);
  const predictions = useSessionStore((state) => state.predictions);

  if (history.length === 0) {
    return (
      <Card className="bg-black border-zinc-800 rounded-[3px] p-6 flex flex-col items-center justify-center text-center h-[280px] shadow-none">
        <HelpCircle className="w-6 h-6 text-zinc-600 mb-2" />
        <p className="text-xs text-zinc-500 font-mono uppercase">WAITING FOR HISTORY TICKS...</p>
      </Card>
    );
  }

  // Get active participant display names to generate chart lines
  const activeNames = Array.from(
    new Set(
      participants
        .filter((p) => !p.leftAt)
        .map((p) => p.displayName)
    )
  );

  // Stark monochrome colors: Leading candidate is solid white, other speakers are shades of gray
  const topCandidateName = predictions.length > 0 ? predictions[0].displayName : '';

  return (
    <Card className="bg-black border-zinc-800 rounded-[3px] p-4 flex flex-col h-[280px] shadow-none">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-white mb-4 font-mono">
        Confidence Over Time
      </h3>

      <div className="flex-grow w-full text-[10px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
            <XAxis
              dataKey="time"
              stroke="#52525b"
              fontSize={9}
              tickLine={false}
              fontFamily="monospace"
            />
            <YAxis
              stroke="#52525b"
              fontSize={9}
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              fontFamily="monospace"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#09090b',
                border: '1px solid #27272a',
                borderRadius: '3px',
                color: '#fafafa',
                fontSize: '10px',
                fontFamily: 'monospace',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '9px', paddingTop: '5px', fontFamily: 'monospace' }}
              iconType="square"
              iconSize={6}
            />
            {activeNames.map((name, idx) => {
              const isTopCandidate = name === topCandidateName;
              // Leading speaker is white; others are muted zinc shades
              const strokeColor = isTopCandidate 
                ? '#ffffff' 
                : idx % 2 === 0 ? '#52525b' : '#3f3f46';
              const strokeDash = isTopCandidate ? undefined : '3 3';
              const strokeW = isTopCandidate ? 2 : 1.2;

              return (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  strokeDasharray={strokeDash}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0, fill: strokeColor }}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
