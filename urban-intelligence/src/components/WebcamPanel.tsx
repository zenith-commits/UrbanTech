import { useEffect, useState } from 'react';
import {
  Video,
  Cpu,
  Zap,
  Eye,
  EyeOff,
  AlertTriangle,
  RadioTower,
  Power,
} from 'lucide-react';
import type { Detection, InferenceStats, ModelBackend, ModelLoadState } from '../types';
import { DetectionOverlay } from './DetectionOverlay';

export type DetectionMode = 'off' | 'demo' | 'real';

interface WebcamPanelProps {
  detectionMode: DetectionMode;
  isActive: boolean;
  isLoading?: boolean;
  videoReady?: boolean;
  error?: string | null;
  detections: Detection[];
  stats: InferenceStats;
  simFps: number;
  simRunning: boolean;
  /** Real inference is actively running (model ready AND not paused). */
  aiRunning: boolean;
  modelState: ModelLoadState;
  modelError: string | null;
  modelBackend: ModelBackend | null;
  potholeAvailable: boolean;
  threshold: number;
  onThresholdChange: (threshold: number) => void;
  onToggleSimulation: () => void;
  onStartCamera: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

const isDev = import.meta.env.DEV;

export function WebcamPanel({
  detectionMode,
  isActive,
  isLoading,
  videoReady,
  error,
  detections,
  stats,
  simFps,
  simRunning,
  aiRunning,
  modelState,
  modelError,
  modelBackend,
  potholeAvailable,
  threshold,
  onThresholdChange,
  onToggleSimulation,
  onStartCamera,
  videoRef,
}: WebcamPanelProps) {
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateDimensions = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setVideoDimensions({
          width: video.videoWidth,
          height: video.videoHeight,
        });
      }
    };

    video.addEventListener('loadedmetadata', updateDimensions);
    video.addEventListener('resize', updateDimensions);

    if (video.readyState >= 1) {
      updateDimensions();
    }

    return () => {
      video.removeEventListener('loadedmetadata', updateDimensions);
      video.removeEventListener('resize', updateDimensions);
    };
  }, [videoRef]);

  const displayedFps = detectionMode === 'real' ? stats.fps : simRunning ? simFps : 0;

  const realBadge = (() => {
    if (modelState === 'loading') return { text: 'AI MODEL LOADING', ok: false, warn: true, err: false };
    if (modelState === 'error') return { text: 'AI MODEL ERROR', ok: false, warn: false, err: true };
    if (modelState === 'idle') return { text: 'AI MODEL STANDBY', ok: false, warn: false, err: false };
    if (!aiRunning) return { text: 'AI INFERENCE PAUSED', ok: false, warn: true, err: false };
    return { text: 'REAL AI INFERENCE', ok: true, warn: false, err: false };
  })();

  return (
    <div className="relative bg-navy-900 rounded-lg overflow-hidden border border-navy-600 aspect-video min-h-[240px]">
      {/* Video element is ALWAYS mounted so camera streams can attach reliably. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Camera is running */}
      {isActive && (
        <>
          <DetectionOverlay
            detections={detections}
            videoWidth={videoDimensions.width}
            videoHeight={videoDimensions.height}
            isActive={isActive}
            mode={detectionMode}
          />

          {/* Top overlay */}
          <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {detectionMode === 'real' ? (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded bg-navy-900/80 border ${
                    realBadge.ok ? 'border-emerald-500/30' : realBadge.err ? 'border-rose-500/30' : realBadge.warn ? 'border-amber-500/30' : 'border-navy-600'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      realBadge.ok ? 'bg-emerald-400 animate-pulse' : realBadge.err ? 'bg-rose-400' : realBadge.warn ? 'bg-amber-400 animate-pulse' : 'bg-navy-500'
                    }`} />
                    <span className={`text-xs font-mono ${
                      realBadge.ok ? 'text-emerald-400' : realBadge.err ? 'text-rose-400' : realBadge.warn ? 'text-amber-400' : 'text-navy-400'
                    }`}>
                      {realBadge.text}
                    </span>
                  </div>
                ) : (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded bg-navy-900/80 border ${
                    detectionMode === 'demo' ? 'border-amber-500/30' : 'border-navy-600'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      detectionMode === 'demo' ? (isActive && simRunning ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400') : 'bg-navy-500'
                    }`} />
                    <span className={`text-xs font-mono ${
                      detectionMode === 'demo' ? (isActive && simRunning ? 'text-emerald-400' : 'text-rose-400') : 'text-navy-400'
                    }`}>
                      {detectionMode === 'demo' ? 'DEMO AI' : 'AI ENGINE OFF'}
                    </span>
                  </div>
                )}
                {detectionMode === 'demo' && (
                  <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-navy-900/80 border border-navy-600 rounded text-xs text-amber-400/80">
                    <Zap className="w-3 h-3" />
                    FRONTEND AI SIMULATION
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-navy-900/80 border border-navy-600 rounded flex items-center gap-2 text-white text-sm font-mono">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>FPS: {displayedFps}</span>
                </div>
                <div className="px-3 py-1.5 bg-navy-900/80 border border-navy-600 rounded flex items-center gap-2 text-white text-sm font-mono">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>DETECTIONS: {detections.length}</span>
                </div>
              </div>
            </div>

            {detectionMode === 'real' && modelState !== 'error' && modelBackend && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-mono">
                <span
                  className={`px-2 py-0.5 rounded border ${
                    potholeAvailable
                      ? 'bg-rose-400/10 border-rose-500/30 text-rose-300'
                      : 'bg-navy-800 border-navy-600 text-navy-500'
                  }`}
                  title="POTHOLE MODEL INSTALLED"
                >
                  <RadioTower className="w-3 h-3 mr-1 inline" />
                  POTHOLE {potholeAvailable ? 'MODEL ONLINE' : 'NOT INSTALLED'}
                </span>
                <span className="px-2 py-0.5 rounded bg-navy-800 border border-navy-600 text-navy-300">
                  BACKEND {modelBackend.toUpperCase()}
                </span>
                <span className="px-2 py-0.5 rounded bg-navy-800 border border-navy-600 text-navy-300">
                  INFER {stats.lastInferenceMs}ms
                </span>
                <span className="px-2 py-0.5 rounded bg-navy-800 border border-navy-600 text-navy-300">
                  FRAMES {stats.framesProcessed}
                </span>
              </div>
            )}
          </div>

          {detectionMode === 'real' && modelError && (
            <div className="absolute left-4 right-4 bottom-16 p-3 bg-rose-500/10 border border-rose-500/30 rounded flex items-start gap-2 text-left">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span className="text-rose-300 text-xs">{modelError}</span>
            </div>
          )}

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto">
            <div className="flex items-center justify-between gap-2">
              {detectionMode !== 'off' ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={onToggleSimulation}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      aiRunning
                        ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30'
                        : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'
                    }`}
                  >
                    {aiRunning ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {aiRunning ? 'PAUSE AI' : 'RESUME AI'}
                  </button>
                  {detectionMode === 'real' && aiRunning && potholeAvailable && (
                    <span className="text-[11px] text-rose-400/80 font-mono">
                      POTHOLE ALERTS WILL BE RAISED
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-navy-500">AI ENGINE OFF — select DEMO AI or LIVE AI</span>
              )}

              <div className="flex items-center gap-2 text-xs text-navy-400">
                <span className="font-mono tabular-nums hidden sm:block">{videoDimensions.width}×{videoDimensions.height}</span>
                <span className="px-2 py-0.5 bg-navy-800 rounded border border-navy-600">
                  {detections.length} objects tracked
                </span>
              </div>
            </div>

            {detectionMode === 'real' && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-[11px] text-navy-300 font-mono">THRESHOLD</span>
                <input
                  type="range"
                  min={0.1}
                  max={0.9}
                  step={0.01}
                  value={threshold}
                  onChange={(e) => onThresholdChange(Number(e.target.value))}
                  className="w-40 accent-cyan-400"
                />
                <span className="text-xs text-cyan-300 font-mono tabular-nums">{Math.round(threshold * 100)}%</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Camera offline / requesting / error placeholder */}
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-navy-900">
          <div className="text-center p-8">
            <Video className="w-16 h-16 text-navy-500 mx-auto mb-4" />
            {isLoading ? (
              <>
                <p className="text-amber-400 text-lg font-medium">REQUESTING CAMERA…</p>
                <p className="text-navy-500 text-sm mt-1">Check the browser permission prompt</p>
              </>
            ) : error ? (
              <>
                <p className="text-rose-400 text-lg font-medium">CAMERA ERROR</p>
                <div className="mt-4 mx-auto max-w-sm p-3 bg-rose-500/10 border border-rose-500/30 rounded flex items-start gap-2 text-left">
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span className="text-rose-300 text-sm">{error}</span>
                </div>
              </>
            ) : (
              <>
                <p className="text-navy-400 text-lg font-medium">CAMERA OFFLINE</p>
                <p className="text-navy-500 text-sm mt-1">Click START CAMERA to begin</p>
              </>
            )}
            {!isLoading && (
              <button
                onClick={onStartCamera}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm font-medium hover:bg-cyan-500/30 transition-colors"
              >
                <Power className="w-4 h-4" />
                START CAMERA
              </button>
            )}
          </div>
          <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-navy-900/80 border border-navy-600 rounded">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span className="text-rose-400 text-xs font-mono">OFFLINE</span>
          </div>
        </div>
      )}

      {/* Dev diagnostics panel (only in development) */}
      {isDev && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-[168px] text-[10px] font-mono leading-[1.45] bg-black/70 border border-white/10 rounded p-2 text-navy-200 pointer-events-none">
          <div className="text-[9px] tracking-wider text-navy-400 border-b border-white/10 pb-1 mb-1">AI DIAGNOSTICS</div>
          <div className="flex justify-between"><span>CAMERA</span><span className={isActive ? 'text-emerald-400' : 'text-rose-400'}>{isActive ? '✓ stream active' : '—'}</span></div>
          <div className="flex justify-between"><span>VIDEO</span><span className="text-cyan-300">{videoReady ? `✓ ${videoDimensions.width}×${videoDimensions.height}` : 'waiting…'}</span></div>
          <div className="flex justify-between"><span>MODEL</span><span className={modelState === 'ready' ? 'text-emerald-400' : modelState === 'error' ? 'text-rose-400' : 'text-amber-400'}>{modelState}</span></div>
          <div className="flex justify-between"><span>BACKEND</span><span className="text-cyan-300">{modelBackend ? modelBackend.toUpperCase() : '—'}</span></div>
          <div className="flex justify-between"><span>INFERENCE</span><span className={modelState === 'ready' && aiRunning ? 'text-emerald-400' : 'text-amber-400'}>{modelState === 'ready' && aiRunning ? 'RUNNING' : modelState === 'ready' ? 'PAUSED' : modelState}</span></div>
          <div className="flex justify-between"><span>FPS</span><span className="text-white">{displayedFps}</span></div>
          <div className="flex justify-between"><span>RAW CAND</span><span className="text-white">{stats.framesProcessed > 0 ? stats.rawCandidates : 0}</span></div>
          <div className="flex justify-between"><span>THRESH PASS</span><span className="text-white">{stats.framesProcessed > 0 ? stats.thresholdPassed : 0}</span></div>
          <div className="flex justify-between"><span>FINAL DETS</span><span className="text-white">{stats.framesProcessed > 0 ? stats.finalDetections : 0}</span></div>
          <div className="flex justify-between"><span>PERSON</span><span className="text-white">{detections.filter(d => d.className === 'person').length}</span></div>
          <div className="flex justify-between"><span>THRESHOLD</span><span className="text-white">{threshold.toFixed(2)}</span></div>
        </div>
      )}
    </div>
  );
}