/**
 * YOLOv8 preprocessing, postprocessing, and Non-Maximum Suppression.
 * All coordinates handled here are relative to the original video frame
 * (normalized 0..1) so they map directly to our canonical BoundingBox.
 */

import type { BoundingBox } from '../types';

const yoloDev = import.meta.env?.DEV;
function yoloLog(...args: unknown[]) {
  if (yoloDev) console.log('[YOLO DEBUG]', ...args);
}
function yoloWarn(...args: unknown[]) {
  if (yoloDev) console.warn('[YOLO DEBUG]', ...args);
}

/** One-shot static-test dump + decode-error guard. */
let staticTestDone = false;
let decodeErrorLogged = false;

export interface YoloPreprocessResult {
  padX: number;
  padY: number;
  scale: number;
}

export interface PreprocessBuffers {
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
}

export function createPreprocessBuffers(size: number): PreprocessBuffers {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
  return { canvas, ctx: ctx as OffscreenCanvasRenderingContext2D };
}

/** Letterbox the frame into a square canvas and return the input tensor + transform info. */
export function preprocessFrame(
  video: HTMLVideoElement,
  buffers: PreprocessBuffers,
  inputSize: number,
): { data: Float32Array; transform: YoloPreprocessResult } {
  const srcW = video.videoWidth;
  const srcH = video.videoHeight;
  if (srcW === 0 || srcH === 0) {
    throw new Error('Video frame not ready (0x0)');
  }

  const { canvas, ctx } = buffers;
  const size = inputSize;

  const scale = Math.min(size / srcW, size / srcH);
  const newW = Math.round(srcW * scale);
  const newH = Math.round(srcH * scale);
  const padX = Math.floor((size - newW) / 2);
  const padY = Math.floor((size - newH) / 2);

  // fill gray padding (114 is standard YOLO letterbox fill)
  ctx.fillStyle = 'rgb(114,114,114)';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(video, padX, padY, newW, newH);

  const imageData = ctx.getImageData(0, 0, size, size);
  const pixels = imageData.data; // Uint8ClampedArray RGBA 4 bytes per pixel

  // CHW float32 normalized to [0,1], RGB order
  const chwSize = 3 * size * size;
  const tensorData = new Float32Array(chwSize);
  const pixelCount = size * size;

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    tensorData[i] = pixels[offset] / 255.0; // R → channel 0
    tensorData[pixelCount + i] = pixels[offset + 1] / 255.0; // G → channel 1
    tensorData[2 * pixelCount + i] = pixels[offset + 2] / 255.0; // B → channel 2
  }

  return {
    data: tensorData,
    transform: { padX, padY, scale },
  };
}

// ---------- IoU & NMS ----------

function computeIoU(a: { x1: number; y1: number; x2: number; y2: number }, b: { x1: number; y1: number; x2: number; y2: number }): number {
  const interX1 = Math.max(a.x1, b.x1);
  const interY1 = Math.max(a.y1, b.y1);
  const interX2 = Math.min(a.x2, b.x2);
  const interY2 = Math.min(a.y2, b.y2);
  const interArea = Math.max(0, interX2 - interX1) * Math.max(0, interY2 - interY1);
  const aArea = (a.x2 - a.x1) * (a.y2 - a.y1);
  const bArea = (b.x2 - b.x1) * (b.y2 - b.y1);
  const unionArea = aArea + bArea - interArea;
  return unionArea > 0 ? interArea / unionArea : 0;
}

interface Candidate {
  classIndex: number;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Per-class NMS. Mutates internal order; returns surviving indices. */
function nms(candidates: Candidate[], iouThreshold: number): Candidate[] {
  const grouped = new Map<number, Candidate[]>();
  for (const c of candidates) {
    const arr = grouped.get(c.classIndex) ?? [];
    arr.push(c);
    grouped.set(c.classIndex, arr);
  }

  const kept: Candidate[] = [];
  for (const boxArr of grouped.values()) {
    boxArr.sort((a, b) => b.confidence - a.confidence);
    const alive: boolean[] = boxArr.map(() => true);
    for (let i = 0; i < boxArr.length; i++) {
      if (!alive[i]) continue;
      kept.push(boxArr[i]);
      for (let j = i + 1; j < boxArr.length; j++) {
        if (!alive[j]) continue;
        if (computeIoU(boxArr[i], boxArr[j]) > iouThreshold) {
          alive[j] = false;
        }
      }
    }
  }
  return kept;
}

// ---------- Postprocess ----------

export interface YoloDetection {
  classIndex: number;
  className: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface YoloPostprocessResult {
  detections: YoloDetection[];
  /** Total raw candidates in the output tensor (8400 for YOLOv8n). */
  rawCandidates: number;
  /** Candidates that passed the confidence threshold before NMS. */
  aboveThreshold: number;
  /** Highest class score observed across all candidates. */
  maxScore: number;
  /** Final detections after NMS (equals detections.length). */
  nmsKept: number;
}

export function yoloV8Postprocess(
  outputTensor: { dims: readonly number[]; data: Float32Array },
  transform: YoloPreprocessResult,
  srcWidth: number,
  srcHeight: number,
  classNames: readonly string[],
  confidenceThreshold: number,
  iouThreshold: number,
): YoloPostprocessResult {
  const { dims, data } = outputTensor;
  const numClasses = classNames.length;

  // YOLOv8 exports either [1, C, N] (channel-first, data[c*N + n]) or
  // [1, N, C] (channel-last, data[n*C + c]). C = numClasses + 4 (4 box + C classes).
  // Both 3D and 2D shapes are handled. Which dim equals numClasses+4 decides.
  let channelFirst: boolean; // data[c * numCandidates + n]
  let numCandidates: number;

  if (dims.length === 3 && dims[1] === numClasses + 4) {
    channelFirst = true;
    numCandidates = dims[2];
  } else if (dims.length === 3 && dims[2] === numClasses + 4) {
    channelFirst = false;
    numCandidates = dims[1];
  } else if (dims.length === 2 && dims[0] === numClasses + 4) {
    channelFirst = true;
    numCandidates = dims[1];
  } else if (dims.length === 2 && dims[1] === numClasses + 4) {
    channelFirst = false;
    numCandidates = dims[0];
  } else {
    // best-effort: treat as [1, C, N] if first dim==1
    if (dims[0] === 1) {
      channelFirst = true;
      numCandidates = dims.length >= 3 ? dims[2] : 1;
    } else {
      channelFirst = false;
      numCandidates = dims.length >= 2 ? dims[1] : 1;
    }
  }

  const channelStride = numClasses + 4;
  const candidates: Candidate[] = [];

  // Census + one-shot static-test diagnostics over ALL candidates.
  let maxScore = -Infinity;
  let minScore = Infinity;
  let boxCxMin = Infinity;
  let boxCxMax = -Infinity;
  let boxCyMin = Infinity;
  let boxCyMax = -Infinity;
  let boxWMin = Infinity;
  let boxWMax = -Infinity;
  let boxHMin = Infinity;
  let boxHMax = -Infinity;
  const samples: string[] = [];

  for (let n = 0; n < numCandidates; n++) {
    const cx = channelFirst ? data[n] : data[n * channelStride + 0];
    const cy = channelFirst ? data[1 * numCandidates + n] : data[n * channelStride + 1];
    const w = channelFirst ? data[2 * numCandidates + n] : data[n * channelStride + 2];
    const h = channelFirst ? data[3 * numCandidates + n] : data[n * channelStride + 3];

    if (cx < boxCxMin) boxCxMin = cx;
    if (cx > boxCxMax) boxCxMax = cx;
    if (cy < boxCyMin) boxCyMin = cy;
    if (cy > boxCyMax) boxCyMax = cy;
    if (w < boxWMin) boxWMin = w;
    if (w > boxWMax) boxWMax = w;
    if (h < boxHMin) boxHMin = h;
    if (h > boxHMax) boxHMax = h;

    let bestClassIdx = 0;
    let bestScore = channelFirst ? data[(4 + 0) * numCandidates + n] : data[n * channelStride + 4 + 0];
    if (bestScore > maxScore) maxScore = bestScore;
    if (bestScore < minScore) minScore = bestScore;
    for (let c = 1; c < numClasses; c++) {
      const score = channelFirst ? data[(4 + c) * numCandidates + n] : data[n * channelStride + 4 + c];
      if (score > bestScore) {
        bestScore = score;
        bestClassIdx = c;
      }
      if (score > maxScore) maxScore = score;
      if (score < minScore) minScore = score;
    }

    if (n === 0 || n === 100 || n === 1000) {
      samples.push(
        `candidate ${n}: cx=${cx.toFixed(3)} cy=${cy.toFixed(3)} w=${w.toFixed(3)} h=${h.toFixed(3)} ` +
        `bestClass=${classNames[bestClassIdx] ?? bestClassIdx} bestScore=${bestScore.toFixed(4)}`,
      );
    }

    // Class scores are probabilities in [0,1] — sigmoid is already baked into
    // the exported model graph (verified on official yolov8n.onnx: max 0.890).
    // Do NOT sigmoid again, and NEVER silently clamp invalid values — surface them.
    if (bestScore < 0 || bestScore > 1) {
      if (!decodeErrorLogged) {
        decodeErrorLogged = true;
        yoloWarn(
          `DECODE ERROR: class confidences must be probabilities in [0,1] but got ${bestScore} ` +
          `(candidate ${n}). Tensor layout/indexing is wrong.`,
        );
      }
      continue;
    }
    if (bestScore < confidenceThreshold) continue;

    // box in model input pixel space, then undo letterbox to get source-normalized coords
    const rawX1 = (cx - w / 2 - transform.padX) / transform.scale;
    const rawY1 = (cy - h / 2 - transform.padY) / transform.scale;
    const rawX2 = (cx + w / 2 - transform.padX) / transform.scale;
    const rawY2 = (cy + h / 2 - transform.padY) / transform.scale;

    candidates.push({
      classIndex: bestClassIdx,
      confidence: bestScore,
      x1: rawX1 / srcWidth,
      y1: rawY1 / srcHeight,
      x2: rawX2 / srcWidth,
      y2: rawY2 / srcHeight,
    });
  }

  const nmsResult = nms(candidates, iouThreshold);
  const nmsKept = nmsResult.length;

  yoloLog(
    `output=${dims.join('x')} layout=${channelFirst ? 'channel-first' : 'channel-last'} raw=${numCandidates} ` +
    `score_range=[${minScore >= 0 ? minScore.toFixed(6) : '—'},${maxScore >= 0 ? maxScore.toFixed(6) : '—'}] ` +
    `box_range cx=[${boxCxMin.toFixed(1)},${boxCxMax.toFixed(1)}] cy=[${boxCyMin.toFixed(1)},${boxCyMax.toFixed(1)}] ` +
    `w=[${boxWMin.toFixed(1)},${boxWMax.toFixed(1)}] h=[${boxHMin.toFixed(1)},${boxHMax.toFixed(1)}] ` +
    `thr=${confidenceThreshold} passed=${candidates.length} nms=${nmsKept}`,
  );

  if (!staticTestDone) {
    staticTestDone = true;
    const ch = numCandidates;
    yoloLog('STATIC TEST (first frame) start');
    yoloLog(`  OUTPUT SHAPE: ${dims.join('x')} dtype=float32 flatSize=${data.length}`);
    yoloLog(`  RAW TENSOR flat[0..9]=[${Array.from(data.slice(0, 10), v => v.toFixed(4)).join(', ')}]`);
    yoloLog(`  RAW TENSOR flat[${ch}..${ch + 9}]=[${Array.from(data.slice(ch, ch + 10), v => v.toFixed(4)).join(', ')}]`);
    yoloLog(`  RAW TENSOR flat[${2 * ch}..${2 * ch + 9}]=[${Array.from(data.slice(2 * ch, 2 * ch + 10), v => v.toFixed(4)).join(', ')}]`);
    yoloLog(`  RAW TENSOR flat[${3 * ch}..${3 * ch + 9}]=[${Array.from(data.slice(3 * ch, 3 * ch + 10), v => v.toFixed(4)).join(', ')}]`);
    yoloLog(`  RAW TENSOR flat[${4 * ch}..${4 * ch + 9}]=[${Array.from(data.slice(4 * ch, 4 * ch + 10), v => v.toFixed(4)).join(', ')}]`);
    yoloLog(`  LAYOUT: ${channelFirst ? 'channel-first (candidate n => data[c*N + n])' : 'channel-last (candidate n => data[n*C + c])'}`);
    for (const s of samples) yoloLog(`  ${s}`);
    yoloLog(`  SCORE RANGE: min=${minScore >= 0 ? minScore.toFixed(6) : '—'} max=${maxScore >= 0 ? maxScore.toFixed(6) : '—'}`);
    yoloLog(`  BOX RANGE: cx=[${boxCxMin.toFixed(1)},${boxCxMax.toFixed(1)}] cy=[${boxCyMin.toFixed(1)},${boxCyMax.toFixed(1)}] w=[${boxWMin.toFixed(1)},${boxWMax.toFixed(1)}] h=[${boxHMin.toFixed(1)},${boxHMax.toFixed(1)}]`);
    yoloLog(`  THRESHOLD PASSED: ${candidates.length}`);
    yoloLog(`  AFTER NMS: ${nmsKept}`);
    const best = nmsResult[0]
      ? `class=${classNames[nmsResult[0].classIndex] ?? `class_${nmsResult[0].classIndex}`} ` +
        `confidence=${nmsResult[0].confidence.toFixed(3)} ` +
        `bbox=[${nmsResult[0].x1.toFixed(3)},${nmsResult[0].y1.toFixed(3)},${(nmsResult[0].x2 - nmsResult[0].x1).toFixed(3)},${(nmsResult[0].y2 - nmsResult[0].y1).toFixed(3)}]`
      : 'none';
    yoloLog(`  BEST DETECTION: ${best}`);
    yoloLog('STATIC TEST end');
  }

  return {
    detections: nmsResult.map(c => {
      const x = clamp(c.x1, 0, 1);
      const y = clamp(c.y1, 0, 1);
      return {
        classIndex: c.classIndex,
        className: classNames[c.classIndex] ?? `class_${c.classIndex}`,
        confidence: c.confidence,
        bbox: {
          x,
          y,
          width: clamp(c.x2, 0, 1) - x,
          height: clamp(c.y2, 0, 1) - y,
        },
      };
    }),
    rawCandidates: numCandidates,
    aboveThreshold: candidates.length,
    maxScore: maxScore >= 0 ? maxScore : 0,
    nmsKept,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}