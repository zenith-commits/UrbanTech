from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models import GPSPosition, Camera
from app.schemas.gps import GPSUpdate, GPSResponse, GPSHistoryResponse
from app.websocket.manager import manager
import logging

logger = logging.getLogger(__name__)


class GPSService:
    def __init__(self, db: Session):
        self.db = db

    def update_position(self, gps_data: GPSUpdate) -> GPSPosition:
        camera = None
        if gps_data.camera_id:
            camera = self.db.query(Camera).filter(Camera.id == gps_data.camera_id).first()
        
        position = GPSPosition(
            bus_id=gps_data.bus_id,
            camera_id=camera.id if camera else None,
            latitude=gps_data.latitude,
            longitude=gps_data.longitude,
            altitude=gps_data.altitude,
            speed=gps_data.speed,
            heading=gps_data.heading,
            timestamp=datetime.utcnow()
        )
        self.db.add(position)
        self.db.commit()
        self.db.refresh(position)
        
        logger.info(f"GPS updated for bus {gps_data.bus_id}: {gps_data.latitude}, {gps_data.longitude}")
        
        # Broadcast GPS update via WebSocket
        try:
            import asyncio
            asyncio.create_task(manager.send_gps_update(gps_data.bus_id, {
                "latitude": gps_data.latitude,
                "longitude": gps_data.longitude,
                "speed": gps_data.speed,
                "heading": gps_data.heading,
                "timestamp": position.timestamp.isoformat(),
                "source": "real"
            }))
        except Exception as e:
            logger.warning(f"Failed to broadcast GPS via WebSocket: {e}")
        
        return position

    def get_latest(self, bus_id: str) -> Optional[GPSPosition]:
        return self.db.query(GPSPosition).filter(
            GPSPosition.bus_id == bus_id
        ).order_by(desc(GPSPosition.timestamp)).first()

    def get_history(self, bus_id: str, hours: int = 24, limit: int = 1000) -> List[GPSPosition]:
        since = datetime.utcnow() - timedelta(hours=hours)
        return self.db.query(GPSPosition).filter(
            GPSPosition.bus_id == bus_id,
            GPSPosition.timestamp >= since
        ).order_by(desc(GPSPosition.timestamp)).limit(limit).all()

    def get_latest_for_fleet(self, bus_ids: List[str]) -> dict:
        result = {}
        for bus_id in bus_ids:
            pos = self.get_latest(bus_id)
            if pos:
                result[bus_id] = {
                    "latitude": pos.latitude,
                    "longitude": pos.longitude,
                    "speed": pos.speed,
                    "heading": pos.heading,
                    "timestamp": pos.timestamp.isoformat()
                }
        return result