/**
 * ObjectDetector: wraps an ONNX Runtime Web session for one model config.
 * Runs entirely in the browser (WebGPU when available, otherwise WASM) and
 * converts raw YOLOv8 output into canonical Detection[].
 *
 * Model discovery/loading happens through loadModelBuffer.
 */

import type { Detection } from '../types';
import type { ObjectModelConfig } from './modelConfig';
import { loadModelBuffer } from './modelLoader';
import {
  createPreprocessBuffers,
  preprocessFrame,
  yoloV8Postprocess,
  type PreprocessBuffers,
} from './yolo';

let detectionCounter = 0;

const isDev = import.meta.env.DEV;
function aiLog(...args: unknown[]) {
  if (isDev) console.log('[AI]', ...args);
}
function aiWarn(...args: unknown[]) {
  if (isDev) console.warn('[AI]', ...args);
}

function nextTrackingId(): number {
  detectionCounter = (detectionCounter % 9000) + 1;
  return detectionCounter;
}

function makeId(base = 'det'): string {
  return `${base}_${Date.now()}_${detectionCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

export interface ObjectDetectorStatus {
  state: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  backend: 'webgpu' | 'wasm' | 'none';
}

export interface DetectResult {
  detections: Detection[];
  rawCandidates: number;
  aboveThreshold: number;
  maxScore: number;
  nmsKept: number;
}

export type OrtModule = typeof import('onnxruntime-web');

export class ObjectDetector {
  readonly config: ObjectModelConfig;

  private ort: OrtModule | null = null;
  private session: import('onnxruntime-web').InferenceSession | null = null;
  private buffers: PreprocessBuffers | null = null;
  private disposed = false;

  status: ObjectDetectorStatus = { state: 'idle', backend: 'none' };
  lastName = '';

  constructor(config: ObjectModelConfig) {
    this.config = config;
  }

  get isReady(): boolean {
    return this.session !== null && this.ort !== null;
  }

  async load(): Promise<void> {
    if (this.disposed) return;
    this.status = { state: 'loading', backend: this.status.backend };

    try {
      aiLog(`model load start: ${this.config.label} (${this.config.defaultPath})`);
      const { buffer, source, localAvailable } = await loadModelBuffer(this.config);
      aiLog(`model fetched: ${this.config.fileName} source=${source} local=${localAvailable} bytes=${buffer.byteLength}`);
      if (this.disposed) return;

      let created = false;
      let ortModule: OrtModule | null = null;

      // Try WebGPU first, then fall back to WASM.
      const useWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
      aiLog(`backend candidates: webgpu=${useWebGpu}, wasm=always`);
      if (useWebGpu) {
        try {
          ortModule = await import('onnxruntime-web/webgpu');
          const session = await ortModule.InferenceSession.create(buffer, {
            executionProviders: ['webgpu'],
          });
          this.ort = ortModule;
          this.session = session;
          this.status = { state: 'ready', backend: 'webgpu' };
          created = true;
          aiLog('session created with WebGPU backend');
        } catch (e) {
          aiWarn('WebGPU session creation failed, falling back to WASM:', e instanceof Error ? e.message : e);
          ortModule = null;
          this.session = null;
        }
      }

      if (!created) {
        ortModule = await import('onnxruntime-web');
        const session = await ortModule.InferenceSession.create(buffer, {
          executionProviders: ['wasm'],
        });
        this.ort = ortModule;
        this.session = session;
        this.status = { state: 'ready', backend: 'wasm' };
        aiLog('session created with WASM backend');
      }

      this.buffers = createPreprocessBuffers(this.config.inputSize);
      this.lastName = this.session?.inputNames[0] ?? '';
      aiLog(
        `model loaded: input="${this.lastName}" inputSize=${this.config.inputSize} ` +
        `outputs=${JSON.stringify(this.session?.outputNames)} backend=${this.status.backend}`,
      );
    } catch (error) {
      aiWarn('model load FAILED:', error instanceof Error ? error.message : error);
      this.status = {
        state: 'error',
        backend: 'none',
        error: error instanceof Error ? error.message : String(error),
      };
      this.session = null;
      this.ort = null;
      throw error;
    }
  }

  /**
   * Run one inference pass on the current video frame.
   * Returns canonical detections with source-frame normalized bounding boxes.
   */
  async detect(
    video: HTMLVideoElement,
    confidenceThreshold: number,
  ): Promise<DetectResult> {
    if (this.disposed || !this.session || !this.ort || !this.buffers) {
      return { detections: [], rawCandidates: 0, aboveThreshold: 0, maxScore: 0, nmsKept: 0 };
    }

    const inputName = this.lastName;
    const t0 = performance.now();

    const { data: tensorData, transform } = preprocessFrame(video, this.buffers, this.config.inputSize);
    aiLog(`inference started: frame=${video.videoWidth}x${video.videoHeight} tensor=${tensorData.length} floats`);

    const tensor = new this.ort.Tensor('float32', tensorData, [
      1,
      3,
      this.config.inputSize,
      this.config.inputSize,
    ]);

    const results = await this.session.run({ [inputName]: tensor });
    const outputKey = this.session.outputNames[0] ?? Object.keys(results)[0];
    const outputTensor = results[outputKey];
    const inferenceMs = performance.now() - t0;
    aiLog(`inference completed: ${Math.round(inferenceMs)}ms output="${outputKey}" dims=[${outputTensor.dims.join(',')}] size=${outputTensor.data.length}`);

    const post = yoloV8Postprocess(
      {
        dims: outputTensor.dims,
        data: outputTensor.data as Float32Array,
      },
      transform,
      video.videoWidth,
      video.videoHeight,
      this.config.classNameList,
      confidenceThreshold,
      0.45,
    );

    // dispose resources
    try {
      if (typeof outputTensor.dispose === 'function') outputTensor.dispose();
    } catch {
      // no-op
    }
    tensor.dispose();

    const now = Date.now();
    const trackingStart = nextTrackingId();
    const mapped = post.detections.map((d, index) => ({
      id: makeId('det'),
      className: d.className,
      confidence: Math.round(d.confidence * 100) / 100,
      bbox: d.bbox,
      trackingId: trackingStart + index,
      timestamp: now,
    }));

    const personCount = mapped.filter(d => d.className === 'person').length;
    aiLog(
      `detections: ${mapped.length} person=${personCount} raw=${post.rawCandidates} passed=${post.aboveThreshold} nms=${post.nmsKept} ` +
      `[${mapped.slice(0, 8).map(d => `${d.className}:${Math.round(d.confidence * 100)}%`).join(', ')}]`,
    );
    return {
      detections: mapped,
      rawCandidates: post.rawCandidates,
      aboveThreshold: post.aboveThreshold,
      maxScore: post.maxScore,
      nmsKept: post.nmsKept,
    };
  }

  dispose(): void {
    this.disposed = true;
    this.session = null;
    this.ort = null;
    this.buffers = null;
    this.status = { state: 'idle', backend: 'none' };
  }
}