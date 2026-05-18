import asyncio
import random
from typing import Dict, Optional, Set

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # store_id -> set of websockets
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, store_id: int):
        await websocket.accept()
        if store_id not in self.active_connections:
            self.active_connections[store_id] = set()
        self.active_connections[store_id].add(websocket)

    def disconnect(self, websocket: WebSocket, store_id: int):
        if store_id in self.active_connections:
            self.active_connections[store_id].discard(websocket)
            if not self.active_connections[store_id]:
                del self.active_connections[store_id]

    async def send_message(self, store_id: int, message: dict):
        if store_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[store_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.append(connection)

            for conn in disconnected:
                self.disconnect(conn, store_id)


class TrafficSimulator:
    def __init__(self, manager: ConnectionManager, real_store_ids: Optional[Set[int]] = None):
        self.manager = manager
        self.real_store_ids = real_store_ids or {1}
        self.real_traffic: Dict[int, int] = {}
        self.mock_traffic: Dict[int, int] = {}
        self.target_count = 30
        self.min_count = 20
        self.max_count = 40
        self.running = False
        self.task = None

    def is_real_store(self, store_id: int) -> bool:
        return store_id in self.real_store_ids

    def get_current_count(self, store_id: int) -> int:
        if self.is_real_store(store_id):
            return self.real_traffic.get(store_id, self.target_count)
        return self.mock_traffic.get(store_id, self.target_count)

    def get_connect_message(self, store_id: int) -> dict:
        if self.is_real_store(store_id):
            if store_id not in self.real_traffic:
                return self.no_data_message(store_id)
            return self.tick_message(store_id, self.real_traffic[store_id])

        if store_id not in self.mock_traffic:
            self.mock_traffic[store_id] = self._initial_count()
        return self.tick_message(store_id, self.mock_traffic[store_id])

    def update_real_count(self, store_id: int, current_people_count: int) -> bool:
        if not self.is_real_store(store_id):
            return False
        self.real_traffic[store_id] = current_people_count
        return True

    def tick_message(self, store_id: int, current_people_count: int) -> dict:
        return {
            "event": "TRAFFIC_TICK",
            "store_id": store_id,
            "data": {
                "current_people_count": current_people_count,
            },
        }

    def no_data_message(self, store_id: int) -> dict:
        return {
            "event": "TRAFFIC_NO_DATA",
            "store_id": store_id,
            "data": None,
        }


    def _initial_count(self) -> int:
        return random.randint(self.target_count - 3, self.target_count + 3)

    def _next_count(self, current_count: int) -> int:
        if current_count < self.min_count or current_count > self.max_count:
            return self._initial_count()

        if current_count < self.target_count - 3:
            delta = random.choice([0, 1, 1, 2])
        elif current_count > self.target_count + 3:
            delta = random.choice([-2, -1, -1, 0])
        else:
            delta = random.choice([-2, -1, 0, 0, 1, 2])

        return min(
            self.max_count,
            max(self.min_count, current_count + delta),
        )

    async def simulate_traffic(self):
        while self.running:
            await asyncio.sleep(1)

            for store_id in list(self.manager.active_connections.keys()):
                if self.is_real_store(store_id):
                    continue

                if store_id not in self.mock_traffic:
                    self.mock_traffic[store_id] = self._initial_count()

                new_count = self._next_count(self.mock_traffic[store_id])
                self.mock_traffic[store_id] = new_count

                await self.manager.send_message(
                    store_id,
                    self.tick_message(store_id, new_count),
                )

    def start(self):
        self.running = True
        self.task = asyncio.create_task(self.simulate_traffic())

    def stop(self):
        self.running = False
        if self.task:
            self.task.cancel()
