import { useRef, useEffect, useState } from 'react';
import { Video, Cpu, Zap, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import type { Detection } from '../types';
import { DetectionOverlay } from './DetectionOverlay';

interface WebcamPanelProps {
  stream: MediaStream | null;
  isActive: boolean;
  error?: string | null;
  detections: Detection[];
  fps: number;
  isSimulationRunning: boolean;
  onToggleSimulation: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function WebcamPanel({
  stream,
  isActive,
  error,
  detections,
  fps,
  isSimulationRunning,
  onToggleSimulation,
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
  }, [stream, videoRef]);

  if (!isActive) {
    return (
      <div className="relative bg-navy-900 rounded-lg overflow-hidden border border-navy-600 aspect-video flex items-center justify-center">
        <div className="text-center p-8">
          <Video className="w-16 h-16 text-navy-500 mx-auto mb-4" />
          <p className="text-navy-400 text-lg font-medium">CAMERA OFFLINE</p>
          <p className="text-navy-500 text-sm mt-1">Click START CAMERA to begin</p>

          {error && (
            <div className="mt-4 mx-auto max-w-sm p-3 bg-rose-500/10 border border-rose-500/30 rounded flex items-start gap-2 text-left">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span className="text-rose-300 text-sm">{error}</span>
            </div>
          )}
        </div>
        <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-navy-900/80 border border-navy-600 rounded">
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          <span className="text-rose-400 text-xs font-mono">OFFLINE</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-navy-900 rounded-lg overflow-hidden border border-navy-600 aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      <DetectionOverlay
        detections={detections}
        videoWidth={videoDimensions.width}
        videoHeight={videoDimensions.height}
        isActive={isActive}
      />

      {/* Top overlay */}
      <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded bg-navy-900/80 border ${isSimulationRunning ? 'border-emerald-500/30' : 'border-navy-600'}`}>
              <span className={`w-2 h-2 rounded-full ${isSimulationRunning ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span className={`text-xs font-mono ${isSimulationRunning ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isSimulationRunning ? 'AI DETECTION ACTIVE' : 'AI DETECTION PAUSED'}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-navy-900/80 border border-navy-600 rounded text-xs text-amber-400/80">
              <Zap className="w-3 h-3" />
              FRONTEND AI SIMULATION
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-navy-900/80 border border-navy-600 rounded flex items-center gap-2 text-white text-sm font-mono">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>FPS: {fps}</span>
            </div>
            <div className="px-3 py-1.5 bg-navy-900/80 border border-navy-600 rounded flex items-center gap-2 text-white text-sm font-mono">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>DETECTIONS: {detections.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto">
        <div className="flex items-center justify-between">
          <button
            onClick={onToggleSimulation}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              isSimulationRunning
                ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'
            }`}
          >
            {isSimulationRunning ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {isSimulationRunning ? 'PAUSE AI' : 'RESUME AI'}
          </button>

          <div className="flex items-center gap-2 text-xs text-navy-400">
            <span className="font-mono tabular-nums hidden sm:block">{videoDimensions.width}×{videoDimensions.height}</span>
            <span className="px-2 py-0.5 bg-navy-800 rounded border border-navy-600">
              {detections.length} objects tracked
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}