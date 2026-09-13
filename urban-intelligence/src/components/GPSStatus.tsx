import { MapPin, Signal, AlertTriangle, CheckCircle } from 'lucide-react';
import type { GPSPosition } from '../types';
import { classNames } from '../utils/helpers';

interface GPSStatusProps {
  position: GPSPosition | null;
  isWatching: boolean;
  error: string | null;
  isDemo: boolean;
  onRequestPermission: () => void;
  onToggleDemo: () => void;
}

export function GPSStatus({ 
  position, 
  isWatching, 
  error, 
  isDemo,
  onRequestPermission,
  onToggleDemo
}: GPSStatusProps) {
  const status = isDemo ? 'DEMO' : isWatching ? 'LIVE' : 'OFFLINE';
  const statusColor = isDemo ? 'text-amber-400' : isWatching ? 'text-emerald-400' : 'text-rose-400';
  const statusBg = isDemo ? 'bg-amber-500/10 border-amber-500/30' : 
                   isWatching ? 'bg-emerald-500/10 border-emerald-500/30' : 
                   'bg-rose-500/10 border-rose-500/30';

  return (
    <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-cyan-400" />
          <span className="font-medium text-white">GPS STATUS</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium ${statusBg} ${statusColor}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isDemo ? 'bg-amber-400 animate-blink' : isWatching ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
          {status}
        </div>
      </div>

      {error && !isDemo && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button 
            onClick={onRequestPermission}
            className="ml-auto px-2 py-1 text-xs bg-rose-500/20 border border-rose-500/30 rounded hover:bg-rose-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {position && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-navy-900/50 rounded p-3 border border-navy-600/50">
              <div className="text-xs text-navy-400 uppercase tracking-wider">LATITUDE</div>
              <div className="font-mono text-white text-lg tabular-nums">{position.latitude.toFixed(6)}</div>
            </div>
            <div className="bg-navy-900/50 rounded p-3 border border-navy-600/50">
              <div className="text-xs text-navy-400 uppercase tracking-wider">LONGITUDE</div>
              <div className="font-mono text-white text-lg tabular-nums">{position.longitude.toFixed(6)}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-navy-900/50 rounded p-3 border border-navy-600/50">
              <div className="text-xs text-navy-400 uppercase tracking-wider">ACCURACY</div>
              <div className="font-mono text-white text-lg tabular-nums">±{Math.round(position.accuracy ?? 0)}m</div>
            </div>
            <div className="bg-navy-900/50 rounded p-3 border border-navy-600/50">
              <div className="text-xs text-navy-400 uppercase tracking-wider">SOURCE</div>
              <div className={`font-mono text-sm ${position.isReal ? 'text-emerald-400' : 'text-amber-400'}`}>
                {position.isReal ? 'GPS SENSOR' : 'DEMO MODE'}
              </div>
            </div>
          </div>
        </div>
      )}

      {!position && !isWatching && !isDemo && (
        <div className="text-center py-4">
          <Signal className="w-12 h-12 text-navy-500 mx-auto mb-2" />
          <p className="text-navy-400 text-sm mb-4">GPS not initialized</p>
          <button 
            onClick={onRequestPermission}
            className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded hover:bg-cyan-500/30 transition-colors text-sm font-medium"
          >
            Enable GPS
          </button>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-navy-600/50 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-navy-300 cursor-pointer">
          <input
            type="checkbox"
            checked={isDemo}
            onChange={onToggleDemo}
            className="w-4 h-4 accent-cyan-500 rounded border-navy-600 bg-navy-900"
          />
          <span>Demo GPS (Delhi)</span>
        </label>
        {isDemo && (
          <span className="text-xs text-amber-400/80 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Using fallback coordinates
          </span>
        )}
      </div>
    </div>
  );
}