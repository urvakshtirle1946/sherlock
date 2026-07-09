import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import { Sparkles, Eye, Info } from 'lucide-react';

export function ExplainabilityPanel() {
  const predictions = useSessionStore((state) => state.predictions);
  const explanation = useSessionStore((state) => state.explanation);

  const topCandidate = predictions.length > 0 ? predictions[0] : null;

  if (!topCandidate) {
    return (
      <div className="glass-panel p-6 flex flex-col items-center justify-center text-center h-[280px]">
        <Sparkles className="w-8 h-8 text-gray-500 mb-2 pulse-glow" />
        <p className="text-sm text-gray-400">Waiting for explainability data...</p>
      </div>
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
    <div className="glass-panel p-4 flex flex-col h-[280px] overflow-hidden">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center space-x-2">
        <Sparkles className="w-4 h-4 text-cyan-400" />
        <span>Explanation & Evidence</span>
      </h3>

      {/* Prose Explanation block */}
      <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-3 mb-4 flex items-start space-x-2.5 flex-shrink-0">
        <Eye className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-cyan-100 leading-relaxed font-medium">
          {explanation}
        </div>
      </div>

      {/* Signal Contribution Breakdown list */}
      <div className="flex-grow overflow-y-auto space-y-2 pr-1">
        {breakdown.map((item) => {
          const percentage = Math.round(item.contribution * 100);
          const rawPercentage = Math.round(item.rawScore * 100);
          const weightPercentage = Math.round(item.weight * 100);
          const cleanName = item.type.replace(/_/g, ' ');

          return (
            <div key={item.type} className="text-xs border-b border-white/5 pb-2 last:border-0 last:pb-0">
              <div className="flex items-center justify-between font-semibold text-gray-200 mb-1">
                <span className="capitalize">{cleanName}</span>
                <span className="text-cyan-400 font-mono">+{percentage}%</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono mb-1">
                <span>Score: {rawPercentage}% × Weight: {weightPercentage}%</span>
                <span className="italic truncate max-w-[180px] text-gray-500">{item.reason}</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1">
                <div 
                  className="bg-cyan-400 h-1 rounded-full transition-all duration-500" 
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
        {breakdown.length === 0 && (
          <div className="text-xs text-gray-500 flex items-center space-x-1.5 p-2">
            <Info className="w-3.5 h-3.5" />
            <span>No active signals contributing to match score yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}
