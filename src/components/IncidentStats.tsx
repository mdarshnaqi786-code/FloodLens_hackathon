
import React from 'react';
import { FloodIncident } from '../types';
import { AlertOctagon, CheckCircle2, Droplet, Waves } from 'lucide-react';

interface IncidentStatsProps {
  incidents: FloodIncident[];
}

export const IncidentStats: React.FC<IncidentStatsProps> = ({ incidents }) => {
  const total = incidents.length;

  const highSeverity = incidents.filter(
    (i) => i.severity === 'high'
  ).length;

  const corroborated = incidents.filter(
    (i) => (i.corroborationCount ?? 0) >= 1
  ).length;

  const corroboratedPct = total > 0
    ? Math.round((corroborated / total) * 100)
    : 0;

  const maxDepth = incidents.reduce(
    (max, i) => Math.max(max, Number(i.waterDepthCm) || 0),
    0
  );

  const avgTrust = total > 0
    ? Math.round(
        incidents.reduce(
          (sum, i) => sum + (Number(i.trustScore?.score) || 0),
          0
        ) / total
      )
    : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">
          Monsoon Incident Summary
        </span>
        <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
          Live Reports & Demo Data
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Active Inundations</span>
            <Waves className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {total}
            </span>
            <span className="text-[11px] text-slate-500">reported points</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-red-100 shadow-xs bg-gradient-to-br from-red-50/30 to-white">
          <div className="flex items-center justify-between text-red-600 mb-1">
            <span className="text-xs font-semibold">High Severity</span>
            <AlertOctagon className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-red-600 font-mono tabular-nums">
              {highSeverity}
            </span>
            <span className="text-[11px] text-red-500 font-medium">hazardous dips</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Corroborated Reports</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-teal-800 font-mono tabular-nums">
              {corroboratedPct}%
            </span>
            <span className="text-[11px] text-slate-500 font-mono tabular-nums">
              ({corroborated}/{total})
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Peak Water Depth</span>
            <Droplet className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {maxDepth}
            </span>
            <span className="text-xs text-slate-500 font-medium">cm recorded</span>
          </div>
        </div>
      </div>
    </div>
  );
};
