import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import { Sparkles, Eye, Info } from 'lucide-react';
import { Card } from './ui/card';

export function ExplainabilityPanel() {
  const predictions = useSessionStore((state) => state.predictions);
  const explanation = useSessionStore((state) => state.explanation);

  const topCandidate = predictions.length > 0 ? predictions[0] : null;

  if (!topCandidate) {
    return (
      <Card className="bg-black border-zinc-800 rounded-[3px] p-6 flex flex-col items-center justify-center text-center h-[280px] shadow-none">
        <Sparkles className="w-6 h-6 text-zinc-600 mb-2" />
        <p className="text-xs text-zinc-500 font-mono uppercase">WAITING FOR EXPLAINABILITY DATA...</p>
      </Card>
    );
  }

  // Convert evidence breakdown to sorted list
  const breakdown = Object.entries(topCandidate.evidenceBreakdown)
    .map(([type, entry]) => ({
      type,
      ...entry,
    }))
    .filter((e) => e.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution);

  return (
    <Card className="bg-black border-zinc-800 rounded-[3px] p-4 flex flex-col h-[280px] overflow-hidden shadow-none">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-white mb-3 font-mono">
        Explanation & Evidence
      </h3>

      {/* Prose Explanation block */}
      <div className="bg-zinc-950/80 border border-zinc-800 rounded-[2px] p-3 mb-4 flex items-start space-x-2.5 flex-shrink-0">
        <Eye className="w-3.5 h-3.5 text-zinc-400 mt-0.5 flex-shrink-0" />
        <div className="text-[10px] text-zinc-300 leading-relaxed font-mono uppercase">
          {explanation}
        </div>
      </div>

      {/* Signal Contribution Breakdown list */}
      <div className="flex-grow overflow-y-auto space-y-2 pr-1 font-mono text-[10px]">
        {breakdown.map((item) => {
          const percentage = Math.round(item.contribution * 100);
          const rawPercentage = Math.round(item.rawScore * 100);
          const weightPercentage = Math.round(item.weight * 100);
          const cleanName = item.type.replace(/_/g, ' ').toUpperCase();

          return (
            <div key={item.type} className="border-b border-zinc-900 pb-2 last:border-0 last:pb-0">
              <div className="flex items-center justify-between font-bold text-zinc-200 mb-1">
                <span>{cleanName}</span>
                <span className="text-white">+{percentage}%</span>
              </div>
              <div className="flex items-center justify-between text-[8px] text-zinc-500 mb-1 uppercase">
                <span>Score: {rawPercentage}% · Weight: {weightPercentage}%</span>
                <span className="italic truncate max-w-[180px] text-zinc-600">{item.reason.toUpperCase()}</span>
              </div>
              <div className="w-full bg-zinc-950 border border-zinc-900 rounded-[2px] h-1.5 overflow-hidden">
                <div 
                  className="bg-white h-full transition-all duration-500" 
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
        {breakdown.length === 0 && (
          <div className="text-[10px] text-zinc-500 flex items-center space-x-1.5 p-2 uppercase">
            <Info className="w-3.5 h-3.5" />
            <span>No active signals contributing to match score yet.</span>
          </div>
        )}
      </div>
    </Card>
  );
}
