import { Bus, Radio, Circle } from 'lucide-react';
import type { Bus as BusType } from '../types';
import { classNames } from '../utils/helpers';

interface FleetPanelProps {
  buses: BusType[];
  activeBusId: string;
  onSelectBus: (busId: string) => void;
}

function getStatusConfig(status: BusType['status']) {
  switch (status) {
    case 'LIVE':
      return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400 animate-pulse' };
    case 'IDLE':
      return { color: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400 animate-blink' };
    default:
      return { color: 'text-rose-400', bg: 'bg-rose-500/10', dot: 'bg-rose-400' };
  }
}

function getGPSConfig(gpsStatus: BusType['gpsStatus']) {
  switch (gpsStatus) {
    case 'LOCKED':
      return { color: 'text-emerald-400', label: 'GPS LOCKED' };
    case 'SEARCHING':
      return { color: 'text-amber-400', label: 'GPS SEARCHING' };
    default:
      return { color: 'text-rose-400', label: 'GPS OFF' };
  }
}

export function FleetPanel({ buses, activeBusId, onSelectBus }: FleetPanelProps) {
  return (
    <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bus className="w-5 h-5 text-cyan-400" />
          <span className="font-medium text-white">FLEET STATUS</span>
        </div>
        <span className="text-xs text-navy-400 font-mono">{buses.length} BUSES</span>
      </div>
      
      <div className="space-y-3">
        {buses.map((bus) => {
          const isActive = bus.id === activeBusId;
          const statusConfig = getStatusConfig(bus.status);
          const gpsConfig = getGPSConfig(bus.gpsStatus);
          
          return (
            <button
              key={bus.id}
              onClick={() => onSelectBus(bus.id)}
              className={`w-full text-left p-3 rounded-lg transition-all ${
                isActive 
                  ? 'bg-cyan-500/10 border border-cyan-500/30' 
                  : 'bg-navy-900/50 border border-navy-600/50 hover:border-navy-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isActive ? 'bg-cyan-500/20' : 'bg-navy-800'
                  }`}>
                    <Radio className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-navy-500'}`} />
                  </div>
                  <div>
                    <div className="font-mono font-bold text-white">{bus.label}</div>
                    <div className="text-xs text-navy-400">{bus.eventsCount} events today</div>
                  </div>
                </div>
                {isActive && (
                  <span className="px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-mono rounded">
                    ACTIVE
                  </span>
                )}
              </div>
              
              <div className="mt-3 flex items-center gap-4 text-xs">
                <span className={`flex items-center gap-1 ${statusConfig.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                  {bus.status}
                </span>
                <span className={`flex items-center gap-1 ${gpsConfig.color}`}>
                  {gpsConfig.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}