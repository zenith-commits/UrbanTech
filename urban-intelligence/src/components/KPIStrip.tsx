import type { KPIMetrics } from '../types';
import { formatNumber } from '../utils/helpers';

interface KPIStripProps {
  metrics: KPIMetrics;
}

const KPI_ITEMS: { key: keyof KPIMetrics; label: string; icon: string; color: string }[] = [
  { key: 'activeBuses', label: 'ACTIVE BUSES', icon: '🚌', color: 'text-cyan-400' },
  { key: 'detectionsToday', label: 'DETECTIONS TODAY', icon: '🎯', color: 'text-blue-400' },
  { key: 'roadHazards', label: 'ROAD HAZARDS', icon: '⚠️', color: 'text-rose-400' },
  { key: 'activeAlerts', label: 'ACTIVE ALERTS', icon: '🚨', color: 'text-amber-400' },
  { key: 'avgConfidence', label: 'AVG CONFIDENCE', icon: '📊', color: 'text-emerald-400' },
];

export function KPIStrip({ metrics }: KPIStripProps) {
  return (
    <div className="bg-navy-800/50 border-b border-navy-600 px-6 py-3">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-7xl mx-auto px-2 lg:px-0">
        {KPI_ITEMS.map(({ key, label, icon, color }) => (
          <div key={key} className="flex items-center gap-3 p-3 bg-navy-900/50 border border-navy-600/50 rounded-lg transition-all hover:border-navy-500">
            <span className="text-2xl" aria-hidden>{icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-navy-400 uppercase tracking-wider font-medium">{label}</div>
              <div className={`font-mono text-lg font-bold tabular-nums ${color}`}>
                {key === 'avgConfidence' 
                  ? `${metrics[key].toFixed(1)}%`
                  : formatNumber(metrics[key] as number)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}