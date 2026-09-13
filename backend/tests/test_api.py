import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import get_db, Base
from app.models import Camera, GPSPosition, DetectionEvent, VehicleDetection

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health_endpoint(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "database" in data
    assert "ai_model" in data
    assert "websocket" in data


@pytest.mark.asyncio
async def test_gps_update(client):
    response = await client.post("/api/gps/update", json={
        "bus_id": "BUS-001",
        "latitude": 28.6139,
        "longitude": 77.2090,
        "altitude": 210,
        "speed": 24.5,
        "heading": 90
    })
    assert response.status_code == 200
    data = response.json()
    assert data["bus_id"] == "BUS-001"
    assert data["latitude"] == 28.6139
    assert data["longitude"] == 77.2090


@pytest.mark.asyncio
async def test_latest_gps(client):
    await client.post("/api/gps/update", json={
        "bus_id": "BUS-002",
        "latitude": 28.7041,
        "longitude": 77.1025,
        "speed": 30
    })
    response = await client.get("/api/gps/BUS-002/latest")
    assert response.status_code == 200
    data = response.json()
    assert data["bus_id"] == "BUS-002"


@pytest.mark.asyncio
async def test_gps_history(client):
    response = await client.get("/api/gps/BUS-001/history?hours=1&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert data["bus_id"] == "BUS-001"
    assert isinstance(data["positions"], list)


@pytest.mark.asyncio
async def test_create_camera(client):
    response = await client.post("/api/camera", json={
        "camera_name": "CAM-FRONT-01",
        "camera_type": "front",
        "bus_id": "BUS-001"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["camera_name"] == "CAM-FRONT-01"
    assert data["camera_type"] == "front"


@pytest.mark.asyncio
async def test_list_cameras(client):
    response = await client.get("/api/camera")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_create_event(client):
    response = await client.post("/api/events", json={
        "event_type": "pothole",
        "object_class": "pothole",
        "confidence": 0.85,
        "bus_id": "BUS-001",
        "severity": "high",
        "latitude": 28.6139,
        "longitude": 77.2090
    })
    assert response.status_code == 200
    data = response.json()
    assert data["event_type"] == "pothole"
    assert data["confidence"] == 0.85


@pytest.mark.asyncio
async def test_list_events(client):
    response = await client.get("/api/events?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_map_events(client):
    response = await client.get("/api/analytics/map/events?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "events" in data
    assert isinstance(data["events"], list)


@pytest.mark.asyncio
async def test_fleet_endpoint(client):
    response = await client.get("/api/vehicles/fleet")
    assert response.status_code == 200
    data = response.json()
    assert "buses" in data
    assert isinstance(data["buses"], list)


@pytest.mark.asyncio
async def test_vehicle_counts(client):
    response = await client.get("/api/vehicles/live/BUS-001?minutes=5")
    assert response.status_code == 200
    data = response.json()
    assert data["bus_id"] == "BUS-001"
    assert "total" in data


@pytest.mark.asyncio
async def test_congestion(client):
    response = await client.get("/api/vehicles/congestion/BUS-001?minutes=5")
    assert response.status_code == 200
    data = response.json()
    assert data["bus_id"] == "BUS-001"
    assert "congestion_score" in data


@pytest.mark.asyncio
async def test_demo_status(client):
    response = await client.get("/api/demo/status")
    assert response.status_code == 200
    data = response.json()
    assert "running" in data