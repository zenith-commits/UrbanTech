import type { Detection } from '../types';
import { DETECTION_CLASS_COLORS, DETECTION_CLASS_BG } from '../data/mockData';
import { formatConfidence } from '../utils/helpers';

interface DetectionOverlayProps {
  detections: Detection[];
  videoWidth: number;
  videoHeight: number;
  isActive: boolean;
}

export function DetectionOverlay({ detections, videoWidth, videoHeight, isActive }: DetectionOverlayProps) {
  if (!isActive || detections.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {detections.map((detection) => {
        const bbox = detection.bbox;
        const x = bbox.x * videoWidth;
        const y = bbox.y * videoHeight;
        const width = bbox.width * videoWidth;
        const height = bbox.height * videoHeight;

        const classColor = DETECTION_CLASS_COLORS[detection.className];
        const classBg = DETECTION_CLASS_BG[detection.className];
        const label = detection.className.replace('_', ' ').toUpperCase();

        return (
          <div
            key={detection.id}
            className="absolute"
            style={{
              left: x,
              top: y,
              width,
              height,
            }}
          >
            <div
              className={`absolute inset-0 border-2 ${classBg} rounded transition-all duration-200`}
              style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 0 8px 2px rgba(0,0,0,0.4)' }}
            />

            <div
              className={`absolute top-0 left-0 transform -translate-y-full flex items-center gap-1.5 px-2 py-1 rounded-t ${classBg} border-b-0`}
              style={{ whiteSpace: 'nowrap' }}
            >
              <span className={`font-mono font-bold text-xs ${classColor}`}>{label}</span>
              <span className="font-mono text-xs text-white/80 bg-black/50 px-1.5 py-0.5 rounded">
                ID #{detection.trackingId.toString().padStart(3, '0')}
              </span>
              <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${classColor} bg-black/50`}>
                {formatConfidence(detection.confidence)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}