/**
 * Model loader: resolves the ONNX buffer for a model config.
 * Order: 1) local served file (/models/<file>), 2) Cache Storage, 3) remote URL.
 */

import type { ObjectModelConfig } from './modelConfig';

const MODEL_CACHE_NAME = 'urbanai-onnx-models-v2';

async function fetchWithCache(url: string): Promise<ArrayBuffer> {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(MODEL_CACHE_NAME);
      const cached = await cache.match(url);
      if (cached) {
        const buffer = await cached.arrayBuffer();
        if (isPlausibleOnnx(buffer)) return buffer;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      void cache.put(url, response.clone());
      return await response.arrayBuffer();
    } catch {
      // fall through to plain fetch
    }
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return await response.arrayBuffer();
}

function isPlausibleOnnx(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 100 * 1024) return false;
  // Every ONNX protobuf starts with ir_version as field 1 varint (tag 0x08),
  // regardless of the version value (byte[1] is the version itself, e.g. 0x08).
  const view = new Uint8Array(buffer);
  return view[0] === 0x08 && view[1] < 0x80 && view[1] > 0;
}

export interface ModelLoadResult {
  buffer: ArrayBuffer;
  source: 'local' | 'remote-cache';
  localAvailable: boolean;
}

export async function loadModelBuffer(config: ObjectModelConfig): Promise<ModelLoadResult> {
  let localAvailable = false;

  // 1. Local file
  try {
    const resp = await fetch(config.defaultPath);
    if (resp.ok) {
      localAvailable = true;
      const buf = await resp.arrayBuffer();
      if (isPlausibleOnnx(buf)) {
        return { buffer: buf, source: 'local', localAvailable: true };
      }
      throw new Error(
        `${config.fileName} is served at ${config.defaultPath} but is not a valid ONNX file.`,
      );
    }
  } catch (e: unknown) {
    if (!(e instanceof Error) || !e.message.includes('not a valid ONNX')) {
      // local not available or other network error → try remote
    } else {
      throw e;
    }
  }

  // 2. Remote fallback
  const url = config.remoteUrl;
  if (!url || url.length === 0) {
    throw new Error(
      `Model ${config.fileName} not found at ${config.defaultPath}. ` +
        `Either place the ONNX file there or set VITE_GENERAL_MODEL_URL.`,
    );
  }

  const buffer = await fetchWithCache(url);
  if (isPlausibleOnnx(buffer)) {
    return { buffer, source: 'remote-cache', localAvailable };
  }

  throw new Error(`Remote file for ${config.fileName} is not a valid ONNX model.`);
}