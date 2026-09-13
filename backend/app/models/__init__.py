import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.db.database import Base


class CameraType(str, enum.Enum):
    front = "front"
    rear = "rear"
    side = "side"
    cabin = "cabin"


class EventType(str, enum.Enum):
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


class Severity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class EventStatus(str, enum.Enum):
    new = "new"
    verified = "verified"
    resolved = "resolved"


class VehicleType(str, enum.Enum):
    car = "car"
    motorcycle = "motorcycle"
    bus = "bus"
    truck = "truck"
    bicycle = "bicycle"
    person = "person"


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    camera_name = Column(String(100), nullable=False, unique=True)
    camera_type = Column(Enum(CameraType), nullable=False)
    bus_id = Column(String(50), nullable=False, index=True)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

    events = relationship("DetectionEvent", back_populates="camera")
    gps_positions = relationship("GPSPosition", back_populates="camera")
    vehicle_detections = relationship("VehicleDetection", back_populates="camera")


class GPSPosition(Base):
    __tablename__ = "gps_positions"

    id = Column(Integer, primary_key=True, index=True)
    bus_id = Column(String(50), nullable=False, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    altitude = Column(Float, nullable=True)
    speed = Column(Float, nullable=True)
    heading = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    camera = relationship("Camera", back_populates="gps_positions")

    __table_args__ = (
        Index("idx_gps_bus_time", "bus_id", "timestamp"),
    )


class DetectionEvent(Base):
    __tablename__ = "detection_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(50), unique=True, nullable=False, index=True, default=lambda: f"EVT-{uuid.uuid4().hex[:8].upper()}")
    event_type = Column(Enum(EventType), nullable=False, index=True)
    object_class = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=True)
    bus_id = Column(String(50), nullable=False, index=True)
    tracking_id = Column(Integer, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    severity = Column(Enum(Severity), default=Severity.low, index=True)
    status = Column(Enum(EventStatus), default=EventStatus.new, index=True)
    event_metadata = Column("metadata", Text, nullable=True)
    source = Column(String(20), default="real")

    camera = relationship("Camera", back_populates="events")

    __table_args__ = (
        Index("idx_event_bus_time", "bus_id", "timestamp"),
        Index("idx_event_type_severity", "event_type", "severity"),
    )


class VehicleDetection(Base):
    __tablename__ = "vehicle_detections"

    id = Column(Integer, primary_key=True, index=True)
    tracking_id = Column(Integer, nullable=False, index=True)
    vehicle_type = Column(Enum(VehicleType), nullable=False)
    confidence = Column(Float, nullable=False)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=True)
    bus_id = Column(String(50), nullable=False, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    license_plate = Column(String(20), nullable=True)
    plate_confidence = Column(Float, nullable=True)

    camera = relationship("Camera", back_populates="vehicle_detections")

    __table_args__ = (
        Index("idx_vehicle_bus_time", "bus_id", "timestamp"),
        Index("idx_vehicle_tracking", "tracking_id"),
    )

__all__ = [
    "Camera", "GPSPosition", "DetectionEvent", "VehicleDetection",
    "CameraType", "EventType", "Severity", "EventStatus", "VehicleType",
]