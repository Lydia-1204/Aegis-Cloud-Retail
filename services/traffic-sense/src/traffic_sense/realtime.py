import asyncio
import json
import random
from typing import Dict, Set
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
    def __init__(self, manager: ConnectionManager):
        self.manager = manager
        self.store_traffic: Dict[int, int] = {}
        self.running = False
        self.task = None

    def get_current_count(self, store_id: int) -> int:
        return self.store_traffic.get(store_id, 0)

    async def simulate_traffic(self):
        while self.running:
            await asyncio.sleep(1)  # 每秒更新一次
            
            # 为所有活跃的门店更新客流
            for store_id in list(self.manager.active_connections.keys()):
                if store_id not in self.store_traffic:
                    self.store_traffic[store_id] = 10  # 初始值
                
                # 模拟客流波动 (-2 到 +3)
                delta = random.randint(-2, 3)
                new_count = max(0, self.store_traffic[store_id] + delta)
                self.store_traffic[store_id] = new_count
                
                # 推送更新
                await self.manager.send_message(store_id, {
                    "event": "TRAFFIC_TICK",
                    "store_id": store_id,
                    "data": {
                        "current_people_count": new_count
                    }
                })

    def start(self):
        self.running = True
        self.task = asyncio.create_task(self.simulate_traffic())

    def stop(self):
        self.running = False
        if self.task:
            self.task.cancel()
