import json
import asyncio
from typing import Dict, List, Set
from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.bus_subscriptions: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, client_id: str = "default"):
        await websocket.accept()
        if client_id not in self.active_connections:
            self.active_connections[client_id] = set()
        self.active_connections[client_id].add(websocket)
        logger.info(f"WebSocket connected: {client_id}")

    def disconnect(self, websocket: WebSocket, client_id: str = "default"):
        if client_id in self.active_connections:
            self.active_connections[client_id].discard(websocket)
            if not self.active_connections[client_id]:
                del self.active_connections[client_id]
        logger.info(f"WebSocket disconnected: {client_id}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")

    async def broadcast(self, message: dict, channel: str = "general"):
        connections = self.active_connections.get(channel, set())
        disconnected = set()
        
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to {channel}: {e}")
                disconnected.add(connection)
        
        for conn in disconnected:
            self.disconnect(conn, channel)

    async def broadcast_to_bus(self, bus_id: str, message: dict):
        channel = f"bus:{bus_id}"
        await self.broadcast(message, channel)

    def subscribe_to_bus(self, websocket: WebSocket, bus_id: str):
        channel = f"bus:{bus_id}"
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)
        logger.info(f"Client subscribed to bus {bus_id}")

    def unsubscribe_from_bus(self, websocket: WebSocket, bus_id: str):
        channel = f"bus:{bus_id}"
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)

    async def send_gps_update(self, bus_id: str, gps_data: dict):
        message = {
            "type": "gps",
            "data": {
                "bus_id": bus_id,
                **gps_data
            }
        }
        await self.broadcast_to_bus(bus_id, message)

    async def send_detection(self, bus_id: str, detection_data: dict):
        message = {
            "type": "detection",
            "data": {
                "bus_id": bus_id,
                **detection_data
            }
        }
        await self.broadcast_to_bus(bus_id, message)

    async def send_event(self, bus_id: str, event_data: dict):
        message = {
            "type": "event",
            "data": {
                "bus_id": bus_id,
                **event_data
            }
        }
        await self.broadcast_to_bus(bus_id, message)

    async def send_vehicle_counts(self, bus_id: str, counts: dict):
        message = {
            "type": "vehicle_counts",
            "data": {
                "bus_id": bus_id,
                **counts
            }
        }
        await self.broadcast_to_bus(bus_id, message)

    async def send_congestion(self, bus_id: str, congestion_data: dict):
        message = {
            "type": "congestion",
            "data": {
                "bus_id": bus_id,
                **congestion_data
            }
        }
        await self.broadcast_to_bus(bus_id, message)


manager = ConnectionManager()