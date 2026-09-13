import { Satellite, Signal, Video, MapPin, Clock } from 'lucide-react';
import type { GPSPosition } from '../types';
import { formatTime } from '../utils/helpers';

interface HeaderProps {
  gpsPosition: GPSPosition | null;
  gpsStatus: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR';
  cameraStatus: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR';
  isDemoGPS: boolean;
}

export function Header({ 
  gpsPosition, 
  gpsStatus, 
  cameraStatus,
  isDemoGPS 
}: HeaderProps) {
  const now = Date.now();
  
  return (
    <header className="h-16 bg-navy-900 border-b border-navy-600 flex items-center justify-between px-6 relative z-10">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
          <Satellite className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="text-white font-bold text-lg tracking-tight">TEAM ROCKET</div>
          <div className="text-cyan-400 text-xs font-medium tracking-wider uppercase">URBAN INTELLIGENCE</div>
        </div>
      </div>
      
      <div className="flex flex-col items-center">
        <div className="text-white font-bold text-xl tracking-tight">LIVE URBAN INTELLIGENCE</div>
        <div className="text-cyan-400/70 text-xs tracking-wider">AI-powered mobile sensing network for safer, smarter cities</div>
      </div>
      
      <div className="flex items-center gap-6 text-right">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${cameraStatus === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span className="font-mono text-white">{cameraStatus === 'CONNECTED' ? 'CAMERA LIVE' : 'CAMERA OFFLINE'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${gpsStatus === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : gpsStatus === 'CONNECTING' ? 'bg-amber-400 animate-blink' : 'bg-rose-400'}`} />
            <span className="font-mono text-white">
              {isDemoGPS ? 'DEMO GPS' : gpsStatus === 'CONNECTED' ? 'GPS LIVE' : 'GPS OFFLINE'}
            </span>
          </div>
        </div>
        
        {gpsPosition && (
          <div className="font-mono text-xs text-cyan-400/80 hidden sm:block">
            LAT {gpsPosition.latitude.toFixed(6)} | LON {gpsPosition.longitude.toFixed(6)} | ±{Math.round(gpsPosition.accuracy ?? 0)}m
          </div>
        )}
        
        <div className="flex items-center gap-2 text-white font-mono">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span className="tabular-nums">{formatTime(now)}</span>
        </div>
        
        <div className="w-px h-8 bg-navy-600" />
        
        <div className="flex items-center gap-2 px-3 py-1.5 bg-navy-800/50 border border-navy-600 rounded">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white font-medium text-sm">SYSTEM ONLINE</span>
        </div>
      </div>
    </header>
  );
}