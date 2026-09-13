import type { UrbanEvent } from '../types';
import { SEVERITY_COLORS, EVENT_TYPE_LABELS } from '../data/mockData';
import { formatTime, formatCoordinate } from '../utils/helpers';
import { CheckCircle, AlertTriangle, MapPin, Clock, Bus as BusIcon, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface EventDetailsProps {
  event: UrbanEvent | null;
  onVerify: (eventId: string) => void;
  onCreateMaintenanceAlert: (eventId: string) => void;
  onClose: () => void;
}

export function EventDetails({ event, onVerify, onCreateMaintenanceAlert, onClose }: EventDetailsProps) {
  const [maintenanceFlash, setMaintenanceFlash] = useState(false);

  useEffect(() => {
    setMaintenanceFlash(false);
  }, [event?.id]);

  if (!event) return null;

  const severityConfig = SEVERITY_COLORS[event.severity] || SEVERITY_COLORS.low;
  const isVerified = event.status === 'VERIFIED';
  const isResolved = event.status === 'RESOLVED';
  const hasMaintenance = Boolean(event.maintenanceAlertId) || maintenanceFlash;
  const typeLabel = EVENT_TYPE_LABELS[event.type] || event.type;

  const handleCreateAlert = () => {
    onCreateMaintenanceAlert(event.id);
    setMaintenanceFlash(true);
    setTimeout(() => setMaintenanceFlash(false), 2500);
  };

  return (
    <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-5 animate-slide-up">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-lg font-bold text-white">EVENT DETAILS</span>
            <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${severityConfig.bg} ${severityConfig.text} border ${severityConfig.border}`}>
              {event.severity.toUpperCase()}
            </span>
          </div>
          <div className="text-white text-xl font-medium">{typeLabel}</div>
          <div className="text-navy-400 text-sm mt-0.5 capitalize">{event.subtype || event.type.replace('_', ' ')}</div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-navy-400 hover:text-white hover:bg-navy-700 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-navy-900/50 border border-navy-600/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-xs text-navy-400 mb-1">
            <MapPin className="w-3 h-3" />
            LOCATION
          </div>
          <div className="font-mono text-white text-sm space-y-1">
            <div>LAT: {formatCoordinate(event.position.latitude)}</div>
            <div>LON: {formatCoordinate(event.position.longitude)}</div>
          </div>
        </div>

        <div className="bg-navy-900/50 border border-navy-600/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-xs text-navy-400 mb-1">
            <Clock className="w-3 h-3" />
            TIMESTAMP
          </div>
          <div className="font-mono text-white text-sm">{formatTime(event.timestamp)}</div>
        </div>

        <div className="bg-navy-900/50 border border-navy-600/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-xs text-navy-400 mb-1">
            <BusIcon className="w-3 h-3" />
            VEHICLE
          </div>
          <div className="font-mono text-white text-lg">{event.busId}</div>
        </div>

        <div className="bg-navy-900/50 border border-navy-600/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-xs text-navy-400 mb-1">
            <AlertTriangle className="w-3 h-3" />
            CONFIDENCE
          </div>
          <div className="font-mono text-white text-2xl font-bold">{Math.round(event.confidence * 100)}%</div>
        </div>
      </div>

      <div className="bg-navy-900/50 border border-navy-600/50 rounded-lg p-4 mb-5">
        <div className="flex items-center gap-2 text-xs text-navy-400 mb-2">
          <CheckCircle className="w-3 h-3" />
          STATUS
        </div>
        <span className={`px-3 py-1.5 rounded font-mono text-sm font-medium ${severityConfig.bg} ${severityConfig.text} border ${severityConfig.border}`}>
          {event.status}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {!isVerified && !isResolved ? (
          <button
            onClick={() => onVerify(event.id)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors font-medium"
          >
            <CheckCircle className="w-5 h-5" />
            VERIFY EVENT
          </button>
        ) : (
          <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded font-medium">
            <CheckCircle className="w-5 h-5" />
            {isResolved ? 'RESOLVED' : 'VERIFIED'}
          </div>
        )}

        <button
          onClick={handleCreateAlert}
          disabled={hasMaintenance}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded transition-colors font-medium ${
            hasMaintenance
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              : 'bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30'
          }`}
        >
          {hasMaintenance ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {hasMaintenance ? 'MAINTENANCE ALERT CREATED' : 'CREATE MAINTENANCE ALERT'}
        </button>
      </div>
    </div>
  );
}