from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.demo_service import DemoService

router = APIRouter()


@router.post("/start")
async def start_demo(db: Session = Depends(get_db)):
    demo_service = DemoService(db)
    await demo_service.start()
    return {"status": "started", "message": "Demo simulation started"}


@router.post("/stop")
async def stop_demo(db: Session = Depends(get_db)):
    demo_service = DemoService(db)
    await demo_service.stop()
    return {"status": "stopped", "message": "Demo simulation stopped"}


@router.get("/status")
async def demo_status(db: Session = Depends(get_db)):
    demo_service = DemoService(db)
    return demo_service.get_status()