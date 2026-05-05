import os
import json
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.responses import JSONResponse

from traffic_sense import database
from traffic_sense.config import database_url
from traffic_sense.auth import verify_jwt_token
from traffic_sense.realtime import ConnectionManager, TrafficSimulator
from traffic_sense.grpc import serve_grpc
from traffic_sense.database import init_db, close_db, async_session_maker
from traffic_sense.models import TrafficSnapshotRequest, TrafficBatchRequest, ApiResponse
from traffic_sense.db_models import AiCustomer


manager = ConnectionManager()
traffic_simulator = TrafficSimulator(manager)
grpc_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global grpc_task
    db_url = database_url()
    print(f"Database URL: {db_url}")
    if db_url:
        try:
            await init_db(db_url)
            print("Database initialized successfully")
        except Exception as e:
            print(f"Database initialization error: {e}")
    traffic_simulator.start()
    grpc_task = asyncio.create_task(serve_grpc())
    yield
    traffic_simulator.stop()
    if grpc_task:
        grpc_task.cancel()
        try:
            await grpc_task
        except asyncio.CancelledError:
            pass
    if db_url:
        await close_db()


app = FastAPI(title="traffic-sense", version="0.1.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "traffic-sense", "status": "ok"}


@app.websocket("/api/ai/traffic/realtime/{store_id}")
async def traffic_realtime(
    websocket: WebSocket,
    store_id: int,
    token: str = Query(...),
):
    payload = verify_jwt_token(token)
    if payload is None:
        await websocket.close(code=4001)
        return

    payload_store_id = payload.get("store_id", 0)
    if payload_store_id != 0 and payload_store_id != store_id:
        await websocket.close(code=4003)
        return

    await manager.connect(websocket, store_id)
    try:
        await websocket.send_json({
            "event": "TRAFFIC_TICK",
            "store_id": store_id,
            "data": {
                "current_people_count": traffic_simulator.get_current_count(store_id)
            }
        })

        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"event": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, store_id)


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("TRAFFIC_SENSE_PORT", "8083"))
    uvicorn.run("traffic_sense.main:app", host="0.0.0.0", port=port, reload=True)


# Edge 接口
@app.post("/edge/traffic/snapshot")
async def traffic_snapshot(
    request: TrafficSnapshotRequest
):
    # 暂时跳过 JWT 验证，仅用于测试
    # if not authorization.startswith("Bearer "):
    #     raise HTTPException(status_code=401, detail="Invalid authorization header")
    # token = authorization.split(" ")[1]
    # 
    # payload = verify_jwt_token(token)
    # if payload is None:
    #     raise HTTPException(status_code=401, detail="Invalid token")
    # 
    # 验证权限（EDGE 角色）
    # if payload.get("role") != "EDGE":
    #     raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # 推送实时数据到 WebSocket
    await manager.send_message(
        store_id=request.store_id,
        message={
            "event": "TRAFFIC_TICK",
            "store_id": request.store_id,
            "data": {
                "current_people_count": request.current_people_count
            }
        }
    )
    
    return ApiResponse(
        code=0,
        message="success",
        data=None
    )


@app.post("/edge/traffic/history-batch")
async def traffic_history_batch(
    request: TrafficBatchRequest
):
    # 暂时跳过 JWT 验证，仅用于测试
    # if not authorization.startswith("Bearer "):
    #     raise HTTPException(status_code=401, detail="Invalid authorization header")
    # token = authorization.split(" ")[1]
    # 
    # payload = verify_jwt_token(token)
    # if payload is None:
    #     raise HTTPException(status_code=401, detail="Invalid token")
    # 
    # 验证权限（EDGE 角色）
    # if payload.get("role") != "EDGE":
    #     raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # 入库
    if database.async_session_maker:
        from datetime import datetime
        async with database.async_session_maker() as session:
            # 转换时间格式
            start_time = datetime.fromisoformat(request.customer_start_time.replace("Z", "+00:00"))
            end_time = datetime.fromisoformat(request.customer_end_time.replace("Z", "+00:00"))
            
            # 创建记录
            customer = AiCustomer(
                store_id=request.store_id,
                customer_start_time=start_time,
                customer_end_time=end_time,
                customer_enter_total=request.customer_enter_total,
                customer_leave_total=request.customer_leave_total,
                ai_customer_stats_time=datetime.utcnow()
            )
            session.add(customer)
            await session.commit()
            await session.refresh(customer)
            
            ai_customer_id = customer.ai_customer_id
    else:
        # 模拟 ID
        ai_customer_id = 50000 + request.store_id
    
    # 向 Go 核心端发起 gRPC 同步
    from traffic_sense.grpc_client import go_client
    from datetime import datetime as dt
    await go_client.push_customer_flow(
        store_id=request.store_id,
        record_timestamp=dt.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        customer_start_time=request.customer_start_time,
        customer_end_time=request.customer_end_time,
        in_count=request.customer_enter_total,
    )
    
    return ApiResponse(
        code=0,
        message="success",
        data={
            "ai_customer_id": ai_customer_id
        }
    )