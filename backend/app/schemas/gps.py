from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class GPSUpdate(BaseModel):
    bus_id: str = Field(..., max_length=50)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    altitude: Optional[float] = None
    speed: Optional[float] = Field(None, ge=0)
    heading: Optional[float] = Field(None, ge=0, le=360)
    camera_id: Optional[int] = None


class GPSResponse(BaseModel):
    id: int
    bus_id: str
    latitude: float
    longitude: float
    altitude: Optional[float]
    speed: Optional[float]
    heading: Optional[float]
    timestamp: datetime

    class Config:
        from_attributes = True


class GPSHistoryResponse(BaseModel):
    bus_id: str
    positions: List[GPSResponse]