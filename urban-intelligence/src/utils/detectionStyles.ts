import type { DetectionClass } from '../types';

interface DetectionStyle {
  box: string;
  label: string;
}

// Broad color map for classes the local model can output; falls back to cyan.
const STYLES: Record<string, DetectionStyle> = {
  person: { box: 'border-cyan-400', label: 'text-cyan-300' },
  bicycle: { box: 'border-green-400', label: 'text-green-300' },
  car: { box: 'border-blue-400', label: 'text-blue-300' },
  motorcycle: { box: 'border-purple-400', label: 'text-purple-300' },
  bus: { box: 'border-indigo-400', label: 'text-indigo-300' },
  truck: { box: 'border-fuchsia-400', label: 'text-fuchsia-300' },
  'traffic light': { box: 'border-amber-400', label: 'text-amber-300' },
  'stop sign': { box: 'border-rose-400', label: 'text-rose-300' },
  train: { box: 'border-indigo-400', label: 'text-indigo-300' },
  pothole: { box: 'border-rose-400', label: 'text-rose-300' },
  road_damage: { box: 'border-rose-400', label: 'text-rose-300' },
  waterlogging: { box: 'border-blue-400', label: 'text-blue-300' },
  damaged_sign: { box: 'border-amber-400', label: 'text-amber-300' },
  missing_divider: { box: 'border-amber-400', label: 'text-amber-300' },
  zebra_crossing: { box: 'border-green-400', label: 'text-green-300' },
};

function normalize(className: string): string {
  return className.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
}

export function detectionStyleFor(className: string): DetectionStyle {
  return STYLES[normalize(className)] ?? { box: 'border-cyan-400', label: 'text-cyan-300' };
}

// Color per canonical DetectionClass (used outside the canvas overlay as well).
export const DETECTION_CLASS_HEX: Record<DetectionClass, string> = {
  person: '#22d3ee',
  car: '#60a5fa',
  bus: '#818cf8',
  motorcycle: '#c084fc',
  bicycle: '#4ade80',
  pothole: '#fb7185',
  road_damage: '#fb7185',
  waterlogging: '#60a5fa',
  damaged_sign: '#fbbf24',
  missing_divider: '#fbbf24',
  zebra_crossing: '#4ade80',
};