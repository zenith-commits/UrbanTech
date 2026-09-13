import type { Detection, GPSPosition, UrbanEvent } from '../types';
import type { EventSeverity } from '../types';

const SUSTAIN_MS = 2500;

const CLASS_EVENT_INFO: Record<string, { type: string; subtype: string; severity: EventSeverity }> = {
  pothole:       { type: 'pothole',       subtype: 'Pothole detected',        severity: 'high' },
  road_damage:   { type: 'road_damage',   subtype: 'Road damage detected',    severity: 'medium' },
  waterlogging:  { type: 'waterlogging',  subtype: 'Waterlogging detected',   severity: 'high' },
  damaged_sign:  { type: 'damaged_sign',  subtype: 'Damaged traffic sign',    severity: 'medium' },
  missing_divider: { type: 'missing_divider', subtype: 'Missing road divider', severity: 'low' },
  zebra_crossing:  { type: 'zebra_crossing',  subtype: 'Zebra crossing issue', severity: 'medium' },
  person:        { type: 'object',        subtype: 'Pedestrian detected',     severity: 'low' },
  car:           { type: 'traffic',       subtype: 'Vehicle detected',        severity: 'low' },
  bus:           { type: 'traffic',       subtype: 'Bus detected',            severity: 'low' },
  motorcycle:    { type: 'traffic',       subtype: 'Motorcycle detected',     severity: 'low' },
  bicycle:       { type: 'traffic',       subtype: 'Bicycle detected',        severity: 'low' },
  truck:         { type: 'traffic',       subtype: 'Truck detected',          severity: 'low' },
};

function eventInfoFor(className: string) {
  return CLASS_EVENT_INFO[className.toLowerCase()] ?? { type: 'object', subtype: `${className} detected`, severity: 'low' as const };
}

/** Quantised centre key — objects near the same pixel area share a key. */
export function stableKey(det: Detection): string {
  const cx = Math.round((det.bbox.x + det.bbox.width / 2) / 24);
  const cy = Math.round((det.bbox.y + det.bbox.height / 2) / 24);
  return `${det.className}:${cx}:${cy}`;
}

interface SustainedEntry {
  key: string;
  className: string;
  firstSeen: number;
  lastSeen: number;
  confidence: number;
  emitted: boolean;
}

/**
 * Tracks detections across frames. When a detection is sustained (present in
 * consecutive frames) for at least `SUSTAIN_MS`, it is returned as a candidate
 * for a persisted UrbanEvent.
 */
export class DetectionEventCoordinator {
  private entries = new Map<string, SustainedEntry>();
  private lastEmitAt = new Map<string, number>();

  /** Feed the current frame's detections. Returns newly-sustained detections. */
  update(detections: Detection[], now: number = Date.now()): Detection[] {
    for (const [key, entry] of this.entries) {
      if (now - entry.lastSeen > SUSTAIN_MS) this.entries.delete(key);
    }

    for (const det of detections) {
      const key = stableKey(det);
      const existing = this.entries.get(key);
      if (existing) {
        existing.lastSeen = now;
        existing.confidence = Math.max(existing.confidence, det.confidence);
      } else {
        this.entries.set(key, {
          key,
          className: det.className,
          firstSeen: now,
          lastSeen: now,
          confidence: det.confidence,
          emitted: false,
        });
      }
    }

    const newlySustained: Detection[] = [];
    for (const det of detections) {
      const key = stableKey(det);
      const entry = this.entries.get(key);
      if (!entry || entry.emitted) continue;
      if (now - entry.firstSeen >= SUSTAIN_MS) {
        entry.emitted = true;
        newlySustained.push(det);
      }
    }
    return newlySustained;
  }

  /** Enforce per-class cooldown before emitting another event of the same type. */
  shouldEmit(className: string, cooldownMs: number, now: number = Date.now()): boolean {
    const last = this.lastEmitAt.get(className) ?? 0;
    if (now - last >= cooldownMs) {
      this.lastEmitAt.set(className, now);
      return true;
    }
    return false;
  }

  reset() {
    this.entries.clear();
    this.lastEmitAt.clear();
  }
}

/** Class-name to emit-cooldown lookup. */
export function cooldownForClass(className: string): number {
  const hazard = ['pothole', 'road_damage', 'waterlogging', 'damaged_sign', 'missing_divider', 'zebra_crossing'];
  const highTraffic = ['car', 'bus', 'truck'];
  if (hazard.includes(className.toLowerCase())) return 6_000;
  if (highTraffic.includes(className.toLowerCase())) return 20_000;
  return 30_000;
}

/** Build a real UrbanEvent from a sustained Detection. */
export function buildRealDetectionEvent(
  detection: Detection,
  position: GPSPosition,
  busId: string,
): UrbanEvent {
  const info = eventInfoFor(detection.className);
  return {
    id: `real_${Date.now()}_${detection.trackingId ?? Math.random().toString(36).slice(2, 8)}`,
    type: info.type,
    subtype: info.subtype,
    confidence: detection.confidence,
    severity: info.severity,
    timestamp: Date.now(),
    position,
    busId,
    detectionIds: [detection.id],
    status: 'UNVERIFIED',
  };
}
