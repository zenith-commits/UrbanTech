# Urban Intelligence Platform - Backend

AI-Powered Mobile Urban Intelligence Platform Using Public Transport Fleet  
Smart India Hackathon 2026 - Problem Statement 26124  
Team Rocket

## Overview

This backend provides APIs for:
- Real-time object detection from bus-mounted cameras (YOLO)
- GPS tracking and position management
- Road hazard detection and event creation
- Live WebSocket updates for dashboard/frontend
- Vehicle analytics and congestion detection
- Fleet management
- Demo/simulation mode for prototype demonstrations

## Tech Stack

- **Python 3.11+**
- **FastAPI** - Web framework
- **PostgreSQL + PostGIS** - Database with geospatial support
- **Ultralytics YOLO** - Object detection
- **OpenCV** - Image processing
- **WebSockets** - Real-time updates

## Project Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI application entry point
│   ├── config.py               # Configuration management
│   ├── api/routes/             # API endpoints
│   │   ├── health.py           # Health check
│   │   ├── camera.py           # Camera & frame processing
│   │   ├── detection.py        # Detection events
│   │   ├── gps.py              # GPS positions
│   │   ├── vehicles.py         # Vehicle analytics & ANPR
│   │   ├── analytics.py        # Map & heatmap data
│   │   └── demo.py             # Demo simulation control
│   ├── models/                 # SQLAlchemy models
│   ├── schemas/                # Pydantic schemas
│   ├── services/               # Business logic
│   ├── ml/                     # ML detection (YOLO)
│   ├── db/                     # Database setup
│   └── websocket/              # WebSocket manager
├── tests/                      # Pytest tests
├── scripts/                    # Utility scripts
├── requirements.txt
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── run.py
```

## Quick Start (Windows)

### Option A: Local Python + Docker PostGIS (Recommended)

1. **Open terminal in project root:**
   ```cmd
   cd backend
   ```

2. **Create virtual environment:**
   ```cmd
   python -m venv .venv
   ```

3. **Activate environment:**
   ```cmd
   .venv\Scripts\activate
   ```

4. **Install dependencies:**
   ```cmd
   pip install -r requirements.txt
   ```

5. **Start PostgreSQL/PostGIS using Docker:**
   ```cmd
   docker compose up -d db
   ```

6. **Initialize database:**
   ```cmd
   python -m app.db.init_db
   ```

7. **Start FastAPI server:**
   ```cmd
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

8. **Open API docs:**
   ```
   http://localhost:8000/docs
   ```

### Option B: Full Docker

```cmd
docker compose up --build
```

## Environment Configuration

Copy `.env.example` to `.env` and modify:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/urban_intelligence
CORS_ORIGINS=["http://localhost:5173","http://localhost:3000","http://localhost:5174"]
YOLO_MODEL=yolo11n.pt
CONFIDENCE_THRESHOLD=0.50
REQUIRED_CONSECUTIVE_FRAMES=2
DEMO_MODE=false
LOG_LEVEL=INFO
```

## API Endpoints

### Health
- `GET /health` - System health check

### GPS
- `POST /api/gps/update` - Update bus GPS position
- `GET /api/gps/{bus_id}/latest` - Get latest GPS position
- `GET /api/gps/{bus_id}/history` - Get GPS history

### Camera & Detection
- `POST /api/camera` - Register camera
- `GET /api/camera` - List cameras
- `POST /api/camera/frame` - Process video frame (multipart/form-data)

### Events
- `POST /api/events` - Create detection event
- `GET /api/events` - List events with filters
- `GET /api/events/{event_id}` - Get event details
- `PATCH /api/events/{event_id}` - Update event status
- `GET /api/analytics/map/events` - Events for map display

### Vehicles & Analytics
- `GET /api/vehicles/live/{bus_id}` - Live vehicle counts
- `GET /api/vehicles/congestion/{bus_id}` - Congestion indicator
- `POST /api/vehicles/anpr` - License plate detection
- `GET /api/vehicles/fleet` - Fleet overview
- `GET /api/vehicles/fleet/{bus_id}` - Bus details

### Map Data
- `GET /api/analytics/map/events` - Events for GIS map
- `GET /api/analytics/map/buses` - Bus positions for map
- `GET /api/analytics/map/heatmap` - Event density heatmap

### Demo/Simulation
- `POST /api/demo/start` - Start simulation
- `POST /api/demo/stop` - Stop simulation
- `GET /api/demo/status` - Simulation status

### WebSocket
- `WS /ws/live` - Real-time updates
  - Send: `{"type": "subscribe", "bus_id": "BUS-001"}`
  - Receive: GPS, detections, events, vehicle counts, congestion

## Frontend Integration Contract

### Base URL
```
http://localhost:8000
```

### WebSocket
```
ws://localhost:8000/ws/live
```

### Sending Webcam Frames
```javascript
const formData = new FormData();
formData.append('file', videoFrameBlob);  // Blob from canvas.toBlob()
formData.append('bus_id', 'BUS-001');
formData.append('camera_id', '1');
formData.append('latitude', '28.6139');
formData.append('longitude', '77.2090');

const response = await fetch('http://localhost:8000/api/camera/frame', {
  method: 'POST',
  body: formData
});
const result = await response.json();
// result.detections = [{class_name, confidence, tracking_id, bbox}, ...]
```

### Sending GPS Coordinates
```javascript
await fetch('http://localhost:8000/api/gps/update', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    bus_id: 'BUS-001',
    latitude: 28.6139,
    longitude: 77.2090,
    speed: 25.5,
    heading: 90
  })
});
```

### Receiving Live Events (WebSocket)
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/live');
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  switch(msg.type) {
    case 'detection':
      // msg.data = {event_id, object_class, confidence, latitude, longitude}
      break;
    case 'event':
      // msg.data = {event_id, event_type, severity, latitude, longitude}
      break;
    case 'gps':
      // msg.data = {bus_id, latitude, longitude, speed, heading}
      break;
    case 'vehicle_counts':
      // msg.data = {bus_id, total, cars, motorcycles, ...}
      break;
    case 'congestion':
      // msg.data = {bus_id, vehicle_count, density, congestion_score}
      break;
  }
};

// Subscribe to specific bus
ws.send(JSON.stringify({type: 'subscribe', bus_id: 'BUS-001'}));
```

### Retrieving Event History
```javascript
const events = await fetch('http://localhost:8000/api/events?bus_id=BUS-001&limit=50').then(r => r.json());
```

### Retrieving Bus Locations
```javascript
const fleet = await fetch('http://localhost:8000/api/vehicles/fleet').then(r => r.json());
```

### Retrieving Heatmap Data
```javascript
const heatmap = await fetch('http://localhost:8000/api/analytics/map/heatmap?event_type=pothole').then(r => r.json());
// heatmap.points = [{latitude, longitude, intensity, event_type}, ...]
```

## Demo Mode

For prototype demonstrations without physical hardware:

1. Start demo simulation:
   ```bash
   curl -X POST http://localhost:8000/api/demo/start
   ```

2. This generates simulated:
   - GPS movement for multiple buses
   - Vehicle detections
   - Road hazard events
   - Congestion updates
   - All broadcasted via WebSocket

3. Stop demo:
   ```bash
   curl -X POST http://localhost:8000/api/demo/stop
   ```

All simulated data is marked with `"source": "simulation"`.

## Testing

Run unit tests:
```cmd
pytest tests/ -v
```

Run API integration test:
```cmd
python scripts/test_detection.py
```

## Database Models

### Camera
- id, camera_name, camera_type (front/rear/side/cabin), bus_id, status, created_at

### GPSPosition
- id, bus_id, camera_id, latitude, longitude, altitude, speed, heading, timestamp

### DetectionEvent
- id, event_id, event_type, object_class, confidence, camera_id, bus_id, tracking_id
- latitude, longitude, timestamp, severity, status, metadata, source

### VehicleDetection
- id, tracking_id, vehicle_type, confidence, camera_id, bus_id
- latitude, longitude, timestamp, license_plate, plate_confidence

## Important Notes

1. **No Fake AI**: The backend uses real YOLO detection. If model unavailable, runs in demo mode with clearly marked simulated data.

2. **Temporal Validation**: Events require consecutive frames above confidence threshold (configurable).

3. **ANPR**: Returns `plate: null, confidence: 0, status: "not_detected"` when no plate found - never fabricates plates.

4. **CORS**: Configured for frontend at localhost:5173, 3000, 5174.

5. **PostGIS**: Enabled for geospatial queries (heatmap, proximity searches).

## License

SIH 2026 - Team Rocket