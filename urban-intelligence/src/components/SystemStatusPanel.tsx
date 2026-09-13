import type { ComponentStatus, SystemStatus } from '../types';
import { 
  Video, 
  MapPin, 
  Cpu, 
  GitBranch, 
  Map, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2 
} from 'lucide-react';
import { classNames } from '../utils/helpers';

const COMPONENT_CONFIG: { key: keyof SystemStatus; label: string; icon: React.ReactNode }[] = [
  { key: 'camera', label: 'CAMERA', icon: <Video className="w-4 h-4" /> },
  { key: 'gps', label: 'GPS', icon: <MapPin className="w-4 h-4" /> },
  { key: 'aiEngine', label: 'AI ENGINE', icon: <Cpu className="w-4 h-4" /> },
  { key: 'eventPipeline', label: 'EVENT PIPELINE', icon: <GitBranch className="w-4 h-4" /> },
  { key: 'map', label: 'MAP', icon: <Map className="w-4 h-4" /> },
];

function getStatusConfig(status: ComponentStatus['status']) {
  switch (status) {
    case 'CONNECTED':
    case 'RUNNING':
    case 'ACTIVE':
    case 'ONLINE':
      return { 
        icon: <CheckCircle className="w-4 h-4" />, 
        color: 'text-emerald-400', 
        bg: 'bg-emerald-500/10 border-emerald-500/30',
        dotColor: 'bg-emerald-400',
        label: status
      };
    case 'CONNECTING':
      return { 
        icon: <Loader2 className="w-4 h-4 animate-spin" />, 
        color: 'text-amber-400', 
        bg: 'bg-amber-500/10 border-amber-500/30',
        dotColor: 'bg-amber-400 animate-blink',
        label: 'CONNECTING'
      };
    case 'ERROR':
      return { 
        icon: <AlertCircle className="w-4 h-4" />, 
        color: 'text-rose-400', 
        bg: 'bg-rose-500/10 border-rose-500/30',
        dotColor: 'bg-rose-400',
        label: 'ERROR'
      };
    default:
      return { 
        icon: <XCircle className="w-4 h-4" />, 
        color: 'text-rose-400', 
        bg: 'bg-rose-500/10 border-rose-500/30',
        dotColor: 'bg-rose-400',
        label: 'DISCONNECTED'
      };
  }
}

interface SystemStatusProps {
  status: SystemStatus;
}

export function SystemStatusPanel({ status }: SystemStatusProps) {
  return (
    <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-medium text-white">SYSTEM STATUS</span>
        <span className="text-xs text-navy-400">ALL SYSTEMS</span>
      </div>
      
      <div className="space-y-3">
        {COMPONENT_CONFIG.map(({ key, label, icon }) => {
          const component = status[key];
          const config = getStatusConfig(component.status);
          
          return (
            <div key={key} className="flex items-center gap-3 p-3 bg-navy-900/50 border border-navy-600/50 rounded-lg transition-all hover:border-navy-500">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.color} bg-navy-800`}>
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white text-sm">{label}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${config.bg} ${config.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1.5 ${config.dotColor}`} />
                    {config.label}
                  </span>
                </div>
                {component.details && (
                  <div className="text-xs text-navy-400 mt-0.5">{component.details}</div>
                )}
              </div>
              <div className={config.color}>
                {config.icon}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}