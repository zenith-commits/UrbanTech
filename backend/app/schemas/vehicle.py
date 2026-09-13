from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field
from enum import Enum


class VehicleType(str, Enum):
    car = "car"
    motorcycle = "motorcycle"
    bus = "bus"
    truck = "truck"
    bicycle = "bicycle"
    person = "person"


class VehicleDetectionCreate(BaseModel):
    tracking_id: int
    vehicle_type: VehicleType
    confidence: float = Field(..., ge=0, le=1)
    camera_id: Optional[int] = None
    bus_id: str = Field(..., max_length=50)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    license_plate: Optional[str] = None
    plate_confidence: Optional[float] = Field(None, ge=0, le=1)


class VehicleDetectionResponse(BaseModel):
    id: int
    tracking_id: int
    vehicle_type: VehicleType
    confidence: float
    camera_id: Optional[int]
    bus_id: str
    latitude: Optional[float]
    longitude: Optional[float]
    timestamp: datetime
    license_plate: Optional[str]
    plate_confidence: Optional[float]

    class Config:
        from_attributes = True


class LiveVehicleCounts(BaseModel):
    bus_id: str
    total: int
    cars: int
    motorcycles: int
    buses: int
    trucks: int
    bicycles: int
    pedestrians: int
    timestamp: datetime


class CongestionResponse(BaseModel):
    bus_id: str
    vehicle_count: int
    density: str
    congestion_score: float
    timestamp: datetime
    note: str = "Prototype analytics - not production grade"


class ANPRRequest(BaseModel):
    bus_id: str = Field(..., max_length=50)
    camera_id: Optional[int] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


class ANPRResponse(BaseModel):
    plate: Optional[str]
    confidence: float
    timestamp: datetime
    latitude: Optional[float]
    longitude: Optional[float]
    status: str


class FleetBusResponse(BaseModel):
    bus_id: str
    status: str
    gps: Optional[dict] = None
    speed: Optional[float] = None
    heading: Optional[float] = None
    camera_status: str
    latest_event: Optional[dict] = None
    detection_count: int


class FleetResponse(BaseModel):
    buses: List[FleetBusResponse]