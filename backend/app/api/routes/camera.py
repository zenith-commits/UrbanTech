from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import cv2
import numpy as np

from app.db.database import get_db
from app.services.detection_service import DetectionService
from app.services.gps_service import GPSService
from app.models import Camera
from app.schemas.camera import CameraCreate, CameraResponse, CameraStatusUpdate
from app.schemas.detection import FrameDetectionResponse
from app.schemas.gps import GPSUpdate

router = APIRouter()


@router.post("", response_model=CameraResponse)
async def create_camera(camera: CameraCreate, db: Session = Depends(get_db)):
    existing = db.query(Camera).filter(Camera.camera_name == camera.camera_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Camera name already exists")
    
    db_camera = Camera(**camera.model_dump())
    db.add(db_camera)
    db.commit()
    db.refresh(db_camera)
    return db_camera


@router.get("", response_model=List[CameraResponse])
async def list_cameras(db: Session = Depends(get_db)):
    return db.query(Camera).all()


@router.get("/{camera_id}", response_model=CameraResponse)
async def get_camera(camera_id: int, db: Session = Depends(get_db)):
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    return camera


@router.patch("/{camera_id}/status", response_model=CameraResponse)
async def update_camera_status(camera_id: int, status_update: CameraStatusUpdate, db: Session = Depends(get_db)):
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    camera.status = status_update.status
    db.commit()
    db.refresh(camera)
    return camera


@router.post("/frame", response_model=FrameDetectionResponse)
async def process_frame(
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
    
    gps_service = GPSService(db)
    if latitude is not None and longitude is not None:
        gps_data = GPSUpdate(
            bus_id=bus_id,
            latitude=latitude,
            longitude=longitude,
            altitude=None,
            speed=None,
            heading=None
        )
        gps_service.update_position(gps_data)
    
    detection_service = DetectionService(db)
    result = detection_service.process_frame(
        frame_bytes=frame_bytes,
        bus_id=bus_id,
        camera_id=camera_id,
        latitude=latitude,
        longitude=longitude
    )
    
    return result