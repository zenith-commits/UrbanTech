from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class IncidentType(str, Enum):
    speeding = "speeding"
    wrong_way = "wrong_way"
    red_light_violation = "red_light_violation"
    illegal_parking = "illegal_parking"
    accident = "accident"
    hazardous_driving = "hazardous_driving"


class IncidentCreate(BaseModel):
    incident_type: IncidentType
    vehicle_tracking_id: Optional[int] = None
    license_plate: Optional[str] = None
    confidence: float = Field(..., ge=0, le=1)
    bus_id: str = Field(..., max_length=50)
    camera_id: Optional[int] = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    evidence_metadata: Optional[str] = None


class IncidentResponse(BaseModel):
    id: int
    incident_type: IncidentType
    vehicle_tracking_id: Optional[int]
    license_plate: Optional[str]
    confidence: float
    bus_id: str
    camera_id: Optional[int]
    latitude: float
    longitude: float
    timestamp: datetime
    evidence_metadata: Optional[str]

    class Config:
        from_attributes = True


class HeatmapPoint(BaseModel):
    latitude: float
    longitude: float
    intensity: float
    event_type: str


class HeatmapResponse(BaseModel):
    points: List[HeatmapPoint]