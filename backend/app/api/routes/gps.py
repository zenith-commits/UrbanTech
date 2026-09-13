from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.services.gps_service import GPSService
from app.schemas.gps import GPSUpdate, GPSResponse, GPSHistoryResponse

router = APIRouter()


@router.post("/update", response_model=GPSResponse)
async def update_gps(gps_data: GPSUpdate, db: Session = Depends(get_db)):
    service = GPSService(db)
    position = service.update_position(gps_data)
    return position


@router.get("/{bus_id}/latest", response_model=GPSResponse)
async def get_latest_gps(bus_id: str, db: Session = Depends(get_db)):
    service = GPSService(db)
    position = service.get_latest(bus_id)
    if not position:
        raise HTTPException(status_code=404, detail="No GPS data found for this bus")
    return position


@router.get("/{bus_id}/history", response_model=GPSHistoryResponse)
async def get_gps_history(bus_id: str, hours: int = 24, limit: int = 1000, db: Session = Depends(get_db)):
    service = GPSService(db)
    positions = service.get_history(bus_id, hours, limit)
    return GPSHistoryResponse(bus_id=bus_id, positions=positions)