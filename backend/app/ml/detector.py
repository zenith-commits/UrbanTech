import cv2
import numpy as np
from typing import List, Optional, Dict, Any
from ultralytics import YOLO
import logging
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class DetectionResult:
    def __init__(self, class_name: str, confidence: float, bbox: List[float], tracking_id: Optional[int] = None):
        self.class_name = class_name
        self.confidence = confidence
        self.bbox = bbox  # [x1, y1, x2, y2]
        self.tracking_id = tracking_id


class YOLODetector:
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or settings.yolo_model
        self.model = None
        self.model_loaded = False
        self.demo_mode = settings.demo_mode
        self._load_model()

    def _load_model(self):
        try:
            self.model = YOLO(self.model_path)
            self.model_loaded = True
            logger.info(f"YOLO model loaded: {self.model_path}")
        except Exception as e:
            logger.warning(f"Failed to load YOLO model '{self.model_path}': {e}")
            logger.warning("Running in demo mode - no real AI detection available")
            self.model_loaded = False
            self.demo_mode = True

    def detect(self, frame: np.ndarray) -> List[DetectionResult]:
        if not self.model_loaded or self.demo_mode:
            return self._demo_detections(frame)

        try:
            results = self.model.track(frame, persist=True, verbose=False)
            detections = []

            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        class_id = int(box.cls[0]) if box.cls is not None else -1
                        class_name = self.model.names.get(class_id, "unknown") if self.model.names else "unknown"
                        confidence = float(box.conf[0]) if box.conf is not None else 0.0
                        
                        if confidence < settings.confidence_threshold:
                            continue

                        bbox = box.xyxy[0].tolist() if box.xyxy is not None else [0, 0, 0, 0]
                        tracking_id = int(box.id[0]) if box.id is not None else None

                        detections.append(DetectionResult(
                            class_name=class_name,
                            confidence=confidence,
                            bbox=bbox,
                            tracking_id=tracking_id
                        ))

            return detections
        except Exception as e:
            logger.error(f"Detection error: {e}")
            return []

    def _demo_detections(self, frame: np.ndarray) -> List[DetectionResult]:
        h, w = frame.shape[:2]
        return [
            DetectionResult("car", 0.94, [w*0.1, h*0.3, w*0.4, h*0.7], 1),
            DetectionResult("person", 0.87, [w*0.6, h*0.4, w*0.75, h*0.85], 2),
            DetectionResult("motorcycle", 0.82, [w*0.7, h*0.35, w*0.9, h*0.65], 3),
        ]

    def detect_anpr(self, frame: np.ndarray) -> Dict[str, Any]:
        if not self.model_loaded or self.demo_mode:
            return {
                "plate": None,
                "confidence": 0.0,
                "status": "not_detected",
                "note": "ANPR not available in demo mode"
            }

        try:
            results = self.model(frame, verbose=False)
            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        class_id = int(box.cls[0]) if box.cls is not None else -1
                        class_name = self.model.names.get(class_id, "") if self.model.names else ""
                        if "license" in class_name.lower() or "plate" in class_name.lower():
                            confidence = float(box.conf[0]) if box.conf is not None else 0.0
                            return {
                                "plate": "DETECTED_PLATE",
                                "confidence": confidence,
                                "status": "detected"
                            }
            return {
                "plate": None,
                "confidence": 0.0,
                "status": "not_detected"
            }
        except Exception as e:
            logger.error(f"ANPR detection error: {e}")
            return {
                "plate": None,
                "confidence": 0.0,
                "status": "error"
            }


detector = YOLODetector()