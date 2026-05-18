import asyncio
import os

import httpx
import websockets
from fastapi import FastAPI, Request, Response, WebSocket
from fastapi.middleware.cors import CORSMiddleware


FOUNDATION_DATA_BASE = os.getenv("FOUNDATION_DATA_BASE_URL", "http://localhost:8081")
STORE_OPS_BASE = os.getenv("STORE_OPS_BASE_URL", "http://localhost:8082")
TRAFFIC_SENSE_BASE = os.getenv("TRAFFIC_SENSE_BASE_URL", "http://localhost:8083")
TRAFFIC_SENSE_WS_BASE = os.getenv("TRAFFIC_SENSE_WS_BASE_URL", "ws://localhost:8083")
AI_ASSISTANT_BASE = os.getenv("AI_ASSISTANT_BASE_URL", "http://localhost:8084")
CORS_ALLOW_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOW_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
    ).split(",")
    if origin.strip()
]

HTTP_ROUTES = (
    ("/edge/traffic/snapshot", TRAFFIC_SENSE_BASE),
    ("/edge/traffic/history-batch", TRAFFIC_SENSE_BASE),
    ("/api/ai/chat", AI_ASSISTANT_BASE),
    ("/api/ai/traffic", TRAFFIC_SENSE_BASE),
    ("/api/sales", STORE_OPS_BASE),
    ("/api/inventory", STORE_OPS_BASE),
    ("/api/transfers", STORE_OPS_BASE),
    ("/api/auth", FOUNDATION_DATA_BASE),
    ("/api/stores", FOUNDATION_DATA_BASE),
    ("/api/skus", FOUNDATION_DATA_BASE),
    ("/api/sku-categories", FOUNDATION_DATA_BASE),
    ("/api/users", FOUNDATION_DATA_BASE),
)


app = FastAPI(title="aegis-integration-gateway")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def route_for(path: str) -> str | None:
    for prefix, base in HTTP_ROUTES:
        if path == prefix or path.startswith(prefix + "/"):
            return base
    return None


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy_http(path: str, request: Request) -> Response:
    full_path = "/" + path
    if request.method == "OPTIONS":
        return Response(status_code=204)

    base = route_for(full_path)
    if base is None:
        return Response(content=f"No route for {full_path}", status_code=404)

    body = await request.body()
    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in {"host", "content-length", "connection"}
    }
    target = f"{base}{full_path}"
    if request.url.query:
        target = f"{target}?{request.url.query}"

    async with httpx.AsyncClient(timeout=None) as client:
        upstream = await client.request(
            request.method,
            target,
            headers=headers,
            content=body,
        )

    excluded = {"content-encoding", "transfer-encoding", "connection"}
    response_headers = {
        key: value for key, value in upstream.headers.items() if key.lower() not in excluded
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )


@app.websocket("/api/ai/traffic/realtime/{store_id}")
async def proxy_traffic_ws(websocket: WebSocket, store_id: int):
    await websocket.accept()
    query = websocket.url.query
    target = f"{TRAFFIC_SENSE_WS_BASE}/api/ai/traffic/realtime/{store_id}"
    if query:
        target = f"{target}?{query}"

    async with websockets.connect(target) as upstream:
        async def client_to_upstream():
            try:
                while True:
                    message = await websocket.receive_text()
                    await upstream.send(message)
            except Exception:
                await upstream.close()

        async def upstream_to_client():
            try:
                async for message in upstream:
                    await websocket.send_text(message)
            except Exception:
                await websocket.close()

        await asyncio.gather(client_to_upstream(), upstream_to_client())
