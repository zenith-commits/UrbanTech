// Canonical frontend types for the Urban Intelligence Command Center.
// This module is the SINGLE source of truth for shared shapes.
// It intentionally contains one runtime export so that bundlers (Vite/esbuild)
// always see a value export and never drop the whole module during dev
// pre-bundling.

export const TYPES_MODULE_VERSION = '1.0.0';

export interface GPSPosition {
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp: number;
  isReal: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DetectionClass =
  | 'person'
  | 'car'
  | 'bus'
  | 'motorcycle'
  | 'bicycle'
  | 'pothole'
  | 'road_damage'
  | 'waterlogging'
  | 'damaged_sign'
  | 'missing_divider'
  | 'zebra_crossing';

export interface Detection {
  id: string;
  className: string;
  confidence: number;
  bbox: BoundingBox;
  trackingId: number;
  timestamp: number;
}

export type DetectionMode = 'off' | 'demo' | 'real';

export type ModelLoadState = 'idle' | 'loading' | 'ready' | 'error';

export type ModelBackend = 'webgpu' | 'wasm';

export interface InferenceStats {
  fps: number;
  lastInferenceMs: number;
  lastInferenceAt: number;
  framesProcessed: number;
  rawCandidates: number;
  thresholdPassed: number;
  finalDetections: number;
}

export type EventSeverity = 'low' | 'medium' | 'high' | 'critical';
export type EventStatus = 'UNVERIFIED' | 'VERIFIED' | 'RESOLVED';

export interface UrbanEvent {
  id: string;
  type: string;
  subtype?: string;
  confidence: number;
  severity: EventSeverity;
  timestamp: number;
  position: GPSPosition;
  busId: string;
  detectionIds?: string[];
  trackingId?: number;
  status: EventStatus;
  verifiedAt?: number;
  maintenanceAlertId?: string;
}

export interface Alert {
  id: string;
  eventId: string;
  type: string;
  severity: EventSeverity;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  acknowledgedAt?: number;
  maintenance?: boolean;
}

export interface Bus {
  id: string;
  label: string;
  position: GPSPosition;
  isActive: boolean;
  route: [number, number][];
  eventsCount: number;
  status: 'LIVE' | 'IDLE' | 'OFFLINE';
  gpsStatus: 'LOCKED' | 'SEARCHING' | 'OFF';
  cameraStatus?: string;
  detectionCount?: number;
  speed?: number;
  heading?: number;
}

export interface KPIMetrics {
  activeBuses: number;
  detectionsToday: number;
  roadHazards: number;
  activeAlerts: number;
  avgConfidence: number;
}

export interface AnalyticsData {
  detectionsByType: Record<string, number>;
  eventsOverTime: { time: string; count: number }[];
  roadConditions: Record<string, number>;
  congestionLevel: number;
}

export type ComponentStatusLabel =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'ERROR'
  | 'RUNNING'
  | 'ACTIVE'
  | 'ONLINE'
  | 'STANDBY';

export interface ComponentStatus {
  status: ComponentStatusLabel;
  label: string;
  lastUpdate: number;
  details?: string;
}

export interface SystemStatus {
  camera: ComponentStatus;
  gps: ComponentStatus;
  aiEngine: ComponentStatus;
  eventPipeline: ComponentStatus;
  map: ComponentStatus;
}