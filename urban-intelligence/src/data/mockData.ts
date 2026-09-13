import type { 
  Bus, 
  GPSPosition, 
  UrbanEvent, 
  Detection, 
  DetectionClass, 
  EventSeverity,
  KPIMetrics,
  AnalyticsData,
  SystemStatus,
  ComponentStatus 
} from '../types';

// Delhi coordinates for demo fallback
export const DELHI_CENTER: [number, number] = [28.6139, 77.2090];
export const DELHI_BOUNDS: [[number, number], [number, number]] = [
  [28.4, 76.8],
  [28.9, 77.6]
];

// Demo route for BUS-01 (a loop around central Delhi)
export const DEMO_ROUTE: [number, number][] = [
  [28.6139, 77.2090],
  [28.6200, 77.2150],
  [28.6250, 77.2200],
  [28.6300, 77.2150],
  [28.6250, 77.2100],
  [28.6139, 77.2090],
];

// Other bus positions (static for demo)
export const OTHER_BUSES: Omit<Bus, 'position' | 'route' | 'isActive'>[] = [
  { id: 'BUS-02', label: 'BUS-02', eventsCount: 8, status: 'LIVE' as const, gpsStatus: 'LOCKED' as const },
  { id: 'BUS-03', label: 'BUS-03', eventsCount: 0, status: 'IDLE' as const, gpsStatus: 'OFF' as const },
];

export const DETECTION_CLASSES: DetectionClass[] = [
  'person', 'car', 'bus', 'motorcycle', 'bicycle', 'pothole', 'road_damage', 'waterlogging'
];

export const EVENT_TYPES: { type: string; subtypes: string[]; severities: EventSeverity[] }[] = [
  { type: 'pothole', subtypes: ['Pothole detected', 'Crack detected', 'Debris on road', 'Manhole open'], severities: ['high', 'critical'] },
  { type: 'road_damage', subtypes: ['Traffic congestion', 'Vehicle queue forming', 'Intersection blocked'], severities: ['medium', 'high'] },
  { type: 'waterlogging', subtypes: ['Pedestrian crossing risk', 'Jaywalking detected', 'School zone violation'], severities: ['high', 'critical'] },
  { type: 'damaged_sign', subtypes: ['High vehicle density', 'Parking overflow'], severities: ['medium'] },
  { type: 'missing_divider', subtypes: ['Illegal parking detected', 'Bus lane violation'], severities: ['low', 'medium'] },
  { type: 'zebra_crossing', subtypes: ['Near-miss detected', 'Erratic driving'], severities: ['high', 'critical'] },
];

export function generateMockBuses(userPosition?: GPSPosition): Bus[] {
  const basePosition = userPosition || {
    latitude: DELHI_CENTER[0],
    longitude: DELHI_CENTER[1],
    accuracy: 10,
    timestamp: Date.now(),
    isReal: false,
  };

  return [
    {
      id: 'BUS-01',
      label: 'BUS-01',
      position: basePosition,
      isActive: true,
      route: DEMO_ROUTE,
      eventsCount: 12,
      status: 'LIVE',
      gpsStatus: 'LOCKED',
    },
    ...OTHER_BUSES.map((bus, i) => ({
      ...bus,
      position: {
        latitude: DELHI_CENTER[0] + (Math.random() - 0.5) * 0.05,
        longitude: DELHI_CENTER[1] + (Math.random() - 0.5) * 0.05,
        accuracy: 15,
        timestamp: Date.now(),
        isReal: false,
      },
      route: [],
      isActive: false,
    })),
  ];
}

export function generateMockDetections(count: number = 6): Detection[] {
  const detections: Detection[] = [];
  const classes = DETECTION_CLASSES;
  
  for (let i = 0; i < count; i++) {
    const className = classes[Math.floor(Math.random() * classes.length)];
    detections.push({
      id: `det_${Date.now()}_${i}`,
      className,
      confidence: 0.75 + Math.random() * 0.25,
      bbox: {
        x: Math.random() * 0.8,
        y: Math.random() * 0.8,
        width: 0.1 + Math.random() * 0.2,
        height: 0.1 + Math.random() * 0.2,
      },
      trackingId: Math.floor(Math.random() * 1000),
      timestamp: Date.now() - Math.random() * 5000,
    });
  }
  return detections;
}

export function generateMockEvent(
  busId: string, 
  position: GPSPosition, 
  detectionIds: string[] = []
): UrbanEvent {
  const eventConfig = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
  const subtype = eventConfig.subtypes[Math.floor(Math.random() * eventConfig.subtypes.length)];
  const severity = eventConfig.severities[Math.floor(Math.random() * eventConfig.severities.length)];
  
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: eventConfig.type,
    subtype,
    confidence: 0.8 + Math.random() * 0.2,
    severity,
    timestamp: Date.now(),
    position,
    busId,
    detectionIds,
    status: 'UNVERIFIED',
  };
}

export function generateInitialEvents(buses: Bus[]): UrbanEvent[] {
  const events: UrbanEvent[] = [];
  buses.forEach(bus => {
    if (bus.status === 'LIVE') {
      const count = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < count; i++) {
        events.push(generateMockEvent(bus.id, bus.position));
      }
    }
  });
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

export function getInitialKPIs(events: UrbanEvent[]): KPIMetrics {
  return {
    activeBuses: 3,
    detectionsToday: 128,
    roadHazards: events.filter(e => e.type === 'pothole' || e.type === 'road_damage').length,
    activeAlerts: events.filter(e => e.status === 'UNVERIFIED' || e.status === 'VERIFIED').length,
    avgConfidence: 91.4,
  };
}

export function getInitialAnalytics(): AnalyticsData {
  return {
    detectionsByType: {
      person: 45,
      car: 38,
      bus: 12,
      motorcycle: 18,
      bicycle: 8,
      pothole: 7,
      road_damage: 5,
      waterlogging: 4,
    },
    eventsOverTime: [
      { time: '06:00', count: 2 },
      { time: '07:00', count: 5 },
      { time: '08:00', count: 12 },
      { time: '09:00', count: 8 },
      { time: '10:00', count: 15 },
      { time: '11:00', count: 10 },
      { time: '12:00', count: 18 },
      { time: '13:00', count: 14 },
      { time: '14:00', count: 11 },
      { time: '15:00', count: 16 },
      { time: '16:00', count: 20 },
      { time: '17:00', count: 22 },
    ],
    roadConditions: {
      Critical: 2,
      High: 5,
      Moderate: 12,
      Clear: 45,
    },
    congestionLevel: 0.65,
  };
}

export function getInitialSystemStatus(
  cameraConnected: boolean, 
  gpsConnected: boolean
): SystemStatus {
  return {
    camera: {
      status: cameraConnected ? 'CONNECTED' : 'DISCONNECTED',
      label: 'CAMERA',
      lastUpdate: Date.now(),
      details: cameraConnected ? 'Webcam stream active' : 'Click START CAMERA',
    },
    gps: {
      status: gpsConnected ? 'CONNECTED' : 'DISCONNECTED',
      label: 'GPS',
      lastUpdate: Date.now(),
      details: gpsConnected ? 'GPS lock acquired' : 'Requesting permission...',
    },
    aiEngine: {
      status: 'RUNNING',
      label: 'AI ENGINE',
      lastUpdate: Date.now(),
      details: 'Simulation mode active',
    },
    eventPipeline: {
      status: 'ACTIVE',
      label: 'EVENT PIPELINE',
      lastUpdate: Date.now(),
      details: 'Processing detections',
    },
    map: {
      status: 'ONLINE',
      label: 'MAP',
      lastUpdate: Date.now(),
      details: 'OpenStreetMap tiles loaded',
    },
  };
}

export const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  low: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: '🟢' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', icon: '🟠' },
  high: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', icon: '🔴' },
  critical: { bg: 'bg-rose-600/20', text: 'text-rose-300', border: 'border-rose-500/50', icon: '🔴' },
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  pothole: 'POTHOLE',
  road_damage: 'ROAD DAMAGE',
  waterlogging: 'WATERLOGGING',
  damaged_sign: 'DAMAGED SIGN',
  missing_divider: 'MISSING DIVIDER',
  zebra_crossing: 'ZEBRA CROSSING',
  vehicle: 'VEHICLE',
  pedestrian: 'PEDESTRIAN',
};

export const DETECTION_CLASS_COLORS: Record<DetectionClass, string> = {
  person: 'text-cyan-400',
  car: 'text-blue-400',
  bus: 'text-indigo-400',
  motorcycle: 'text-purple-400',
  bicycle: 'text-green-400',
  pothole: 'text-rose-400',
  road_damage: 'text-rose-400',
  waterlogging: 'text-blue-400',
  damaged_sign: 'text-amber-400',
  missing_divider: 'text-amber-400',
  zebra_crossing: 'text-green-400',
};

export const DETECTION_CLASS_BG: Record<DetectionClass, string> = {
  person: 'bg-cyan-500/20 border-cyan-500/50',
  car: 'bg-blue-500/20 border-blue-500/50',
  bus: 'bg-indigo-500/20 border-indigo-500/50',
  motorcycle: 'bg-purple-500/20 border-purple-500/50',
  bicycle: 'bg-green-500/20 border-green-500/50',
  pothole: 'bg-rose-500/20 border-rose-500/50',
  road_damage: 'bg-rose-500/20 border-rose-500/50',
  waterlogging: 'bg-blue-500/20 border-blue-500/50',
  damaged_sign: 'bg-amber-500/20 border-amber-500/50',
  missing_divider: 'bg-amber-500/20 border-amber-500/50',
  zebra_crossing: 'bg-green-500/20 border-green-500/50',
};