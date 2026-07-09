import React from 'react';
import { Prediction } from '../store/sessionStore';
import { Trophy, AlertTriangle, HelpCircle } from 'lucide-react';

interface RankingListProps {
  predictions: Prediction[];
}

export function RankingList({ predictions }: RankingListProps) {
  if (predictions.length === 0) {
    return (
      <div className="glass-panel p-6 flex flex-col items-center justify-center text-center">
        <HelpCircle className="w-8 h-8 text-gray-500 mb-2 pulse-glow" />
        <p className="text-sm text-gray-400">Waiting for candidate predictions...</p>
      </div>
    );
  }

  const hasAmbiguity = predictions[0]?.ambiguous;

  return (
    <div className="glass-panel p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 flex items-center space-x-2">
          <Trophy className="w-4 h-4 text-cyan-400" />
          <span>Live Rankings</span>
        </h3>
        {hasAmbiguity && (
          <div className="flex items-center space-x-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
            <AlertTriangle className="w-3 h-3" />
            <span>Ambiguity Detected</span>
          </div>
        )}
      </div>

      <div className="space-y-2 flex-grow overflow-y-auto max-h-[300px]">
        {predictions.map((p, idx) => {
          const isTop = idx === 0;
          const isAmbiguous = isTop && p.ambiguous;
          
          let ringColor = 'border-white/5';
          let badgeBg = 'bg-gray-800 text-gray-400';
          let textColor = 'text-white';
          
          if (isTop) {
            if (isAmbiguous) {
              ringColor = 'border-amber-500/30';
              badgeBg = 'bg-amber-500/20 text-amber-400';
              textColor = 'text-amber-100';
            } else {
              ringColor = 'border-cyan-500/30';
              badgeBg = 'bg-cyan-500/20 text-cyan-400';
              textColor = 'text-cyan-100';
            }
          }

          return (
            <div
              key={p.participantId}
              className={`flex items-center justify-between p-3 rounded-lg border bg-slate-900/50 ${ringColor} transition-all duration-300`}
            >
              <div className="flex items-center space-x-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${badgeBg}`}>
                  {idx + 1}
                </span>
                <div>
                  <p className={`text-sm font-medium ${textColor} truncate max-w-[150px]`}>
                    {p.displayName}
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono">
                    ID: {p.participantId.slice(0, 8)}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-sm font-bold text-gray-200 font-mono">
                  {Math.round(p.confidenceScore * 100)}%
                </span>
                <p className="text-[9px] text-gray-400 uppercase tracking-wider">Match</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
