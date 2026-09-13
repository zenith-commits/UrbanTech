from datetime import datetime, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models import VehicleDetection, DetectionEvent, GPSPosition, Camera
from app.schemas.vehicle import LiveVehicleCounts, CongestionResponse, FleetBusResponse, FleetResponse, VehicleType
import logging

logger = logging.getLogger(__name__)


class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db

    def get_live_vehicle_counts(self, bus_id: str, minutes: int = 5) -> LiveVehicleCounts:
        since = datetime.utcnow() - timedelta(minutes=minutes)
        
        detections = self.db.query(VehicleDetection).filter(
            VehicleDetection.bus_id == bus_id,
            VehicleDetection.timestamp >= since
        ).all()
        
        counts = {vt.value: 0 for vt in VehicleType}
        total = 0
        
        for det in detections:
            vtype = det.vehicle_type.value if det.vehicle_type else "unknown"
            if vtype in counts:
                counts[vtype] += 1
            total += 1
        
        return LiveVehicleCounts(
            bus_id=bus_id,
            total=total,
            cars=counts.get("car", 0),
            motorcycles=counts.get("motorcycle", 0),
            buses=counts.get("bus", 0),
            trucks=counts.get("truck", 0),
            bicycles=counts.get("bicycle", 0),
            pedestrians=counts.get("person", 0),
            timestamp=datetime.utcnow()
        )

    def get_congestion(self, bus_id: str, minutes: int = 5) -> CongestionResponse:
        counts = self.get_live_vehicle_counts(bus_id, minutes)
        
        if counts.total >= 30:
            density = "high"
            score = min(0.9, 0.5 + counts.total * 0.01)
        elif counts.total >= 15:
            density = "medium"
            score = min(0.7, 0.3 + counts.total * 0.01)
        else:
            density = "low"
            score = counts.total * 0.02
        
        return CongestionResponse(
            bus_id=bus_id,
            vehicle_count=counts.total,
            density=density,
            congestion_score=round(score, 2),
            timestamp=datetime.utcnow()
        )

    def get_fleet_status(self) -> FleetResponse:
        buses = self.db.query(GPSPosition.bus_id).distinct().all()
        bus_ids = [b[0] for b in buses]
        
        fleet_buses = []
        for bus_id in bus_ids:
            latest_gps = self.db.query(GPSPosition).filter(
                GPSPosition.bus_id == bus_id
            ).order_by(GPSPosition.timestamp.desc()).first()
            
            latest_event = self.db.query(DetectionEvent).filter(
                DetectionEvent.bus_id == bus_id
            ).order_by(DetectionEvent.timestamp.desc()).first()
            
            detection_count = self.db.query(DetectionEvent).filter(
                DetectionEvent.bus_id == bus_id
            ).count()
            
            cameras = self.db.query(Camera).filter(Camera.bus_id == bus_id).all()
            camera_status = "active" if any(c.status == "active" for c in cameras) else "inactive"
            
            fleet_buses.append(FleetBusResponse(
                bus_id=bus_id,
                status="active" if latest_gps else "inactive",
                gps={
                    "latitude": latest_gps.latitude,
                    "longitude": latest_gps.longitude,
                    "timestamp": latest_gps.timestamp.isoformat()
                } if latest_gps else None,
                speed=latest_gps.speed if latest_gps else None,
                heading=latest_gps.heading if latest_gps else None,
                camera_status=camera_status,
                latest_event={
                    "event_id": latest_event.event_id,
                    "type": latest_event.event_type.value,
                    "severity": latest_event.severity.value,
                    "timestamp": latest_event.timestamp.isoformat()
                } if latest_event else None,
                detection_count=detection_count
            ))
        
        return FleetResponse(buses=fleet_buses)

    def get_bus_detail(self, bus_id: str) -> Optional[FleetBusResponse]:
        latest_gps = self.db.query(GPSPosition).filter(
            GPSPosition.bus_id == bus_id
        ).order_by(GPSPosition.timestamp.desc()).first()
        
        if not latest_gps:
            return None
        
        latest_event = self.db.query(DetectionEvent).filter(
            DetectionEvent.bus_id == bus_id
        ).order_by(DetectionEvent.timestamp.desc()).first()
        
        detection_count = self.db.query(DetectionEvent).filter(
            DetectionEvent.bus_id == bus_id
        ).count()
        
        cameras = self.db.query(Camera).filter(Camera.bus_id == bus_id).all()
        camera_status = "active" if any(c.status == "active" for c in cameras) else "inactive"
        
        return FleetBusResponse(
            bus_id=bus_id,
            status="active",
            gps={
                "latitude": latest_gps.latitude,
                "longitude": latest_gps.longitude,
                "timestamp": latest_gps.timestamp.isoformat()
            },
            speed=latest_gps.speed,
            heading=latest_gps.heading,
            camera_status=camera_status,
            latest_event={
                "event_id": latest_event.event_id,
                "type": latest_event.event_type.value,
                "severity": latest_event.severity.value,
                "timestamp": latest_event.timestamp.isoformat()
            } if latest_event else None,
            detection_count=detection_count
        )