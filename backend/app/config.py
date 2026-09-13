import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./urban_intelligence.db"
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000", "http://localhost:5174"]
    yolo_model: str = "yolo11n.pt"
    confidence_threshold: float = 0.50
    required_consecutive_frames: int = 2
    demo_mode: bool = False
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()