from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class CameraType(str, Enum):
    front = "front"
    rear = "rear"
    side = "side"
    cabin = "cabin"


class CameraBase(BaseModel):
    camera_name: str = Field(..., max_length=100)
    camera_type: CameraType
    bus_id: str = Field(..., max_length=50)


class CameraCreate(CameraBase):
    pass


class CameraResponse(CameraBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class CameraStatusUpdate(BaseModel):
    status: str