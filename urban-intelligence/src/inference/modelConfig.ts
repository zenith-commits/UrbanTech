// Model configuration registry.
//
// REAL camera AI loads an ONNX model from public/models/<fileName> and executes
// it entirely in the browser with ONNX Runtime Web (WASM or WebGPU backend).
//
// GENERAL_OBJECT_MODEL  -> replaced by the real file  public/models/yolov8n.onnx
//                          (auto-fetched from a public mirror when missing).
// POTHOLE_MODEL         -> requires the real file     public/models/pothole.onnx
//                          A generic COCO YOLO model cannot detect potholes, so
//                          pothole events are ONLY produced when this model is
//                          actually installed and running.

export type ModelId = 'general' | 'pothole';

export interface ObjectModelConfig {
  id: ModelId;
  label: string;
  fileName: string;
  /** Browser-served path of the local model file. */
  defaultPath: string;
  /** Fallback download source used when the local model file is missing. */
  remoteUrl: string;
  /** Square input resolution the exported model expects (letterbox input). */
  inputSize: number;
  classNameList: string[];
  isPothole: boolean;
}

// YOLOv8 (COCO) class labels, in model output order (index == class id).
export const COCO_CLASS_NAMES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
  'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
  'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
  'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear',
  'hair drier', 'toothbrush',
] as const;

const DEFAULT_GENERAL_REMOTE_URL =
  'https://github.com/ultralytics/assets/releases/download/v8.4.0/yolov8n.onnx';

function remoteOrEnv(envKey: string, fallback: string): string {
  const fromEnv = (import.meta.env && import.meta.env[envKey]) as string | undefined;
  return fromEnv && fromEnv.trim().length > 0 ? fromEnv.trim() : fallback;
}

export const GENERAL_OBJECT_MODEL: ObjectModelConfig = {
  id: 'general',
  label: 'GENERAL OBJECT DETECTION (YOLOv8n COCO)',
  fileName: 'yolov8n.onnx',
  defaultPath: '/models/yolov8n.onnx',
  remoteUrl: remoteOrEnv('VITE_GENERAL_MODEL_URL', DEFAULT_GENERAL_REMOTE_URL),
  inputSize: 640,
  classNameList: COCO_CLASS_NAMES as unknown as string[],
  isPothole: false,
};

export const POTHOLE_MODEL: ObjectModelConfig = {
  id: 'pothole',
  label: 'POTHOLE (custom-trained model)',
  fileName: 'pothole.onnx',
  defaultPath: '/models/pothole.onnx',
  remoteUrl: remoteOrEnv('VITE_POTHOLE_MODEL_URL', ''),
  inputSize: 640,
  classNameList: ['pothole'],
  isPothole: true,
};

export const OBJECT_MODELS: Record<ModelId, ObjectModelConfig> = {
  general: GENERAL_OBJECT_MODEL,
  pothole: POTHOLE_MODEL,
};

/** Checks whether an optional model file is actually served by the dev server. */
export async function checkModelAvailability(config: ObjectModelConfig): Promise<boolean> {
  try {
    const response = await fetch(config.defaultPath, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}