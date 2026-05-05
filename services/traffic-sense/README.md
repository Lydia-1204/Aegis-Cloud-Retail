# traffic-sense

客流感知服务，提供实时客流数据和 gRPC 接口。

## 功能

- WebSocket 实时客流推送
- gRPC 接口获取历史客流数据

## 运行

```bash
# 安装依赖
pip install -e .

# 运行服务
python -m traffic_sense.main
```
