import { Video, VideoOff, RotateCcw, AlertTriangle } from 'lucide-react';

interface CameraStatusProps {
  isActive: boolean;
  isLoading: boolean;
  videoReady: boolean;
  error: string | null;
  facingMode: 'user' | 'environment';
  deviceLabel: string | null;
  onStart: () => void;
  onStop: () => void;
  onSwitch: () => void;
}

export function CameraStatus({
  isActive,
  isLoading,
  videoReady,
  error,
  facingMode,
  deviceLabel,
  onStart,
  onStop,
  onSwitch,
}: CameraStatusProps) {
  const live = isActive && videoReady;
  const statusText = isLoading
    ? 'CONNECTING...'
    : live
      ? 'CAMERA LIVE'
      : isActive
        ? 'WAITING FOR VIDEO'
        : 'CAMERA OFFLINE';

  const statusColor = isLoading
    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
    : live
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
      : isActive
        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
        : 'bg-rose-500/10 border-rose-500/30 text-rose-400';

  const dotColor = isLoading
    ? 'bg-amber-400 animate-blink'
    : live
      ? 'bg-emerald-400 animate-pulse'
      : isActive
        ? 'bg-cyan-400 animate-pulse'
        : 'bg-rose-400';

  return (
    <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-cyan-400" />
          <span className="font-medium text-white">CAMERA STATUS</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium ${statusColor}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          {statusText}
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
          {deviceLabel && (
            <div className="text-xs text-navy-400 font-mono truncate" title={deviceLabel}>
              {deviceLabel}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <span className="flex-1 text-navy-400">Facing Mode</span>
            <div className="flex rounded border border-navy-600 overflow-hidden">
              <button
                onClick={onSwitch}
                className={`px-3 py-1 text-xs font-mono ${
                  facingMode === 'user' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-navy-900 text-navy-400'
                }`}
              >
                FRONT
              </button>
              <button
                onClick={onSwitch}
                className={`px-3 py-1 text-xs font-mono ${
                  facingMode === 'environment' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-navy-900 text-navy-400'
                }`}
              >
                REAR
              </button>
            </div>
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