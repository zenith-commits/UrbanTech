from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.services.event_service import EventService
from app.schemas.detection import EventCreate, EventUpdate, EventResponse, EventFilter, MapEventResponse

router = APIRouter()


@router.post("", response_model=EventResponse)
async def create_event(event: EventCreate, db: Session = Depends(get_db)):
    service = EventService(db)
    created = service.create_event(event)
    return created


@router.get("", response_model=List[EventResponse])
async def list_events(
    event_type: str = None,
    severity: str = None,
    status: str = None,
    bus_id: str = None,
    camera_id: int = None,
    start_time: str = None,
    end_time: str = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    from datetime import datetime
    from app.schemas.detection import EventType, Severity, EventStatus
    
    filters = EventFilter()
    if event_type:
        filters.event_type = EventType(event_type)
    if severity:
        filters.severity = Severity(severity)
    if status:
        filters.status = EventStatus(status)
    if bus_id:
        filters.bus_id = bus_id
    if camera_id:
        filters.camera_id = camera_id
    if start_time:
        filters.start_time = datetime.fromisoformat(start_time)
    if end_time:
        filters.end_time = datetime.fromisoformat(end_time)
    filters.limit = limit
    filters.offset = offset
    
    service = EventService(db)
    events = service.get_events(filters)
    return events


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(event_id: str, db: Session = Depends(get_db)):
    service = EventService(db)
    event = service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.patch("/{event_id}", response_model=EventResponse)
async def update_event(event_id: str, update: EventUpdate, db: Session = Depends(get_db)):
    service = EventService(db)
    event = service.update_event(event_id, update)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.get("/map/events", response_model=MapEventResponse)
async def get_map_events(
    bus_id: str = None,
    event_type: str = None,
    severity: str = None,
    limit: int = 500,
    db: Session = Depends(get_db)
):
    service = EventService(db)
    return service.get_map_events(bus_id=bus_id, event_type=event_type, severity=severity, limit=limit)


@router.delete("", response_model=dict)
async def clear_events(
    bus_id: str = None,
    db: Session = Depends(get_db)
):
    service = EventService(db)
    deleted_count = service.clear_events(bus_id=bus_id)
    return {"status": "success", "deleted_count": deleted_count}