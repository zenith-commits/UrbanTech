/**
 * Maps REAL model detections into UrbanEvents. Nothing here is faked:
 * an event is only produced when a detection class that genuinely maps to an
 * urban observation has passed the persistence/cooldown checks.
 *
 * A generic COCO model must NOT report classes it cannot detect (e.g. potholes);
 * pothole events are only possible when a dedicated pothole model is installed.
 */

import type { Detection, GPSPosition, UrbanEvent, EventSeverity } from '../types';
import { generateId } from '../utils/helpers';

export interface SignificantEventSpec {
  eventType: string;
  severity: EventSeverity;
  subtype: string;
}

// Classes that warrant an urban event, keyed by model class name (lower-cased).
export const SIGNIFICANT_DETECTION_EVENTS: Record<string, SignificantEventSpec> = {
  pothole: { eventType: 'pothole', severity: 'high', subtype: 'Pothole detected' },
  person: { eventType: 'pedestrian', severity: 'medium', subtype: 'Pedestrian on roadway' },
  bus: { eventType: 'vehicle', severity: 'medium', subtype: 'Bus detected on route' },
  car: { eventType: 'vehicle', severity: 'low', subtype: 'Vehicle detected' },
  truck: { eventType: 'vehicle', severity: 'medium', subtype: 'Heavy vehicle detected' },
  motorcycle: { eventType: 'vehicle', severity: 'low', subtype: 'Motorcycle detected' },
  bicycle: { eventType: 'vehicle', severity: 'low', subtype: 'Bicycle detected' },
};

/** Frame counts that must be met before an event is emitted for a class. */
export const EVENT_SUSTAIN_FRAMES = 4;
/** Minimum gap between two events for the same class to avoid duplicate spam. */
export const EVENT_COOLDOWN_MS = 12000;

export function buildRealDetectionEvent(
  detection: Detection,
  position: GPSPosition,
  busId: string,
): UrbanEvent {
  const spec =
    SIGNIFICANT_DETECTION_EVENTS[detection.className.toLowerCase()] ??
    SIGNIFICANT_DETECTION_EVENTS[normalize(detection.className)];

  const severity: EventSeverity =
    spec?.eventType === 'pothole' && detection.confidence >= 0.85 ? 'critical' : (spec?.severity ?? 'medium');

  return {
    id: generateId('evt_'),
    type: spec?.eventType ?? 'road_damage',
    subtype: spec?.subtype ?? `${normalize(detection.className)} detected`,
    confidence: Math.round(detection.confidence * 100) / 100,
    severity,
    timestamp: Date.now(),
    position,
    busId,
    detectionIds: [detection.id],
    trackingId: detection.trackingId,
    status: 'UNVERIFIED',
  };
}

export function isSignificantDetectionClass(className: string): boolean {
  if (!className) return false;
  return Boolean(
    SIGNIFICANT_DETECTION_EVENTS[className.toLowerCase()] ??
      SIGNIFICANT_DETECTION_EVENTS[normalize(className)],
  );
}

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
}

/**
 * Temporal debouncer for real detections. Ensures a class is seen consistently
 * across several frames and enforces a cooldown between emitted events.
 */
export class DetectionDebouncer {
  private sustainCounts = new Map<string, number>();
  private lastEmission = new Map<string, number>();

  /** Returns the class name when an event should be emitted for it this frame. */
  update(detections: Detection[], now = Date.now()): string[] {
    const present = new Set(detections.map(d => d.className.toLowerCase()));
    const emitted: string[] = [];

    for (const key of present) {
      const count = (this.sustainCounts.get(key) ?? 0) + 1;
      this.sustainCounts.set(key, count);

      const lastEmit = this.lastEmission.get(key) ?? 0;
      if (count >= EVENT_SUSTAIN_FRAMES && now - lastEmit >= EVENT_COOLDOWN_MS) {
        if (detections.some(d => d.className.toLowerCase() === key)) {
          emitted.push(key);
          this.lastEmission.set(key, now);
        }
      }
    }

    // decay counters for classes that disappeared this frame
    for (const [key, count] of this.sustainCounts) {
      if (!present.has(key)) {
        this.sustainCounts.set(key, Math.max(0, count - 2));
      }
    }

    return emitted;
  }

  reset(): void {
    this.sustainCounts.clear();
    this.lastEmission.clear();
  }
}