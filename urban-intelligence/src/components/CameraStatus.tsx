import { Video, VideoOff, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';
import { classNames } from '../utils/helpers';

interface CameraStatusProps {
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  facingMode: 'user' | 'environment';
  onStart: () => void;
  onStop: () => void;
  onSwitch: () => void;
}

export function CameraStatus({ 
  isActive, 
  isLoading, 
  error, 
  facingMode,
  onStart, 
  onStop, 
  onSwitch 
}: CameraStatusProps) {
  return (
    <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-cyan-400" />
          <span className="font-medium text-white">CAMERA STATUS</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium ${
          isActive 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : isLoading 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : isLoading ? 'bg-amber-400 animate-blink' : 'bg-rose-400'}`} />
          {isLoading ? 'CONNECTING...' : isActive ? 'CAMERA LIVE' : 'CAMERA OFFLINE'}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!isActive && !isLoading && !error && (
        <div className="text-center py-4">
          <VideoOff className="w-12 h-12 text-navy-500 mx-auto mb-2" />
          <p className="text-navy-400 text-sm mb-4">Camera not started</p>
          <button 
            onClick={onStart}
            className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded hover:bg-cyan-500/30 transition-colors text-sm font-medium"
          >
            Start Camera
          </button>
        </div>
      )}

      {isActive && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex-1 text-navy-400">Facing Mode</span>
            <select
              value={facingMode}
              onChange={(e) => { /* handled by switch */ }}
              className="bg-navy-900 border border-navy-600 rounded px-2 py-1 text-white text-sm font-mono"
              disabled
            >
              <option value="environment">Environment (Rear)</option>
              <option value="user">User (Front)</option>
            </select>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={onSwitch}
              className="flex-1 px-3 py-2 bg-navy-700 border border-navy-600 rounded text-white text-sm font-medium hover:bg-navy-600 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Switch Camera
            </button>
            <button
              onClick={onStop}
              className="flex-1 px-3 py-2 bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded hover:bg-rose-500/30 transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              <VideoOff className="w-4 h-4" />
              Stop Camera
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-4">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-cyan-400 text-sm">Requesting camera access...</p>
        </div>
      )}
    </div>
  );
}