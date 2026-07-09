import React from 'react';
import { Prediction } from '../store/sessionStore';
import { HelpCircle, AlertTriangle } from 'lucide-react';
import { Card } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';

interface RankingListProps {
  predictions: Prediction[];
}

export function RankingList({ predictions }: RankingListProps) {
  if (predictions.length === 0) {
    return (
      <Card className="bg-black border-zinc-800 rounded-[3px] p-6 flex flex-col items-center justify-center text-center shadow-none">
        <HelpCircle className="w-6 h-6 text-zinc-600 mb-2" />
        <p className="text-xs text-zinc-500 font-mono uppercase">WAITING FOR PREDICTIONS...</p>
      </Card>
    );
  }

  const hasAmbiguity = predictions[0]?.ambiguous;

  return (
    <Card className="bg-black border-zinc-800 rounded-[3px] p-4 flex flex-col h-full shadow-none">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white font-mono">
          Live Rankings
        </h3>
        {hasAmbiguity && (
          <Badge variant="outline" className="text-[8px] py-0 px-1 bg-transparent text-amber-500 border-amber-500/30 uppercase rounded-[2px] font-mono">
            <AlertTriangle className="w-2.5 h-2.5 mr-1" />
            <span>AMBIGUITY DETECTED</span>
          </Badge>
        )}
      </div>

      <div className="flex-grow overflow-y-auto max-h-[300px]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-zinc-900">
              <TableHead className="w-12 text-[9px] uppercase tracking-wider font-semibold text-zinc-500 p-2">Rank</TableHead>
              <TableHead className="text-[9px] uppercase tracking-wider font-semibold text-zinc-500 p-2">Participant</TableHead>
              <TableHead className="text-right text-[9px] uppercase tracking-wider font-semibold text-zinc-500 p-2">Match</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {predictions.map((p, idx) => {
              const isTop = idx === 0;
              const isAmbiguous = isTop && p.ambiguous;
              
              let rankText = isTop ? (isAmbiguous ? 'text-amber-500' : 'text-white') : 'text-zinc-500';
              let rowBg = isTop ? 'bg-zinc-950/50' : 'hover:bg-zinc-950/20';

              return (
                <TableRow key={p.participantId} className={`${rowBg} border-zinc-900`}>
                  <TableCell className={`p-2 text-xs font-bold font-mono ${rankText}`}>
                    #{idx + 1}
                  </TableCell>
                  <TableCell className="p-2">
                    <div>
                      <p className={`text-xs font-bold ${isTop ? 'text-white' : 'text-zinc-400'} uppercase font-mono truncate max-w-[120px]`}>
                        {p.displayName}
                      </p>
                      <p className="text-[8px] text-zinc-600 font-mono uppercase">
                        ID: {p.participantId.slice(0, 8)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="p-2 text-right font-mono text-xs font-bold text-white">
                    {Math.round(p.confidenceScore * 100)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
