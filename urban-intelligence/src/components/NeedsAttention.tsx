import type { Alert, EventSeverity } from '../types';
import { SEVERITY_COLORS, EVENT_TYPE_LABELS } from '../data/mockData';
import { formatRelativeTime } from '../utils/helpers';
import { classNames } from '../utils/helpers';

interface NeedsAttentionProps {
  alerts: Alert[];
  onSelectAlert: (alert: Alert) => void;
  onDismiss: (alertId: string) => void;
  maxAlerts?: number;
}

const SEVERITY_ICONS: Record<EventSeverity, string> = {
  low: '🟢',
  medium: '🟠',
  high: '🔴',
  critical: '🔴',
};

export function NeedsAttention({ alerts, onSelectAlert, onDismiss, maxAlerts = 5 }: NeedsAttentionProps) {
  const activeAlerts = alerts.filter(a => !a.acknowledged).slice(0, maxAlerts);
  
  if (activeAlerts.length === 0) {
    return (
      <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-6 text-center">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✅</span>
        </div>
        <p className="text-emerald-400 font-medium">NO ACTIVE ALERTS</p>
        <p className="text-navy-400 text-sm mt-1">All systems operating normally</p>
      </div>
    );
  }

  return (
    <div className="bg-navy-800/50 border border-rose-500/30 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-rose-500/10 border-b border-rose-500/30 flex items-center gap-2">
        <span className="text-rose-400 text-lg">🚨</span>
        <span className="font-bold text-rose-300">NEEDS ATTENTION</span>
        <span className="ml-auto px-2 py-0.5 bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-mono rounded">
          {activeAlerts.length} ACTIVE
        </span>
      </div>
      
      <div className="divide-y divide-rose-500/10">
        {activeAlerts.map((alert) => {
          const severityConfig = SEVERITY_COLORS[alert.severity];
          const timeAgo = formatRelativeTime(alert.timestamp);
          
          return (
            <div
              key={alert.id}
              onClick={() => onSelectAlert(alert)}
              className="w-full text-left p-4 hover:bg-navy-700/50 transition-colors flex items-start gap-3 group cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectAlert(alert); }}
            >
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl ${severityConfig.bg} border ${severityConfig.border}`}>
                {SEVERITY_ICONS[alert.severity]}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-mono text-xs font-bold ${severityConfig.text}`}>
                    {alert.severity}
                  </span>
                  <span className="font-mono text-xs text-navy-400 whitespace-nowrap">{timeAgo}</span>
                </div>
                
                <div className="mt-1 text-white font-medium text-sm">{EVENT_TYPE_LABELS[alert.type]}</div>
                <div className="mt-0.5 text-navy-400 text-sm">{alert.message}</div>
                <div className="mt-2 text-xs text-navy-400 font-mono">{formatRelativeTime(alert.timestamp)}</div>
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(alert.id);
                }}
                className="flex-shrink-0 p-1 text-navy-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}