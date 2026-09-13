import { useEffect, useRef, useState } from 'react';
import type { Detection, InferenceStats, ModelBackend, ModelLoadState } from '../types';
import {
  GENERAL_OBJECT_MODEL,
  POTHOLE_MODEL,
  checkModelAvailability,
} from '../inference/modelConfig';
import { ObjectDetector } from '../inference/objectDetector';

const isDev = import.meta.env.DEV;
function aiLog(...args: unknown[]) {
  if (isDev) console.log('[AI]', ...args);
}
function aiWarn(...args: unknown[]) {
  if (isDev) console.warn('[AI]', ...args);
}

export interface UseObjectDetectionOptions {
  /** When true the model is loaded and the inference loop runs. */
  active: boolean;
  /** When true the loop idles but the model stays loaded (fast resume). */
  paused?: boolean;
  /** Radar element already showing the webcam feed. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Confidence threshold (0..1) applied live. */
  threshold: number;
  /** Called after every inference pass with the real detections. */
  onDetections?: (detections: Detection[]) => void;
  targetFps?: number;
}

export interface UseObjectDetectionResult {
  detections: Detection[];
  modelState: ModelLoadState;
  modelError: string | null;
  backend: ModelBackend | null;
  stats: InferenceStats;
  potholeAvailable: boolean;
  isLoading: boolean;
}

export function useObjectDetection({
  active,
  paused = false,
  videoRef,
  threshold,
  onDetections,
  targetFps = 10,
}: UseObjectDetectionOptions): UseObjectDetectionResult {
  const [modelState, setModelState] = useState<ModelLoadState>('idle');
  const [modelError, setModelError] = useState<string | null>(null);
  const [backend, setBackend] = useState<ModelBackend | null>(null);
  const [potholeAvailable, setPotholeAvailable] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [fps, setFps] = useState(0);
  const [lastInferenceMs, setLastInferenceMs] = useState(0);
  const [lastInferenceAt, setLastInferenceAt] = useState(0);
  const [framesProcessed, setFramesProcessed] = useState(0);
  const [rawCandidates, setRawCandidates] = useState(0);
  const [thresholdPassed, setThresholdPassed] = useState(0);
  const [finalDetections, setFinalDetections] = useState(0);

  const onDetectionsRef = useRef(onDetections);
  onDetectionsRef.current = onDetections;
  const thresholdRef = useRef(threshold);
  thresholdRef.current = threshold;
  const activeRef = useRef(active);
  activeRef.current = active;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (!active) {
      setModelState('idle');
      setModelError(null);
    }
    setDetections([]);
  }, [active, paused]);

  // Load both the general object model and (when installed) the pothole model.
  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let detectors: ObjectDetector[] = [];
    let rafId = 0;
    let disposed = false;

    aiLog(`inference enabled: active=true paused=${paused}`);
    setModelState('loading');
    setModelError(null);

    const general = new ObjectDetector(GENERAL_OBJECT_MODEL);
    detectors.push(general);

    Promise.all([
      general.load().catch((e: unknown) => {
        if (cancelled) throw e;
        aiWarn('general model load error:', e instanceof Error ? e.message : e);
        setModelState('error');
        setModelError(e instanceof Error ? e.message : String(e));
        throw e;
      }),
      checkModelAvailability(POTHOLE_MODEL).then(async (available) => {
        aiLog(`pothole model available=${available} (${POTHOLE_MODEL.defaultPath})`);
        setPotholeAvailable(available);
        if (available) {
          const pothole = new ObjectDetector(POTHOLE_MODEL);
          detectors.push(pothole);
          await pothole.load().catch(() => {
            aiWarn('pothole model failed to load, degrading gracefully');
            return;
          });
        }
      }),
    ])
      .then(() => {
        if (cancelled || disposed) return;
        setModelState('ready');
        setBackend(general.status.backend === 'webgpu' ? 'webgpu' : 'wasm');
        aiLog('MODEL READY — starting inference loop');
      })
      .catch(() => {
        // error state already set in the first catch
      });

    // ---------- frame-sampling inference loop ----------
    const intervalMs = Math.max(66, 1000 / Math.max(5, Math.min(30, targetFps)));
    const pollUntilVideoReady = () => {
      const video = videoRef.current;
      return !!video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
    };

    let busy = false;
    let fpsWindowStart = performance.now();
    let fpsFrameCount = 0;
    let lastInferenceAtMs = 0;
    let selfTestDone = false;
    let videoNotReadyLoggedAt = 0;

    const tick = async () => {
      if (disposed) return;

      if (!activeRef.current || pausedRef.current) {
        if (!disposed) rafId = requestAnimationFrame(tick);
        return;
      }

      const now = performance.now();
      if (now - lastInferenceAtMs >= intervalMs && !busy) {
        const video = videoRef.current;
        const ready = pollUntilVideoReady();

        if (!ready && now - videoNotReadyLoggedAt > 2000) {
          videoNotReadyLoggedAt = now;
          aiWarn(
            `video not ready: readyState=${video?.readyState} w=${video?.videoWidth} h=${video?.videoHeight} — waiting for camera`,
          );
        }

        if (ready) {
          busy = true;
          const startedAt = now;
          const collection: Detection[] = [];
          let passRaw = 0;
          let passPassed = 0;
          let passFinal = 0;
          let passMaxScore = 0;
          try {
            for (const detector of detectors) {
              if (disposed) break;
              const r = await detector.detect(video as HTMLVideoElement, thresholdRef.current);
              collection.push(...r.detections);
              passRaw += r.rawCandidates;
              passPassed += r.aboveThreshold;
              passFinal += r.nmsKept;
              if (r.maxScore > passMaxScore) passMaxScore = r.maxScore;
            }
            if (!disposed) {
              fpsFrameCount++;
              const inferenceFinishedAt = performance.now();
              setLastInferenceMs(inferenceFinishedAt - startedAt);
              setLastInferenceAt(inferenceFinishedAt);
              setDetections(collection);
              setFramesProcessed(prev => prev + 1);
              setRawCandidates(passRaw);
              setThresholdPassed(passPassed);
              setFinalDetections(passFinal);
              onDetectionsRef.current?.(collection);
              if (!selfTestDone) {
                selfTestDone = true;
                const person = collection.filter(d => d.className === 'person');
                const frame = video as HTMLVideoElement;
                aiLog(
                  `[AI SELF-TEST] frame=${frame.videoWidth}x${frame.videoHeight} threshold=${thresholdRef.current} ` +
                    `detections=${collection.length} person=${person.length} score_max=${passMaxScore.toFixed(4)} raw=${passRaw} passed=${passPassed} ` +
                    `${person[0] ? `best_person=${Math.round(person[0].confidence * 100)}% bbox=${JSON.stringify(person[0].bbox)}` : ''}`,
                );
              }
            }
          } catch (e) {
            aiWarn('inference pass failed:', e instanceof Error ? (e.message || e) : e);
            if (!disposed) {
              setModelState('error');
              setModelError('Inference failed — check the browser console.');
            }
          } finally {
            busy = false;
            lastInferenceAtMs = performance.now();
          }
        }
      }

      if (!disposed) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    // fps window (1s) — count inference passes per second
    const fpsTimer = setInterval(() => {
      const windowMs = performance.now() - fpsWindowStart;
      if (windowMs > 0) {
        const currentFps = Math.round((fpsFrameCount * 1000) / windowMs);
        setFps(currentFps);
        if (fpsFrameCount > 0) aiLog(`inference fps=${currentFps} inferences_this_window=${fpsFrameCount}`);
      }
      fpsWindowStart = performance.now();
      fpsFrameCount = 0;
    }, 1000);

    return () => {
      cancelled = true;
      disposed = true;
      cancelAnimationFrame(rafId);
      clearInterval(fpsTimer);
      detectors.forEach(d => d.dispose());
      detectors = [];
      aiLog('inference loop stopped, detectors disposed');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, targetFps]);

  return {
    detections,
    modelState,
    modelError,
    backend,
    stats: {
      fps,
      lastInferenceMs,
      lastInferenceAt,
      framesProcessed,
      rawCandidates,
      thresholdPassed,
      finalDetections,
    },
    potholeAvailable,
    isLoading: modelState === 'loading',
  };
}