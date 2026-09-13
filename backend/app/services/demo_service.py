import asyncio
import random
import math
from datetime import datetime
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
import logging

from app.models import GPSPosition, DetectionEvent, VehicleDetection, Camera
from app.schemas.detection import EventType, Severity, EventStatus
from app.schemas.vehicle import VehicleType
from app.websocket.manager import manager
from app.config import settings

logger = logging.getLogger(__name__)


class DemoService:
    def __init__(self, db: Session):
        self.db = db
        self.running = False
        self.tasks: List[asyncio.Task] = []
        self.bus_routes = {
            "BUS-001": {"lat": 28.6139, "lon": 77.2090, "speed": 25, "heading": 90},
            "BUS-002": {"lat": 28.7041, "lon": 77.1025, "speed": 30, "heading": 180},
            "BUS-003": {"lat": 28.5355, "lon": 77.3910, "speed": 20, "heading": 270},
        }
        self.event_types = [
            (EventType.vehicle, "car", Severity.low),
            (EventType.vehicle, "motorcycle", Severity.low),
            (EventType.vehicle, "bus", Severity.low),
            (EventType.vehicle, "truck", Severity.medium),
            (EventType.pedestrian, "person", Severity.low),
            (EventType.pothole, "pothole", Severity.high),
            (EventType.road_damage, "road_damage", Severity.medium),
            (EventType.waterlogging, "waterlogging", Severity.high),
            (EventType.damaged_sign, "damaged_sign", Severity.medium),
            (EventType.missing_divider, "missing_divider", Severity.medium),
        ]

    async def start(self):
        if self.running:
            return
        
        self.running = True
        self.tasks = [
            asyncio.create_task(self._simulate_gps()),
            asyncio.create_task(self._simulate_detections()),
            asyncio.create_task(self._simulate_events()),
        ]
        logger.info("Demo simulation started")

    async def stop(self):
        self.running = False
        for task in self.tasks:
            task.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)
        self.tasks = []
        logger.info("Demo simulation stopped")

    def get_status(self) -> Dict:
        return {
            "running": self.running,
            "buses": list(self.bus_routes.keys()),
            "tasks": len(self.tasks)
        }

    async def _simulate_gps(self):
        while self.running:
            for bus_id, route in self.bus_routes.items():
                route["lat"] += (random.random() - 0.5) * 0.001
                route["lon"] += (random.random() - 0.5) * 0.001
                route["speed"] = max(0, min(60, route["speed"] + (random.random() - 0.5) * 5))
                route["heading"] = (route["heading"] + (random.random() - 0.5) * 10) % 360
                
                gps = GPSPosition(
                    bus_id=bus_id,
                    latitude=route["lat"],
                    longitude=route["lon"],
                    altitude=random.uniform(200, 250),
                    speed=route["speed"],
                    heading=route["heading"],
                    timestamp=datetime.utcnow()
                )
                self.db.add(gps)
                
                await manager.send_gps_update(bus_id, {
                    "latitude": route["lat"],
                    "longitude": route["lon"],
                    "speed": route["speed"],
                    "heading": route["heading"],
                    "timestamp": datetime.utcnow().isoformat(),
                    "source": "simulation"
                })
            
            self.db.commit()
            await asyncio.sleep(2)

    async def _simulate_detections(self):
        while self.running:
            for bus_id in self.bus_routes.keys():
                detections = []
                num_detections = random.randint(0, 5)
                
                for _ in range(num_detections):
                    vtype = random.choice(list(VehicleType))
                    detections.append({
                        "class": vtype.value,
                        "confidence": round(random.uniform(0.6, 0.95), 2),
                        "tracking_id": random.randint(1, 100),
                        "bbox": [random.randint(0, 400), random.randint(0, 300), 
                                random.randint(400, 640), random.randint(300, 480)]
                    })
                
                if detections:
                    await manager.send_detection(bus_id, {
                        "detections": detections,
                        "timestamp": datetime.utcnow().isoformat(),
                        "source": "simulation"
                    })
                
                await manager.send_vehicle_counts(bus_id, {
                    "total": len(detections),
                    "cars": sum(1 for d in detections if d["class"] == "car"),
                    "motorcycles": sum(1 for d in detections if d["class"] == "motorcycle"),
                    "buses": sum(1 for d in detections if d["class"] == "bus"),
                    "trucks": sum(1 for d in detections if d["class"] == "truck"),
                    "bicycles": sum(1 for d in detections if d["class"] == "bicycle"),
                    "pedestrians": sum(1 for d in detections if d["class"] == "person"),
                    "timestamp": datetime.utcnow().isoformat(),
                    "source": "simulation"
                })
            
            await asyncio.sleep(3)

    async def _simulate_events(self):
        while self.running:
            for bus_id in self.bus_routes.keys():
                if random.random() < 0.3:
                    event_type, obj_class, severity = random.choice(self.event_types)
                    route = self.bus_routes[bus_id]
                    
                    event = DetectionEvent(
                        event_type=event_type,
                        object_class=obj_class,
                        confidence=round(random.uniform(0.6, 0.95), 2),
                        bus_id=bus_id,
                        latitude=route["lat"],
                        longitude=route["lon"],
                        severity=severity,
                        status=EventStatus.new,
                        source="simulation"
                    )
                    self.db.add(event)
                    self.db.commit()
                    self.db.refresh(event)
                    
                    await manager.send_event(bus_id, {
                        "event_id": event.event_id,
                        "event_type": event_type.value,
                        "object_class": obj_class,
                        "confidence": event.confidence,
                        "severity": severity.value,
                        "latitude": route["lat"],
                        "longitude": route["lon"],
                        "timestamp": event.timestamp.isoformat(),
                        "source": "simulation"
                    })
            
            await asyncio.sleep(5)