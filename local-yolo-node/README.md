# 本地 YOLO 节点参考代码

这个目录是从当前 YOLO demo 中抽出来的一份本地边缘节点参考代码，方便复制到 Aegis 项目里做本地节点接入。

它的职责是：

- 在本地接收测试视频。
- 使用 YOLO + ByteTrack 检测行人并追踪轨迹。
- 使用 LineZone 统计进店、出店和当前画面人数。
- 通过 WebSocket 把实时统计结果推给本地 Vue 调试页面。
- 按固定间隔把实时人数快照和阶段客流量上传到云端 Aegis 后端。

## 目录结构

```text
本地YOLO节点/
  backend/
    app_aegis.py          # 推荐运行入口：本地检测 + WebSocket 推送 + 云端 snapshot/history-batch 上报
    app_v2.0.py           # 纯本地版本：只做检测统计和 WebSocket 推送，不上报云端
    requirements.txt      # Python 依赖
    yolov8n.pt            # 当前代码使用的 YOLO 行人检测权重
  frontend/
    src/components/VideoCount.vue  # 本地调试页面：上传视频并显示实时人数
    src/App.vue                    # 精简入口，只加载 VideoCount
    package.json                   # Vue + Vite 依赖和脚本
  docs/
    本地与云端实时数据传输实现逻辑.md
  samples/
    test-1.mp4            # 小测试视频，可用于本地验证
```

## 代码说明

后端主文件是 `backend/app_aegis.py`。

它提供两个本地接口：

```text
POST /api/upload_video
WS   /ws/count_video
```

前端先把视频上传到 `/api/upload_video`，后端保存为临时文件；然后前端连接 `/ws/count_video`，把临时文件名发给后端，触发 YOLO 检测循环。

检测循环里每帧会做：

1. `YOLO("yolov8n.pt")` 检测行人，代码只保留 COCO 类别 `class_id == 0`。
2. `supervision.ByteTrack` 给行人分配轨迹 ID。
3. `supervision.LineZone` 统计跨线进出人数。
4. WebSocket 推送：

```json
{
  "status": "processing",
  "entered": 3,
  "left": 1,
  "current_count": 6
}
```

如果设置了 `CLOUD_BASE_URL`，后端还会在视频检测期间向云端发送两类数据。

实时快照默认每 1 秒发送一次：

```text
POST {CLOUD_BASE_URL}/edge/traffic/snapshot
```

请求体：

```json
{
  "store_id": 1,
  "current_people_count": 6,
  "timestamp": 1779120000000
}
```

云端响应里 `code == 0` 会被视为成功。

阶段客流量默认每 5 分钟发送一次：

```text
POST {CLOUD_BASE_URL}/edge/traffic/history-batch
```

请求体：

```json
{
  "store_id": 1,
  "customer_start_time": "2026-06-04T14:00:00Z",
  "customer_end_time": "2026-06-04T14:05:00Z",
  "customer_enter_total": 12,
  "customer_leave_total": 8
}
```

`customer_enter_total` 和 `customer_leave_total` 是当前统计窗口内新增的进店/出店人数，不是视频从开始到现在的累计值。发送成功后，本地窗口会重置；发送失败时会保留当前窗口，等下一个周期继续尝试，避免阶段统计直接丢失。

## 重要现状

`app_aegis.py` 当前已经接入实时快照 `snapshot` 和阶段客流量 `history-batch` 上报。统计窗口只在有视频正在处理时运行；如果视频结束或按 `q` 手动停止，且当前未满 5 分钟窗口内已经产生进出增量，会补发一次最终窗口。

## 运行前准备

建议环境：

- Python 3.10 或 3.11。
- Node.js `20.19+` 或 `22.12+`。
- 有 NVIDIA GPU 时体验更好。当前代码默认使用 `device=0`，也就是第 1 张 CUDA 显卡。
- Windows 下需要能弹出 OpenCV 窗口，因为后端会用 `cv2.imshow()` 显示本地监控画面。

### 模型权重

当前后端代码写死使用：

```python
YOLO("yolov8n.pt")
```

所以运行时必须保证 `backend/yolov8n.pt` 存在。本目录已经复制了一份 `yolov8n.pt`。如果你复制到 Aegis 后这个文件丢了，可以用任一方式补齐：

```powershell
# 方式 1：从当前 demo 项目复制
Copy-Item D:\NewStudy\software\SITP\YOLO-demo\backend\yolov8n.pt .\backend\yolov8n.pt
```

```powershell
# 方式 2：让 ultralytics 自动下载，要求当前机器能访问网络
cd backend
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
```

不要把 `yolov8n-face.pt`、`yolov12n-face.pt` 这类人脸模型换到这里。当前客流统计代码依赖 COCO 行人类别，只需要 `yolov8n.pt`。

## 启动后端

进入后端目录：

```powershell
cd 本地YOLO节点\backend
```

创建并激活虚拟环境：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

安装依赖：

```powershell
pip install -r requirements.txt
```

如果机器没有 CUDA 显卡，`requirements.txt` 里的 PyTorch 安装可能不适合当前环境，并且代码里的 `device=0` 会报错。CPU 调试时可以：

1. 安装 CPU 版 PyTorch。
2. 把 `app_aegis.py` 中两处 `device=0` 改成 `device="cpu"`。

CPU 版 PyTorch 示例：

```powershell
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install fastapi "uvicorn[standard]" python-multipart opencv-python numpy ultralytics supervision Pillow websockets
```

### 纯本地模式

不设置 `CLOUD_BASE_URL`，只做本地检测、弹窗和 WebSocket 推送：

```powershell
python app_aegis.py
```

后端默认监听：

```text
http://localhost:8080
```

### 连接 Aegis 云端模式

设置环境变量后再启动：

```powershell
$env:CLOUD_BASE_URL="http://<云端IP或域名>"
$env:STORE_ID="1"
$env:EDGE_TOKEN="your-edge-token"
$env:TRAFFIC_SNAPSHOT_INTERVAL_SECONDS="1.0"
$env:TRAFFIC_HISTORY_BATCH_INTERVAL_SECONDS="300.0"
$env:TRAFFIC_POST_TIMEOUT_SECONDS="3.0"
python app_aegis.py
```

变量说明：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `CLOUD_BASE_URL` | 云端后端地址，不带 `/edge/traffic/snapshot` 路径。为空时不上报云端 | 空 |
| `STORE_ID` | 门店 ID，需要和 Aegis 云端门店一致 | `1` |
| `EDGE_TOKEN` | 可选边缘节点 token；设置后会加 `Authorization: Bearer <token>` | 空 |
| `TRAFFIC_SNAPSHOT_INTERVAL_SECONDS` | 实时快照上报间隔，单位秒 | `1.0` |
| `TRAFFIC_HISTORY_BATCH_INTERVAL_SECONDS` | 阶段客流量上报间隔，单位秒；默认 300 秒，即 5 分钟 | `300.0` |
| `TRAFFIC_POST_TIMEOUT_SECONDS` | 请求云端超时时间，单位秒 | `3.0` |

如果云端临时直连 `traffic-sense:8083`，`CLOUD_BASE_URL` 可写成：

```powershell
$env:CLOUD_BASE_URL="http://<云服务器IP>:8083"
```

如果走 Nginx 或 Gateway，通常写成：

```powershell
$env:CLOUD_BASE_URL="http://<云服务器IP>"
```

## 启动前端

新开一个 PowerShell，进入前端目录：

```powershell
cd 本地YOLO节点\frontend
```

安装依赖：

```powershell
npm install
```

启动 Vite：

```powershell
npm run dev
```

浏览器打开终端里显示的地址，通常是：

```text
http://localhost:5173
```

页面里点击“投递测试视频”，可以选择：

```text
本地YOLO节点\samples\test-1.mp4
```

启动后端检测后，本地会弹出 OpenCV 监控窗口。按 `q` 可以提前退出检测。

## 本地验证顺序

1. 确认 `backend/yolov8n.pt` 存在。
2. 启动后端 `python app_aegis.py`。
3. 启动前端 `npm run dev`。
4. 在前端上传 `samples/test-1.mp4`。
5. 观察前端的“实时进店人数、当前画面人数、实时出店人数”是否刷新。
6. 观察后端是否弹出检测画面。
7. 如果设置了 `CLOUD_BASE_URL`，观察后端日志是否出现云端上报失败信息；没有失败日志一般说明请求正常。
8. 本地快速测试阶段客流量上报时，可以临时设置 `$env:TRAFFIC_HISTORY_BATCH_INTERVAL_SECONDS="30"`，不用真的等待 5 分钟。

## 迁移到 Aegis 时要改的点

复制这个目录到 Aegis 后，重点检查：

- `backend/yolov8n.pt` 是否还在后端工作目录下。
- Aegis 云端是否开放 `/edge/traffic/snapshot` 和 `/edge/traffic/history-batch`。
- `STORE_ID` 是否和云端门店 ID 一致。
- 如果云端启用了鉴权，`EDGE_TOKEN` 是否和云端校验逻辑一致。
- 如果后端端口不是 `8080`，需要同步修改 `frontend/src/components/VideoCount.vue` 里的：

```ts
http://localhost:8080/api/upload_video
ws://localhost:8080/ws/count_video
```

- 如果部署环境是无桌面服务器，需要删除或改造 `cv2.imshow()` 相关代码，否则 OpenCV 弹窗可能失败。
- 如果要接真实摄像头，可以把 `/api/upload_video` 的视频文件输入替换成 `cv2.VideoCapture(0)` 或 RTSP 地址。
- 如果需要补传离线失败的历史批次，可以参考 `docs/本地与云端实时数据传输实现逻辑.md` 中的 JSONL/SQLite 队列方案继续增强。

## 常见问题

### 后端启动时报 `No such file or directory: yolov8n.pt`

从原项目复制 `backend/yolov8n.pt` 到当前 `backend` 目录，或者运行上面的 ultralytics 自动下载命令。

### 后端启动时报 CUDA 或 GPU 相关错误

当前脚本默认 `device=0`。没有 NVIDIA GPU 时，把 `app_aegis.py` 中两处 `device=0` 改成 `device="cpu"`，并安装 CPU 版 PyTorch。

### 前端提示请求失败

先确认后端还在运行，并且监听的是 `localhost:8080`。如果改过端口，需要同步修改 `VideoCount.vue` 里的 HTTP 和 WebSocket 地址。

### 云端没有收到数据

检查：

- `CLOUD_BASE_URL` 是否设置。
- 地址是否能从本地机器访问。
- 云端 `/edge/traffic/snapshot` 和 `/edge/traffic/history-batch` 是否开放。
- 云端响应 JSON 是否包含 `code: 0`。
- `STORE_ID` 是否属于云端真实门店。
