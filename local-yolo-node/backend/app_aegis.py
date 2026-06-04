import io
import json
import os
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
import cv2
import uvicorn
import numpy as np
import asyncio
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import supervision as sv 

app = FastAPI(title="YOLOv8 Edge Simulation Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    try:
        return int(value)
    except ValueError:
        print(f"[traffic] invalid {name}={value!r}; using {default}")
        return default


def get_env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    try:
        return float(value)
    except ValueError:
        print(f"[traffic] invalid {name}={value!r}; using {default}")
        return default


CLOUD_BASE_URL = os.getenv("CLOUD_BASE_URL", "").strip().rstrip("/")
STORE_ID = get_env_int("STORE_ID", 1)
TRAFFIC_SNAPSHOT_INTERVAL_SECONDS = get_env_float("TRAFFIC_SNAPSHOT_INTERVAL_SECONDS", 1.0)
TRAFFIC_HISTORY_BATCH_INTERVAL_SECONDS = get_env_float("TRAFFIC_HISTORY_BATCH_INTERVAL_SECONDS", 300.0)
TRAFFIC_POST_TIMEOUT_SECONDS = get_env_float("TRAFFIC_POST_TIMEOUT_SECONDS", 3.0)
EDGE_TOKEN = os.getenv("EDGE_TOKEN", "").strip()


def millis_now() -> int:
    return int(time.time() * 1000)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def make_json_request(url: str, payload: dict) -> urllib.request.Request:
    body = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if EDGE_TOKEN:
        headers["Authorization"] = f"Bearer {EDGE_TOKEN}"
    return urllib.request.Request(url, data=body, headers=headers, method="POST")


def validate_cloud_response(response) -> None:
    response_body = response.read().decode("utf-8")
    if response.status < 200 or response.status >= 300:
        raise RuntimeError(f"HTTP {response.status}: {response_body}")
    result = json.loads(response_body) if response_body else {}
    if result.get("code") != 0:
        raise RuntimeError(f"cloud returned error: {result}")


def post_traffic_snapshot_sync(current_people_count: int) -> None:
    if not CLOUD_BASE_URL:
        return

    payload = {
        "store_id": STORE_ID,
        "current_people_count": max(0, int(current_people_count)),
        "timestamp": millis_now(),
    }

    url = f"{CLOUD_BASE_URL}/edge/traffic/snapshot"
    request = make_json_request(url, payload)

    with urllib.request.urlopen(request, timeout=TRAFFIC_POST_TIMEOUT_SECONDS) as response:
        validate_cloud_response(response)


def post_traffic_history_batch_sync(
    customer_start_time: str,
    customer_end_time: str,
    customer_enter_total: int,
    customer_leave_total: int,
) -> None:
    if not CLOUD_BASE_URL:
        return

    payload = {
        "store_id": STORE_ID,
        "customer_start_time": customer_start_time,
        "customer_end_time": customer_end_time,
        "customer_enter_total": max(0, int(customer_enter_total)),
        "customer_leave_total": max(0, int(customer_leave_total)),
    }

    url = f"{CLOUD_BASE_URL}/edge/traffic/history-batch"
    request = make_json_request(url, payload)

    with urllib.request.urlopen(request, timeout=TRAFFIC_POST_TIMEOUT_SECONDS) as response:
        validate_cloud_response(response)


async def send_traffic_snapshot(current_people_count: int) -> None:
    try:
        await asyncio.to_thread(post_traffic_snapshot_sync, current_people_count)
    except (urllib.error.URLError, TimeoutError, OSError, RuntimeError, ValueError) as exc:
        print(f"[traffic] snapshot send failed: {exc}")
    except Exception as exc:
        print(f"[traffic] unexpected snapshot send failed: {exc}")


async def send_traffic_history_batch(
    customer_start_time: str,
    customer_end_time: str,
    customer_enter_total: int,
    customer_leave_total: int,
) -> bool:
    try:
        await asyncio.to_thread(
            post_traffic_history_batch_sync,
            customer_start_time,
            customer_end_time,
            customer_enter_total,
            customer_leave_total,
        )
        print(
            "[traffic] history batch sent: "
            f"{customer_start_time} -> {customer_end_time}, "
            f"enter={customer_enter_total}, leave={customer_leave_total}"
        )
        return True
    except (urllib.error.URLError, TimeoutError, OSError, RuntimeError, ValueError) as exc:
        print(f"[traffic] history batch send failed: {exc}")
    except Exception as exc:
        print(f"[traffic] unexpected history batch send failed: {exc}")
    return False


if CLOUD_BASE_URL:
    print(
        f"[traffic] cloud reporting enabled: {CLOUD_BASE_URL}, "
        f"store_id={STORE_ID}, history_interval={TRAFFIC_HISTORY_BATCH_INTERVAL_SECONDS}s"
    )
else:
    print("[traffic] CLOUD_BASE_URL is not set; cloud reporting disabled")

print("正在初始化 YOLO 模型...")
person_model = YOLO("yolov8n.pt") 
# 预热模型...
dummy_image = np.zeros((640, 640, 3), dtype=np.uint8)
person_model.predict(source=dummy_image, imgsz=640, conf=0.25, device=0, verbose=False)
print("🔥 模型预热完成！")


# 1. 接收视频文件的 HTTP 接口 (模拟给边缘设备传视频)
@app.post("/api/upload_video")
async def upload_video(file: UploadFile = File(...)):
    try:
        temp_video = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
        temp_video.write(await file.read())
        temp_video.close()
        return {"status": "success", "filename": temp_video.name}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# 2. 核心 WebSocket 接口 (模拟边缘计算 + 实时推送)
@app.websocket("/ws/count_video")
async def websocket_video_endpoint(websocket: WebSocket):
    await websocket.accept()
    video_path = None
    try:
        # 接收前端传来的文件名
        data = await websocket.receive_json()
        video_path = data.get("filename")

        if not video_path or not os.path.exists(video_path):
            await websocket.send_json({"error": "视频文件不存在"})
            return

        # 获取视频信息并设置虚拟门槛线
        video_info = sv.VideoInfo.from_video_path(video_path)
        start_point = sv.Point(x=0, y=video_info.height * 0.3)
        end_point = sv.Point(x=video_info.width, y=video_info.height * 0.7)
        line_zone = sv.LineZone(start=start_point, end=end_point)
        
        # 初始化追踪器和画笔
        tracker = sv.ByteTrack(track_activation_threshold=0.25, lost_track_buffer=60)
        box_annotator = sv.BoxAnnotator()
        line_zone_annotator = sv.LineZoneAnnotator()

        # 使用 OpenCV 读取视频
        cap = cv2.VideoCapture(video_path)
        last_snapshot_ts = 0.0
        snapshot_task = None
        history_window_start_time = utc_now_iso()
        history_window_start_ts = time.time()
        history_window_start_entered = line_zone.in_count
        history_window_start_left = line_zone.out_count
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break # 视频播放结束

            # 1. YOLO 推理与 ByteTrack 追踪
            results = person_model(frame, imgsz=640, conf=0.3, device=0, verbose=False)[0]
            detections = sv.Detections.from_ultralytics(results)
            detections = detections[detections.class_id == 0] # 只看人
            detections = tracker.update_with_detections(detections)
            line_zone.trigger(detections=detections)
            current_count = len(detections)

            now = time.time()
            if (
                CLOUD_BASE_URL
                and now - last_snapshot_ts >= TRAFFIC_SNAPSHOT_INTERVAL_SECONDS
                and (snapshot_task is None or snapshot_task.done())
            ):
                snapshot_task = asyncio.create_task(send_traffic_snapshot(current_count))
                last_snapshot_ts = now

            if CLOUD_BASE_URL and now - history_window_start_ts >= TRAFFIC_HISTORY_BATCH_INTERVAL_SECONDS:
                history_window_end_time = utc_now_iso()
                enter_total = line_zone.in_count - history_window_start_entered
                leave_total = line_zone.out_count - history_window_start_left
                sent = await send_traffic_history_batch(
                    history_window_start_time,
                    history_window_end_time,
                    enter_total,
                    leave_total,
                )
                history_window_start_ts = now
                if sent:
                    history_window_start_time = history_window_end_time
                    history_window_start_entered = line_zone.in_count
                    history_window_start_left = line_zone.out_count

            # 2. 通过 WebSocket 给 Vue 前端发最新数字
            await websocket.send_json({
                "status": "processing",
                "entered": line_zone.in_count,
                "left": line_zone.out_count,
                "current_count": current_count
            })

            # 3. 在本地弹窗绘制检测结果 (模拟门店监控画面)
            annotated_frame = frame.copy()
            annotated_frame = box_annotator.annotate(scene=annotated_frame, detections=detections)
            annotated_frame = line_zone_annotator.annotate(annotated_frame, line_counter=line_zone)
            
            # 缩小一下窗口，防止视频分辨率太大占满你的屏幕
            resized_frame = cv2.resize(annotated_frame, (800, int(800 * video_info.height / video_info.width)))
            cv2.imshow("Edge Computing Node (Local Camera View)", resized_frame)
            
            # 加上 cv2.waitKey 才能让窗口正常刷新，按 'q' 可提前退出
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
            # 释放异步控制权，防止 WebSocket 阻塞
            await asyncio.sleep(0.001)

        # 视频处理完后清理资源
        cap.release()
        cv2.destroyAllWindows()

        final_enter_total = line_zone.in_count - history_window_start_entered
        final_leave_total = line_zone.out_count - history_window_start_left
        if CLOUD_BASE_URL and (final_enter_total > 0 or final_leave_total > 0):
            await send_traffic_history_batch(
                history_window_start_time,
                utc_now_iso(),
                final_enter_total,
                final_leave_total,
            )

        await websocket.send_json({"status": "completed"})

    except WebSocketDisconnect:
        print("前端主动断开了 WebSocket 连接")
    except Exception as e:
        print(f"WS Error: {e}")
    finally:
        if video_path and os.path.exists(video_path):
            os.remove(video_path)
            cv2.destroyAllWindows()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
