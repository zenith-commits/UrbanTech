import type { UrbanEvent } from '../types';
import { SEVERITY_COLORS, EVENT_TYPE_LABELS } from '../data/mockData';
import { formatRelativeTime, formatTime, classNames } from '../utils/helpers';

interface EventFeedProps {
  events: UrbanEvent[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  maxEvents?: number;
}

const SEVERITY_ICONS: Record<string, string> = {
  low: '🟢',
  medium: '🟠',
  high: '🔴',
  critical: '🔴',
};

export function EventFeed({ events, selectedEventId, onSelectEvent, maxEvents = 15 }: EventFeedProps) {
  const displayEvents = events.slice(0, maxEvents);

  if (displayEvents.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-10 bg-navy-800/30 border border-navy-600/50 rounded-lg">
        <div className="w-14 h-14 bg-navy-800 rounded-full flex items-center justify-center mb-3">
          <span className="text-2xl">📭</span>
        </div>
        <p className="text-navy-400 text-center">No events detected yet</p>
        <p className="text-navy-500 text-sm text-center mt-1">Start camera and enable demo simulation</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto max-h-[440px] space-y-2 pr-1">
      {displayEvents.map((event) => {
        const isSelected = event.id === selectedEventId;
        const severityConfig = SEVERITY_COLORS[event.severity] || SEVERITY_COLORS.low;
        const typeLabel = EVENT_TYPE_LABELS[event.type] || event.type;

        return (
          <button
            key={event.id}
            onClick={() => onSelectEvent(event.id)}
            className={classNames(
              'w-full text-left p-3 rounded-lg transition-all group',
              isSelected
                ? 'bg-cyan-500/10 border border-cyan-500/30'
                : 'bg-navy-800/50 border border-navy-600/50 hover:border-navy-500'
            )}
          >
            <div className="flex items-start gap-3">
              <div className={classNames('flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xl border', severityConfig.bg, severityConfig.border)}>
                {SEVERITY_ICONS[event.severity] || '⚪'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={classNames('font-mono text-xs font-bold uppercase', severityConfig.text)}>
                      {event.severity}
                    </span>
                    <span className="text-white font-medium text-sm">{typeLabel}</span>
                  </div>
                  <span className="font-mono text-xs text-navy-400 whitespace-nowrap">{formatTime(event.timestamp)}</span>
                </div>

                <div className="mt-1 flex items-center gap-3 text-xs text-navy-400 flex-wrap">
                  <span className="font-mono">{Math.round(event.confidence * 100)}%</span>
                  <span className="font-mono">{event.busId}</span>
                  <span className="text-navy-500">{formatRelativeTime(event.timestamp)}</span>
                </div>

                <div className="mt-2 text-xs text-white/70 truncate">
                  {event.subtype || event.type.replace('_', ' ')}
                </div>
              </div>

              {isSelected && (
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}