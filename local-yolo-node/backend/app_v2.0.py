import io
import os
import tempfile
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

            # 2. 【核心动作】通过 WebSocket 给 Vue 前端发最新数字
            await websocket.send_json({
                "status": "processing",
                "entered": line_zone.in_count,
                "left": line_zone.out_count,
                "current_count": len(detections)
            })

            # 3. 【核心动作】在本地弹窗绘制检测结果 (模拟门店监控画面)
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