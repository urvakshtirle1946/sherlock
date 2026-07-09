import React from 'react';
import { useSessionStore, HistoryDataPoint } from '../store/sessionStore';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { LineChart as ChartIcon, HelpCircle } from 'lucide-react';

export function ConfidenceGraph() {
  const history = useSessionStore((state) => state.history);
  const participants = useSessionStore((state) => state.participants);

  if (history.length === 0) {
    return (
      <div className="glass-panel p-6 flex flex-col items-center justify-center text-center h-[280px]">
        <HelpCircle className="w-8 h-8 text-gray-500 mb-2 pulse-glow" />
        <p className="text-sm text-gray-400">Waiting for confidence history ticks...</p>
      </div>
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

  // Palette of beautiful, modern contrast colors for lines
  const colors = [
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#8b5cf6', // Purple
    '#f43f5e', // Rose
    '#f59e0b', // Amber
    '#3b82f6', // Blue
  ];

  return (
    <div className="glass-panel p-4 flex flex-col h-[280px]">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center space-x-2">
        <ChartIcon className="w-4 h-4 text-cyan-400" />
        <span>Confidence Over Time</span>
      </h3>

      <div className="flex-grow w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
            />
            <YAxis
              stroke="#64748b"
              fontSize={10}
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '11px',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }}
              iconType="circle"
              iconSize={6}
            />
            {activeNames.map((name, idx) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={colors[idx % colors.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
