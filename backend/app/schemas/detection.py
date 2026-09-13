from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class EventType(str, Enum):
    vehicle = "vehicle"
    pedestrian = "pedestrian"
    pothole = "pothole"
    road_damage = "road_damage"
    waterlogging = "waterlogging"
    damaged_sign = "damaged_sign"
    missing_divider = "missing_divider"
    zebra_crossing = "zebra_crossing"
    congestion = "congestion"
    incident = "incident"


class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class EventStatus(str, Enum):
    new = "new"
    verified = "verified"
    resolved = "resolved"


class DetectionObject(BaseModel):
    class_name: str
    confidence: float = Field(..., ge=0, le=1)
    tracking_id: Optional[int] = None
    bbox: List[float] = Field(..., min_length=4, max_length=4)


class FrameDetectionRequest(BaseModel):
    bus_id: str = Field(..., max_length=50)
    camera_id: Optional[int] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    timestamp: Optional[datetime] = None


class FrameDetectionResponse(BaseModel):
    timestamp: datetime
    detections: List[DetectionObject]
    gps: Optional[dict] = None
    source: str = "real"


class EventCreate(BaseModel):
    event_type: EventType
    object_class: str
    confidence: float = Field(..., ge=0, le=1)
    camera_id: Optional[int] = None
    bus_id: str = Field(..., max_length=50)
    tracking_id: Optional[int] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    severity: Severity = Severity.low
    metadata: Optional[str] = None
    source: str = "real"


class EventUpdate(BaseModel):
    status: Optional[EventStatus] = None
    severity: Optional[Severity] = None


class EventResponse(BaseModel):
    event_id: str
    event_type: EventType
    object_class: str
    confidence: float
    camera_id: Optional[int]
    bus_id: str
    tracking_id: Optional[int]
    latitude: Optional[float]
    longitude: Optional[float]
    timestamp: datetime
    severity: Severity
    status: EventStatus
    event_metadata: Optional[str] = None
    source: str

    class Config:
        from_attributes = True


class EventFilter(BaseModel):
    event_type: Optional[EventType] = None
    severity: Optional[Severity] = None
    status: Optional[EventStatus] = None
    bus_id: Optional[str] = None
    camera_id: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    limit: int = Field(100, ge=1, le=1000)
    offset: int = Field(0, ge=0)


class MapEventResponse(BaseModel):
    events: List[dict]