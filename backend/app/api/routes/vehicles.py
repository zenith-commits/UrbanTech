from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session
from typing import Optional
import cv2
import numpy as np

from app.db.database import get_db
from app.services.analytics_service import AnalyticsService
from app.services.detection_service import DetectionService
from app.ml.detector import detector
from app.schemas.vehicle import (
    LiveVehicleCounts, CongestionResponse, ANPRRequest, ANPRResponse,
    FleetResponse, FleetBusResponse
)

router = APIRouter()


@router.get("/live/{bus_id}", response_model=LiveVehicleCounts)
async def get_live_vehicle_counts(bus_id: str, minutes: int = 5, db: Session = Depends(get_db)):
    service = AnalyticsService(db)
    return service.get_live_vehicle_counts(bus_id, minutes)


@router.get("/congestion/{bus_id}", response_model=CongestionResponse)
async def get_congestion(bus_id: str, minutes: int = 5, db: Session = Depends(get_db)):
    service = AnalyticsService(db)
    return service.get_congestion(bus_id, minutes)


@router.post("/anpr", response_model=ANPRResponse)
async def detect_anpr(
    bus_id: str = Form(...),
    camera_id: Optional[int] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    frame_bytes = await file.read()
    nparr = np.frombuffer(frame_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image data")
    
    result = detector.detect_anpr(frame)
    
    return ANPRResponse(
        plate=result.get("plate"),
        confidence=result.get("confidence", 0.0),
        timestamp=__import__('datetime').datetime.utcnow(),
        latitude=latitude,
        longitude=longitude,
        status=result.get("status", "not_detected")
    )


@router.get("/fleet", response_model=FleetResponse)
async def get_fleet(db: Session = Depends(get_db)):
    service = AnalyticsService(db)
    return service.get_fleet_status()


@router.get("/fleet/{bus_id}", response_model=FleetBusResponse)
async def get_bus_detail(bus_id: str, db: Session = Depends(get_db)):
    service = AnalyticsService(db)
    bus = service.get_bus_detail(bus_id)
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    return bus