from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.analytics_service import AnalyticsService
from app.services.event_service import EventService
from app.schemas.event import HeatmapResponse

router = APIRouter()


@router.get("/map/events")
async def get_map_events(
    bus_id: str = None,
    event_type: str = None,
    severity: str = None,
    limit: int = 500,
    db: Session = Depends(get_db)
):
    service = EventService(db)
    return service.get_map_events(bus_id=bus_id, event_type=event_type, severity=severity, limit=limit)


@router.get("/map/buses")
async def get_map_buses(db: Session = Depends(get_db)):
    service = AnalyticsService(db)
    fleet = service.get_fleet_status()
    return {
        "buses": [
            {
                "bus_id": bus.bus_id,
                "latitude": bus.gps["latitude"] if bus.gps else None,
                "longitude": bus.gps["longitude"] if bus.gps else None,
                "speed": bus.speed,
                "heading": bus.heading,
                "status": bus.status
            }
            for bus in fleet.buses
        ]
    }


@router.get("/map/heatmap", response_model=HeatmapResponse)
async def get_heatmap(
    event_type: str = None,
    severity: str = None,
    limit: int = 1000,
    db: Session = Depends(get_db)
):
    service = EventService(db)
    return service.get_heatmap_data(event_type=event_type, severity=severity, limit=limit)