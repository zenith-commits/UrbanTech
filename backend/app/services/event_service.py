from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_

from app.models import DetectionEvent, Camera
from app.schemas.detection import EventCreate, EventUpdate, EventResponse, EventFilter, MapEventResponse
from app.schemas.event import HeatmapPoint, HeatmapResponse
import logging

logger = logging.getLogger(__name__)


class EventService:
    def __init__(self, db: Session):
        self.db = db

    def create_event(self, event_data: EventCreate) -> DetectionEvent:
        event = DetectionEvent(
            event_type=event_data.event_type,
            object_class=event_data.object_class,
            confidence=event_data.confidence,
            camera_id=event_data.camera_id,
            bus_id=event_data.bus_id,
            tracking_id=event_data.tracking_id,
            latitude=event_data.latitude,
            longitude=event_data.longitude,
            severity=event_data.severity,
            metadata=event_data.metadata,
            source=event_data.source
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        logger.info(f"Created event: {event.event_id}")
        return event

    def get_event(self, event_id: str) -> Optional[DetectionEvent]:
        return self.db.query(DetectionEvent).filter(DetectionEvent.event_id == event_id).first()

    def get_events(self, filters: EventFilter) -> List[DetectionEvent]:
        query = self.db.query(DetectionEvent)
        
        if filters.event_type:
            query = query.filter(DetectionEvent.event_type == filters.event_type)
        if filters.severity:
            query = query.filter(DetectionEvent.severity == filters.severity)
        if filters.status:
            query = query.filter(DetectionEvent.status == filters.status)
        if filters.bus_id:
            query = query.filter(DetectionEvent.bus_id == filters.bus_id)
        if filters.camera_id:
            query = query.filter(DetectionEvent.camera_id == filters.camera_id)
        if filters.start_time:
            query = query.filter(DetectionEvent.timestamp >= filters.start_time)
        if filters.end_time:
            query = query.filter(DetectionEvent.timestamp <= filters.end_time)
        
        query = query.order_by(desc(DetectionEvent.timestamp))
        return query.offset(filters.offset).limit(filters.limit).all()

    def update_event(self, event_id: str, update: EventUpdate) -> Optional[DetectionEvent]:
        event = self.get_event(event_id)
        if not event:
            return None
        
        if update.status:
            event.status = update.status
        if update.severity:
            event.severity = update.severity
        
        self.db.commit()
        self.db.refresh(event)
        logger.info(f"Updated event {event_id}: status={event.status}, severity={event.severity}")
        return event

    def get_map_events(self, bus_id: Optional[str] = None, event_type: Optional[str] = None,
                       severity: Optional[str] = None, limit: int = 500) -> MapEventResponse:
        query = self.db.query(DetectionEvent).filter(
            DetectionEvent.latitude.isnot(None),
            DetectionEvent.longitude.isnot(None)
        )
        
        if bus_id:
            query = query.filter(DetectionEvent.bus_id == bus_id)
        if event_type:
            query = query.filter(DetectionEvent.event_type == event_type)
        if severity:
            query = query.filter(DetectionEvent.severity == severity)
        
        events = query.order_by(desc(DetectionEvent.timestamp)).limit(limit).all()
        
        event_list = []
        for e in events:
            event_list.append({
                "id": e.event_id,
                "type": e.event_type.value,
                "object_class": e.object_class,
                "latitude": e.latitude,
                "longitude": e.longitude,
                "severity": e.severity.value,
                "confidence": e.confidence,
                "timestamp": e.timestamp.isoformat(),
                "bus_id": e.bus_id,
                "status": e.status.value
            })
        
        return MapEventResponse(events=event_list)

    def get_heatmap_data(self, event_type: Optional[str] = None, 
                         severity: Optional[str] = None, limit: int = 1000) -> HeatmapResponse:
        query = self.db.query(DetectionEvent).filter(
            DetectionEvent.latitude.isnot(None),
            DetectionEvent.longitude.isnot(None)
        )
        
        if event_type:
            query = query.filter(DetectionEvent.event_type == event_type)
        if severity:
            query = query.filter(DetectionEvent.severity == severity)
        
        events = query.order_by(desc(DetectionEvent.timestamp)).limit(limit).all()
        
        points = []
        for e in events:
            intensity = 0.5
            if e.severity.value == "high":
                intensity = 0.8
            elif e.severity.value == "critical":
                intensity = 1.0
            elif e.severity.value == "medium":
                intensity = 0.5
            else:
                intensity = 0.3
            
            points.append(HeatmapPoint(
                latitude=e.latitude,
                longitude=e.longitude,
                intensity=intensity,
                event_type=e.event_type.value
            ))
        
        return HeatmapResponse(points=points)

    def clear_events(self, bus_id: Optional[str] = None) -> int:
        query = self.db.query(DetectionEvent)
        if bus_id:
            query = query.filter(DetectionEvent.bus_id == bus_id)
        
        deleted_count = query.delete()
        self.db.commit()
        logger.info(f"Cleared {deleted_count} events" + (f" for bus {bus_id}" if bus_id else ""))
        return deleted_count