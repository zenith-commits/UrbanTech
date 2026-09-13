from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.database import get_db
from app.ml.detector import detector
from app.config import settings

router = APIRouter()


@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    db_status = "disconnected"
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        pass

    return {
        "status": "ok",
        "database": db_status,
        "ai_model": "loaded" if detector.model_loaded else "not_loaded",
        "websocket": "ready",
        "demo_mode": settings.demo_mode
    }