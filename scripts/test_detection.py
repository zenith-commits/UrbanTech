import asyncio
import httpx
import cv2
import numpy as np
from pathlib import Path
import sys

BASE_URL = "http://localhost:8000"


async def create_test_image():
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.rectangle(img, (100, 150), (300, 350), (0, 255, 0), -1)
    cv2.rectangle(img, (400, 200), (550, 400), (255, 0, 0), -1)
    cv2.putText(img, "TEST IMAGE", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    _, buffer = cv2.imencode('.jpg', img)
    return buffer.tobytes()


async def test_detection():
    print("Testing detection endpoint...")
    
    image_bytes = await create_test_image()
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        files = {"file": ("test.jpg", image_bytes, "image/jpeg")}
        data = {
            "bus_id": "BUS-001",
            "camera_id": "1",
            "latitude": "28.6139",
            "longitude": "77.2090"
        }
        
        response = await client.post(f"{BASE_URL}/api/camera/frame", files=files, data=data)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✓ Detection successful!")
            print(f"  Timestamp: {result['timestamp']}")
            print(f"  Source: {result['source']}")
            print(f"  Detections: {len(result['detections'])}")
            for det in result['detections']:
                print(f"    - {det['class_name']}: {det['confidence']:.2f} (tracking_id: {det['tracking_id']})")
            if result.get('gps'):
                print(f"  GPS: {result['gps']}")
        else:
            print(f"✗ Detection failed: {response.status_code}")
            print(response.text)


async def test_health():
    print("Testing health endpoint...")
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Health check passed: {data}")
        else:
            print(f"✗ Health check failed: {response.status_code}")


async def test_gps():
    print("Testing GPS endpoints...")
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/api/gps/update", json={
            "bus_id": "BUS-001",
            "latitude": 28.6139,
            "longitude": 77.2090,
            "speed": 25.0,
            "heading": 90
        })
        if response.status_code == 200:
            print(f"✓ GPS update successful")
        else:
            print(f"✗ GPS update failed: {response.status_code}")
        
        response = await client.get(f"{BASE_URL}/api/gps/BUS-001/latest")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Latest GPS: {data['latitude']}, {data['longitude']}")
        else:
            print(f"✗ Latest GPS failed: {response.status_code}")


async def test_events():
    print("Testing events endpoints...")
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/api/events", json={
            "event_type": "pothole",
            "object_class": "pothole",
            "confidence": 0.91,
            "bus_id": "BUS-001",
            "severity": "high",
            "latitude": 28.6139,
            "longitude": 77.2090
        })
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Event created: {data['event_id']}")
        else:
            print(f"✗ Event creation failed: {response.status_code}")
        
        response = await client.get(f"{BASE_URL}/api/events?bus_id=BUS-001&limit=10")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Events retrieved: {len(data)} events")
        else:
            print(f"✗ Events retrieval failed: {response.status_code}")
        
        response = await client.get(f"{BASE_URL}/api/analytics/map/events?bus_id=BUS-001")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Map events: {len(data['events'])} events")
        else:
            print(f"✗ Map events failed: {response.status_code}")


async def test_fleet():
    print("Testing fleet endpoints...")
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/api/vehicles/fleet")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Fleet: {len(data['buses'])} buses")
        else:
            print(f"✗ Fleet failed: {response.status_code}")


async def main():
    print("=" * 50)
    print("Urban Intelligence Platform - API Tests")
    print("=" * 50)
    
    await test_health()
    print()
    await test_gps()
    print()
    await test_events()
    print()
    await test_fleet()
    print()
    await test_detection()
    print()
    print("=" * 50)
    print("Tests completed")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())