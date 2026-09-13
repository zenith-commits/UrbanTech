import { useState, useEffect, useCallback, useRef } from 'react';
import type { Detection, DetectionClass, BoundingBox } from '../types';
import { DETECTION_CLASSES } from '../data/mockData';
import { generateId } from '../utils/helpers';

interface DetectionSimulationState {
  detections: Detection[];
  isRunning: boolean;
  fps: number;
  lastUpdate: number;
}

const CLASS_WEIGHTS: Record<DetectionClass, number> = {
  person: 25,
  car: 30,
  bus: 5,
  motorcycle: 15,
  bicycle: 10,
  pothole: 12,
  road_damage: 8,
  waterlogging: 5,
  damaged_sign: 3,
  missing_divider: 2,
  zebra_crossing: 3,
};

function weightedRandomClass(): DetectionClass {
  const total = Object.values(CLASS_WEIGHTS).reduce((a, b) => a + b, 0);
  let random = Math.random() * total;

  for (const className of DETECTION_CLASSES) {
    random -= CLASS_WEIGHTS[className];
    if (random <= 0) return className;
  }
  return 'person';
}

function generateRandomBBox(): BoundingBox {
  const width = 0.08 + Math.random() * 0.25;
  const height = 0.08 + Math.random() * 0.25;
  return {
    x: Math.random() * (1 - width),
    y: Math.random() * (1 - height),
    width,
    height,
  };
}

function slightlyMutateBBox(bbox: BoundingBox): BoundingBox {
  const mutation = 0.02;
  return {
    x: Math.max(0, Math.min(1 - bbox.width, bbox.x + (Math.random() - 0.5) * mutation)),
    y: Math.max(0, Math.min(1 - bbox.height, bbox.y + (Math.random() - 0.5) * mutation)),
    width: Math.max(0.05, Math.min(0.4, bbox.width + (Math.random() - 0.5) * mutation * 0.5)),
    height: Math.max(0.05, Math.min(0.4, bbox.height + (Math.random() - 0.5) * mutation * 0.5)),
  };
}

export function useDetectionSimulation(
  enabled: boolean = true,
  intervalMs: number = 1500,
  onFrame?: (detections: Detection[]) => void
) {
  const [state, setState] = useState<DetectionSimulationState>({
    detections: [],
    isRunning: false,
    fps: 0,
    lastUpdate: 0,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const generateDetections = useCallback((count: number): Detection[] => {
    const detections: Detection[] = [];
    const numDetections = Math.max(1, Math.min(count, 6));

    for (let i = 0; i < numDetections; i++) {
      detections.push({
        id: generateId('det_'),
        className: weightedRandomClass(),
        confidence: 0.7 + Math.random() * 0.3,
        bbox: generateRandomBBox(),
        trackingId: Math.floor(Math.random() * 9000) + 1,
        timestamp: Date.now(),
      });
    }
    return detections;
  }, []);

  const mutateDetections = useCallback((current: Detection[]): Detection[] => {
    return current.map(det => {
      if (Math.random() < 0.3) {
        return {
          ...det,
          bbox: slightlyMutateBBox(det.bbox),
          confidence: Math.max(0.5, Math.min(0.99, det.confidence + (Math.random() - 0.5) * 0.05)),
          timestamp: Date.now(),
        };
      }
      return { ...det, timestamp: Date.now() };
    });
  }, []);

  const addDetections = useCallback((current: Detection[], newDetections: Detection[]): Detection[] => {
    return [...current, ...newDetections].slice(-10);
  }, []);

  const removeRandomDetections = useCallback((current: Detection[], count: number): Detection[] => {
    if (current.length <= count) return [];
    const shuffled = [...current].sort(() => Math.random() - 0.5);
    return shuffled.slice(count);
  }, []);

  const tick = useCallback(() => {
    setState(prev => {
      if (!prev.isRunning) return prev;

      let newDetections = [...prev.detections];
      const now = Date.now();

      frameCountRef.current++;

      if (Math.random() < 0.4 && newDetections.length > 0) {
        newDetections = mutateDetections(newDetections);
      }

      if (Math.random() < 0.35) {
        const newCount = Math.floor(Math.random() * 3) + 1;
        newDetections = addDetections(newDetections, generateDetections(newCount));
      }

      if (Math.random() < 0.15 && newDetections.length > 2) {
        const removeCount = Math.floor(Math.random() * 2) + 1;
        newDetections = removeRandomDetections(newDetections, removeCount);
      }

      const nextState = {
        ...prev,
        detections: newDetections,
        lastUpdate: now,
      };

      return nextState;
    });
  }, [generateDetections, mutateDetections, addDetections, removeRandomDetections]);

  useEffect(() => {
    if (state.isRunning && onFrameRef.current) {
      onFrameRef.current(state.detections);
    }
  }, [state.detections, state.isRunning]);

  const start = useCallback(() => {
    setState(prev => ({ ...prev, isRunning: true }));
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, intervalMs);
    tick();
  }, [tick, intervalMs]);

  const stop = useCallback(() => {
    setState(prev => ({ ...prev, isRunning: false, detections: [] }));
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    setState(prev => ({ ...prev, isRunning: false }));
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    if (enabled) start();
  }, [enabled, start]);

  const clear = useCallback(() => {
    setState(prev => ({ ...prev, detections: [] }));
  }, []);

  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, start, stop]);

  useEffect(() => {
    const fpsInterval = setInterval(() => {
      setState(prev => ({
        ...prev,
        fps: frameCountRef.current,
      }));
      frameCountRef.current = 0;
    }, 1000);

    return () => clearInterval(fpsInterval);
  }, []);

  return {
    ...state,
    start,
    stop,
    pause,
    resume,
    clear,
  };
}