import asyncio
import httpx
import uvicorn
from app.main import app

async def test():
    config = uvicorn.Config(
        app, 
        host='127.0.0.1', 
        port=8000, 
        log_level='info', 
        loop='asyncio', 
        lifespan='on'
    )
    server = uvicorn.Server(config)
    server_task = asyncio.create_task(server.serve())
    
    await asyncio.sleep(2)
    
    try:
        async with httpx.AsyncClient() as client:
            # Test health
            r = await client.get('http://127.0.0.1:8000/health', timeout=5.0)
            print("Health:", r.json())
            
            # Test GPS update
            r = await client.post('http://127.0.0.1:8000/api/gps/update', json={
                "bus_id": "BUS-001",
                "latitude": 28.6139,
                "longitude": 77.2090,
                "speed": 25.0,
                "heading": 90
            }, timeout=5.0)
            print("GPS Update:", r.json())
            
            # Test latest GPS
            r = await client.get('http://127.0.0.1:8000/api/gps/BUS-001/latest', timeout=5.0)
            print("Latest GPS:", r.json())
            
            # Test event creation
            r = await client.post('http://127.0.0.1:8000/api/events', json={
                "event_type": "pothole",
                "object_class": "pothole",
                "confidence": 0.91,
                "bus_id": "BUS-001",
                "severity": "high",
                "latitude": 28.6139,
                "longitude": 77.2090
            }, timeout=5.0)
            print("Event Create:", r.json())
            
            # Test events list
            r = await client.get('http://127.0.0.1:8000/api/events?bus_id=BUS-001&limit=10', timeout=5.0)
            print("Events List:", r.json())
            
            # Test map events
            r = await client.get('http://127.0.0.1:8000/api/analytics/map/events?bus_id=BUS-001', timeout=5.0)
            print("Map Events:", r.json())
            
            # Test fleet
            r = await client.get('http://127.0.0.1:8000/api/vehicles/fleet', timeout=5.0)
            print("Fleet:", r.json())
            
            # Test vehicle counts
            r = await client.get('http://127.0.0.1:8000/api/vehicles/live/BUS-001?minutes=5', timeout=5.0)
            print("Vehicle Counts:", r.json())
            
            # Test congestion
            r = await client.get('http://127.0.0.1:8000/api/vehicles/congestion/BUS-001?minutes=5', timeout=5.0)
            print("Congestion:", r.json())
            
            # Test demo status
            r = await client.get('http://127.0.0.1:8000/api/demo/status', timeout=5.0)
            print("Demo Status:", r.json())
            
            # Test camera frame (simulated)
            import cv2
            import numpy as np
            img = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.rectangle(img, (100, 150), (300, 350), (0, 255, 0), -1)
            _, buffer = cv2.imencode('.jpg', img)
            
            files = {"file": ("test.jpg", buffer.tobytes(), "image/jpeg")}
            data = {"bus_id": "BUS-001", "camera_id": "1", "latitude": "28.6139", "longitude": "77.2090"}
            r = await client.post('http://127.0.0.1:8000/api/camera/frame', files=files, data=data, timeout=30.0)
            print("Camera Frame:", r.json())
            
    except Exception as e:
        print("Error:", e)
    finally:
        server_task.cancel()
        try:
            await server_task
        except asyncio.CancelledError:
            pass

asyncio.run(test())