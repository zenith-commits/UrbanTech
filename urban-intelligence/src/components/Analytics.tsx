import type { AnalyticsData } from '../types';
import { DETECTION_CLASSES, DETECTION_CLASS_COLORS } from '../data/mockData';
import { formatNumber } from '../utils/helpers';

interface AnalyticsProps {
  data: AnalyticsData;
}

const DETECTION_CLASS_FILL: Record<string, string> = {
  person: 'bg-cyan-400',
  car: 'bg-blue-400',
  bus: 'bg-indigo-400',
  motorcycle: 'bg-purple-400',
  bicycle: 'bg-green-400',
  pothole: 'bg-rose-400',
  road_damage: 'bg-rose-400',
  waterlogging: 'bg-blue-400',
  damaged_sign: 'bg-amber-400',
  missing_divider: 'bg-amber-400',
  zebra_crossing: 'bg-green-400',
};

const ROAD_DOT_COLOR: Record<string, string> = {
  Critical: 'bg-rose-500',
  High: 'bg-amber-500',
  Moderate: 'bg-blue-500',
  Clear: 'bg-emerald-500',
};

export function Analytics({ data }: AnalyticsProps) {
  const totalDetections = Object.values(data.detectionsByType).reduce((a, b) => a + b, 0);
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Detections by Type */}
      <div className="lg:col-span-2 bg-navy-800/50 border border-navy-600 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-medium text-white">DETECTIONS BY TYPE</span>
          <span className="text-xs text-navy-400 font-mono">TOTAL: {formatNumber(totalDetections)}</span>
        </div>
        
        <div className="space-y-3">
          {DETECTION_CLASSES.map((className) => {
            const count = data.detectionsByType[className] || 0;
            const percentage = totalDetections > 0 ? (count / totalDetections) * 100 : 0;
            const colorClass = DETECTION_CLASS_COLORS[className];
            
            return (
              <div key={className} className="group">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className={`font-medium ${colorClass}`}>{className}</span>
                  <span className="font-mono text-white">{formatNumber(count)}</span>
                </div>
                <div className="h-2 bg-navy-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${DETECTION_CLASS_FILL[className] || 'bg-navy-500'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Trend */}
      <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-medium text-white">EVENT TREND</span>
          <span className="text-xs text-navy-400">24H</span>
        </div>
        
        <div className="h-48 relative">
          <svg className="w-full h-full" viewBox="0 0 300 150" preserveAspectRatio="none">
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
              </linearGradient>
            </defs>
            
            {/* Grid lines */}
            <g stroke="#1a2332" strokeWidth="0.5">
              {[20, 50, 80, 110, 140].map(y => (
                <line key={y} x1="30" y1={y} x2="280" y2={y} />
              ))}
            </g>
            
            {/* Area */}
            <path
              d={generateTrendPath(data.eventsOverTime)}
              fill="url(#trendGradient)"
            />
            
            {/* Line */}
            <path
              d={generateTrendPath(data.eventsOverTime)}
              stroke="#22d3ee"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Points */}
            {data.eventsOverTime.map((point, i) => (
              <circle
                key={i}
                cx={30 + (i / (data.eventsOverTime.length - 1)) * 250}
                cy={140 - (point.count / Math.max(...data.eventsOverTime.map(p => p.count), 1)) * 120}
                r="3"
                fill="#22d3ee"
                className="hover:r-4 transition-r"
              />
            ))}
          </svg>
        </div>
      </div>

      {/* Road Condition */}
      <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-5">
        <span className="font-medium text-white">ROAD CONDITION</span>
        <div className="mt-4 space-y-3">
          {Object.entries(data.roadConditions).map(([condition, count]) => {
            const colors: Record<string, { bg: string; text: string; border: string }> = {
              Critical: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30' },
              High: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
              Moderate: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
              Clear: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
            };
            const color = colors[condition] || colors.Moderate;
            
            return (
              <div key={condition} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded ${ROAD_DOT_COLOR[condition] || 'bg-navy-500'}`} />
                  <span className={`text-sm font-medium ${color.text}`}>{condition.toUpperCase()}</span>
                </div>
                <span className="font-mono text-white text-lg">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Congestion */}
      <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-5">
        <span className="font-medium text-white">CONGESTION LEVEL</span>
        <div className="mt-6">
          <div className="h-4 bg-navy-900 rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400 transition-all duration-500"
              style={{ width: `${data.congestionLevel * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-emerald-400">CLEAR</span>
            <span className="font-mono text-white text-xl">{Math.round(data.congestionLevel * 100)}%</span>
            <span className="text-rose-400">SEVERE</span>
          </div>
          <div className="mt-4 text-xs text-navy-400">
            Active route congestion index based on vehicle density and speed analysis
          </div>
        </div>
      </div>
    </div>
  );
}

function generateTrendPath(events: { time: string; count: number }[]): string {
  if (events.length === 0) return '';
  
  const maxCount = Math.max(...events.map(e => e.count), 1);
  const width = 250;
  const height = 120;
  const leftPad = 30;
  const bottomPad = 20;
  
  let path = `M ${leftPad} ${bottomPad + height}`;
  
  events.forEach((event, i) => {
    const x = leftPad + (i / (events.length - 1)) * width;
    const y = bottomPad + height - (event.count / maxCount) * height;
    
    if (i === 0) {
      path += ` L ${x} ${y}`;
    } else {
      const prevX = leftPad + ((i - 1) / (events.length - 1)) * width;
      const cpX = (prevX + x) / 2;
      path += ` Q ${cpX} ${y} ${x} ${y}`;
    }
  });
  
  path += ` L ${leftPad + width} ${bottomPad + height} Z`;
  return path;
}