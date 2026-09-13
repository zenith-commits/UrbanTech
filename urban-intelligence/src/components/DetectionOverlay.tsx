import { useEffect, useRef } from 'react';
import type { Detection } from '../types';
import { detectionStyleFor } from '../utils/detectionStyles';
import { formatConfidence } from '../utils/helpers';

/**
 * Transparent canvas overlay drawn directly above the webcam <video>.
 *
 * The video is rendered with `object-cover`, so native video coordinates are
 * mapped to element coordinates using the cover transform (crop + scale).
 * The canvas is kept in sync with the element size via ResizeObserver and
 * accounts for devicePixelRatio so boxes stay crisp.
 */

interface DetectionOverlayProps {
  detections: Detection[];
  videoWidth: number;
  videoHeight: number;
  isActive: boolean;
  mode: 'off' | 'demo' | 'real';
}

function coverTransform(
  videoWidth: number,
  videoHeight: number,
  containerWidth: number,
  containerHeight: number,
): { scale: number; offsetX: number; offsetY: number } {
  if (videoWidth <= 0 || videoHeight <= 0) return { scale: 1, offsetX: 0, offsetY: 0 };
  const scale = Math.max(containerWidth / videoWidth, containerHeight / videoHeight);
  return {
    scale,
    offsetX: (containerWidth - videoWidth * scale) / 2,
    offsetY: (containerHeight - videoHeight * scale) / 2,
  };
}

export function DetectionOverlay({ detections, videoWidth, videoHeight, isActive, mode }: DetectionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || !isActive) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, container.clientWidth, container.clientHeight);

    if (detections.length === 0) {
      ctx.restore();
      return;
    }

    const { scale, offsetX, offsetY } = coverTransform(videoWidth, videoHeight, container.clientWidth, container.clientHeight);

    for (const det of detections) {
      const bbox = det.bbox;
      const x = bbox.x * videoWidth * scale + offsetX;
      const y = bbox.y * videoHeight * scale + offsetY;
      const w = bbox.width * videoWidth * scale;
      const h = bbox.height * videoHeight * scale;

      const style = detectionStyleFor(det.className);
      const glow = hexFromClass(style.label);

      ctx.lineWidth = 2;
      ctx.strokeStyle = glow;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 6;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;

      const label = (det.className || 'object').toUpperCase();
      const conf = formatConfidence(det.confidence);
      ctx.font = `700 12px 'JetBrains Mono', monospace`;
      const text = `${label} ${conf}`;

      const padX = 6;
      const padY = 6;
      const labelW = ctx.measureText(text).width + padX * 2;
      const labelH = 20;
      const labelY = Math.max(0, y - labelH);

      ctx.fillStyle = hexFromClass(style.label);
      ctx.fillRect(x, labelY, labelW, labelH);
      ctx.fillStyle = '#0a0f1a';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + padX, labelY + labelH / 2 + 1);

      if (mode === 'demo') {
        ctx.font = `700 8px 'JetBrains Mono', monospace`;
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('● DEMO', x + padX, labelY + labelH / 2 + 1);
      }
    }

    ctx.restore();
  }, [detections, videoWidth, videoHeight, isActive, mode]);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden">
      <canvas ref={canvasRef} className="absolute top-0 left-0" />
    </div>
  );
}

function hexFromClass(tailwindText: string): string {
  const map: Record<string, string> = {
    'text-cyan-300': '#67e8f9',
    'text-cyan-400': '#22d3ee',
    'text-green-300': '#86efac',
    'text-blue-300': '#93c5fd',
    'text-purple-300': '#d8b4fe',
    'text-indigo-300': '#c7d2fe',
    'text-fuchsia-300': '#f0abfc',
    'text-amber-300': '#fcd34d',
    'text-rose-300': '#fda4af',
  };
  return map[tailwindText] ?? '#22d3ee';
}