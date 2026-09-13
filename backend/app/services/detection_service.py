from datetime import datetime
from typing import List, Optional, Dict, Any
import logging
import uuid
from collections import defaultdict
import numpy as np
import cv2

from app.config import settings
from app.ml.detector import detector, DetectionResult
from app.schemas.detection import (
    EventType, Severity, EventStatus,
    DetectionObject, FrameDetectionResponse
)
from app.schemas.gps import GPSResponse
from app.schemas.vehicle import VehicleType
from app.models import DetectionEvent, VehicleDetection, GPSPosition, Camera
from app.websocket.manager import manager
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class TemporalValidator:
    def __init__(self, required_frames: int = 2, min_confidence: float = 0.5):
        self.required_frames = required_frames
        self.min_confidence = min_confidence
        self.pending_events: Dict[str, List[Dict]] = defaultdict(list)

    def validate(self, event_type: EventType, object_class: str, confidence: float, 
                 bus_id: str, camera_id: Optional[int], latitude: Optional[float],
                 longitude: Optional[float]) -> Optional[Dict[str, Any]]:
        key = f"{bus_id}:{camera_id}:{object_class}"
        
        if confidence >= self.min_confidence:
            self.pending_events[key].append({
                "confidence": confidence,
                "timestamp": datetime.utcnow(),
                "latitude": latitude,
                "longitude": longitude
            })
        else:
            if key in self.pending_events:
                del self.pending_events[key]
            return None

        if len(self.pending_events[key]) >= self.required_frames:
            avg_confidence = sum(e["confidence"] for e in self.pending_events[key]) / len(self.pending_events[key])
            latest = self.pending_events[key][-1]
            del self.pending_events[key]
            
            severity = self._calculate_severity(event_type, avg_confidence)
            
            return {
                "event_type": event_type,
                "object_class": object_class,
                "confidence": avg_confidence,
                "severity": severity,
                "latitude": latest["latitude"],
                "longitude": latest["longitude"],
                "validated": True
            }
        
        return None

    def _calculate_severity(self, event_type: EventType, confidence: float) -> Severity:
        hazard_types = {EventType.pothole, EventType.road_damage, EventType.waterlogging, 
                       EventType.damaged_sign, EventType.missing_divider}
        
        if event_type in hazard_types:
            if confidence >= 0.8:
                return Severity.high
            elif confidence >= 0.6:
                return Severity.medium
            return Severity.low
        elif event_type == EventType.incident:
            return Severity.critical
        elif event_type == EventType.congestion:
            return Severity.medium
        return Severity.low


class DetectionService:
    def __init__(self, db: Session):
        self.db = db
        self.validator = TemporalValidator(
            required_frames=settings.required_consecutive_frames,
            min_confidence=settings.confidence_threshold
        )

    def process_frame(self, frame_bytes: bytes, bus_id: str, camera_id: Optional[int] = None,
                      latitude: Optional[float] = None, longitude: Optional[float] = None) -> FrameDetectionResponse:
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            raise ValueError("Invalid image data")

        detections = detector.detect(frame)
        timestamp = datetime.utcnow()
        detection_objects = []
        events_created = []

        for det in detections:
            det_obj = DetectionObject(
                class_name=det.class_name,
                confidence=det.confidence,
                tracking_id=det.tracking_id,
                bbox=det.bbox
            )
            detection_objects.append(det_obj)

            event_type = self._map_class_to_event_type(det.class_name)
            if event_type:
                validated = self.validator.validate(
                    event_type=event_type,
                    object_class=det.class_name,
                    confidence=det.confidence,
                    bus_id=bus_id,
                    camera_id=camera_id,
                    latitude=latitude,
                    longitude=longitude
                )
                if validated:
                    event = self._create_event(
                        bus_id=bus_id,
                        camera_id=camera_id,
                        tracking_id=det.tracking_id,
                        **validated
                    )
                    events_created.append(event)

            if det.class_name.lower() in [vt.value for vt in VehicleType]:
                self._create_vehicle_detection(
                    bus_id=bus_id,
                    camera_id=camera_id,
                    tracking_id=det.tracking_id,
                    vehicle_type=VehicleType(det.class_name.lower()),
                    confidence=det.confidence,
                    latitude=latitude,
                    longitude=longitude
                )

        gps_data = None
        if latitude is not None and longitude is not None:
            gps_data = {"latitude": latitude, "longitude": longitude}

        return FrameDetectionResponse(
            timestamp=timestamp,
            detections=detection_objects,
            gps=gps_data,
            source="demo" if detector.demo_mode else "real"
        )

    def _map_class_to_event_type(self, class_name: str) -> Optional[EventType]:
        mapping = {
            "person": EventType.pedestrian,
            "car": EventType.vehicle,
            "motorcycle": EventType.vehicle,
            "bus": EventType.vehicle,
            "truck": EventType.vehicle,
            "bicycle": EventType.vehicle,
            "pothole": EventType.pothole,
            "road_damage": EventType.road_damage,
            "waterlogging": EventType.waterlogging,
            "damaged_sign": EventType.damaged_sign,
            "missing_divider": EventType.missing_divider,
            "zebra_crossing": EventType.zebra_crossing,
        }
        return mapping.get(class_name.lower())

    def _create_event(self, bus_id: str, camera_id: Optional[int], tracking_id: Optional[int],
                      event_type: EventType, object_class: str, confidence: float,
                      severity: Severity, latitude: Optional[float], longitude: Optional[float],
                      validated: bool = False) -> DetectionEvent:
        event = DetectionEvent(
            event_type=event_type,
            object_class=object_class,
            confidence=confidence,
            camera_id=camera_id,
            bus_id=bus_id,
            tracking_id=tracking_id,
            latitude=latitude,
            longitude=longitude,
            severity=severity,
            status=EventStatus.new,
            event_metadata=f'{{"validated": {validated}}}',
            source="demo" if detector.demo_mode else "real"
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        logger.info(f"Created event: {event.event_id} - {event.event_type.value} (confidence: {confidence:.2f})")
        
        # Broadcast event via WebSocket
        try:
            import asyncio
            asyncio.create_task(manager.send_event(bus_id, {
                "event_id": event.event_id,
                "event_type": event_type.value,
                "object_class": object_class,
                "confidence": confidence,
                "severity": severity.value,
                "latitude": latitude,
                "longitude": longitude,
                "timestamp": event.timestamp.isoformat(),
                "source": event.source
            }))
        except Exception as e:
            logger.warning(f"Failed to broadcast event via WebSocket: {e}")
        
        return event

    def _create_vehicle_detection(self, bus_id: str, camera_id: Optional[int], tracking_id: Optional[int],
                                   vehicle_type: VehicleType, confidence: float,
                                   latitude: Optional[float], longitude: Optional[float]) -> VehicleDetection:
        vd = VehicleDetection(
            tracking_id=tracking_id or 0,
            vehicle_type=vehicle_type,
            confidence=confidence,
            camera_id=camera_id,
            bus_id=bus_id,
            latitude=latitude,
            longitude=longitude
        )
        self.db.add(vd)
        self.db.commit()
        return vd