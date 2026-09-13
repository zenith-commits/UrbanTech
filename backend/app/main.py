from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import logging
import json

from app.config import settings
from app.db.database import engine
from app.models import Base
from app.api.routes import health, gps, camera, events, vehicles, analytics, demo
from app.websocket.manager import manager

logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Urban Intelligence Platform backend...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified")
    yield
    logger.info("Shutting down backend...")


app = FastAPI(
    title="Urban Intelligence Platform API",
    description="AI-Powered Mobile Urban Intelligence Platform Using Public Transport Fleet - SIH 2026",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["Health"])
app.include_router(gps.router, prefix="/api/gps", tags=["GPS"])
app.include_router(camera.router, prefix="/api/camera", tags=["Camera"])
app.include_router(events.router, prefix="/api/events", tags=["Events"])
app.include_router(vehicles.router, prefix="/api/vehicles", tags=["Vehicles"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(demo.router, prefix="/api/demo", tags=["Demo"])


@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "subscribe":
                    bus_id = msg.get("bus_id")
                    if bus_id:
                        manager.subscribe_to_bus(websocket, bus_id)
                        await websocket.send_json({"type": "subscribed", "bus_id": bus_id})
                elif msg.get("type") == "unsubscribe":
                    bus_id = msg.get("bus_id")
                    if bus_id:
                        manager.unsubscribe_from_bus(websocket, bus_id)
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


@app.get("/")
async def root():
    return {
        "name": "Urban Intelligence Platform API",
        "version": "1.0.0",
        "description": "AI-Powered Mobile Urban Intelligence Platform Using Public Transport Fleet",
        "docs": "/docs",
        "websocket": "/ws/live"
    }