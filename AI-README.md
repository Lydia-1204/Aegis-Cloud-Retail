# AI 微服务部署与运行指南

本文档说明如何从零启动 AI 客流感知（traffic-sense）和 AI 数据分析与对话（ai-assistant）两个 Python 微服务。

---

## 目录

1. [前置条件](#1-前置条件)
2. [创建 Conda 环境](#2-创建-conda-环境)
3. [安装依赖](#3-安装依赖)
4. [数据库准备](#4-数据库准备)
5. [环境变量配置](#5-环境变量配置)
6. [启动服务](#6-启动服务)
7. [运行测试](#7-运行测试)
8. [gRPC Proto 文件说明](#8-grpc-proto-文件说明)
9. [接口清单](#9-接口清单)

---

## 1. 前置条件

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| Python | 3.10+ | 通过 Conda 管理 |
| Conda | Miniconda 或 Anaconda | 创建虚拟环境 |
| PostgreSQL | 14+ | 需要创建 `aegis_python` 数据库 |
| C++ 编译器 | - | Prophet 依赖（Windows 需要 Visual Studio Build Tools） |

---

## 2. 创建 Conda 环境

```powershell
conda create -n aegis python=3.10 -y
conda activate aegis
```

---

## 3. 安装依赖

两个微服务共用同一个 `aegis` 环境：

```powershell
# 安装 AI 客流感知微服务
pip install -e "services/traffic-sense[dev]"

# 安装 AI 数据分析与对话微服务
pip install -e "services/ai-assistant[dev]"

# 安装测试用依赖
pip install requests
```

> **注意**：Prophet 首次导入时会自动编译 Stan 模型，耗时约 30 秒，属于正常现象。

---

## 4. 数据库准备

### 4.1 创建数据库

确保 PostgreSQL 已运行，然后创建 `aegis_python` 数据库：

```sql
CREATE DATABASE aegis_python OWNER postgres;
```

### 4.2 自动建表

两个微服务启动时会通过 SQLAlchemy `create_all` 自动创建所需表，无需手动执行迁移。

### 4.3 插入种子数据（可选）

```powershell
psql -U postgres -d aegis_python -f database/seeds/aegis_python_mock.sql
```

---

## 5. 环境变量配置

### 5.1 必须配置

| 变量名 | 默认值 | 说明 |
|--------|-------|------|
| `PYTHON_DATABASE_URL` | `postgresql+asyncpg://postgres:123456@localhost:5432/aegis_python` | Python 微服务数据库连接串 |

### 5.2 可选配置

| 变量名 | 默认值 | 说明 |
|--------|-------|------|
| `DEEPSEEK_API_KEY` | `""` (空) | DeepSeek 大模型 API Key，不设置则对话走 mock |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek API 地址，可改为第三方代理 |
| `GO_BASIC_DATA_ADDR` | `localhost:50054` | Go 基础数据中心 gRPC 地址 |
| `GO_STORE_BUSINESS_ADDR` | `localhost:50055` | Go 门店业务 gRPC 地址 |

### 5.3 设置方式

**PowerShell（临时，当前会话有效）**：

```powershell
$env:PYTHON_DATABASE_URL = "postgresql+asyncpg://postgres:123456@localhost:5432/aegis_python"
$env:DEEPSEEK_API_KEY = "sk-xxxxxxxxxxxxxxxx"
```

**Linux/macOS**：

```bash
export PYTHON_DATABASE_URL="postgresql+asyncpg://postgres:123456@localhost:5432/aegis_python"
export DEEPSEEK_API_KEY="sk-xxxxxxxxxxxxxxxx"
```

---

## 6. 启动服务

### 6.1 启动 AI 客流感知微服务

```powershell
conda activate aegis
cd services/traffic-sense
python -m uvicorn traffic_sense.main:app --host 0.0.0.0 --port 8083
```

启动成功后输出：
```
Database initialized successfully
gRPC server started on port 50051
INFO:     Uvicorn running on http://0.0.0.0:8083
```

### 6.2 启动 AI 数据分析与对话微服务

```powershell
conda activate aegis
cd services/ai-assistant
python -m uvicorn ai_assistant.main:app --host 0.0.0.0 --port 8084
```

启动成功后输出：
```
INFO:     Application startup complete.
gRPC server started on port 50053
INFO:     Uvicorn running on http://0.0.0.0:8084
```

### 6.3 端口汇总

| 微服务 | HTTP 端口 | gRPC 端口 |
|--------|----------|----------|
| traffic-sense | 8083 | 50051 |
| ai-assistant | 8084 | 50053 |

---

## 7. 运行测试

### 7.1 全量测试（推荐）

确保两个服务都已启动，然后运行：

```powershell
conda activate aegis
cd services/ai-assistant
python test_ai_assistant.py
```

测试覆盖 11 大类 73 项检查：HTTP 接口、gRPC 接口、数据库连接、Go Client Mock Fallback、Prophet 预测等。

### 7.2 单独测试 gRPC 接口

```powershell
cd services/ai-assistant
python test_grpc.py
```

### 7.3 单独测试 HTTP 对话接口

```powershell
cd services/ai-assistant
python test_chat_api.py
```

---

## 8. gRPC Proto 文件说明

### 8.1 AI 提供的 Proto（Go 作为 Client 调用 AI）

| Proto 文件 | 位置 | Service | RPC |
|-----------|------|---------|-----|
| `ai_analysis.proto` | `services/ai-assistant/proto/` | `AiAnalysisAndChatService` | `TriggerDailyAnalysis`, `GetAnalysisReport`, `GetSalesForecast` |
| `perception.proto` | `services/traffic-sense/proto/` | `AiPerceptionService` | `GetRawCustomerFlow` |

### 8.2 AI 调用的 Proto（Go 作为 Server 提供）

| Proto 文件 | 位置 | Service | RPC |
|-----------|------|---------|-----|
| `basic_data_service.proto` | `services/ai-assistant/proto/` | `BasicDataService` | `GetSkuDictionary`, `GetStoreContext` |
| `store_business_service.proto` | `services/ai-assistant/proto/` 和 `services/traffic-sense/proto/` | `StoreBusinessService` | `GetBusinessSnapshot`, `PushCustomerFlow`, `SyncInventoryDiagnosis`, `CreateAITransferOrder` |

### 8.3 重新生成 Python gRPC 代码

如果修改了 proto 文件，需要重新生成：

```powershell
# ai-assistant
cd services/ai-assistant
python -m grpc_tools.protoc -I./proto --python_out=./src/ai_assistant/proto --grpc_python_out=./src/ai_assistant/proto ./proto/ai_analysis.proto
python -m grpc_tools.protoc -I./proto --python_out=./src/ai_assistant/proto --grpc_python_out=./src/ai_assistant/proto ./proto/basic_data_service.proto
python -m grpc_tools.protoc -I./proto --python_out=./src/ai_assistant/proto --grpc_python_out=./src/ai_assistant/proto ./proto/store_business_service.proto

# 生成后需手动修复 import 路径（将 import xxx_pb2 改为 from xxx.proto import xxx_pb2）

# traffic-sense
cd services/traffic-sense
python -m grpc_tools.protoc -I./proto --python_out=./src/traffic_sense/proto --grpc_python_out=./src/traffic_sense/proto ./proto/perception.proto
python -m grpc_tools.protoc -I./proto --python_out=./src/traffic_sense/proto --grpc_python_out=./src/traffic_sense/proto ./proto/store_business_service.proto
```

---

## 9. 接口清单

### 9.1 traffic-sense（AI 客流感知）

| 接口 | 方法 | 功能 |
|------|------|------|
| `GET /health` | HTTP | 健康检查 |
| `WS /api/ai/traffic/realtime/{store_id}?token=xxx` | WebSocket | 实时客流推送 |
| `POST /edge/traffic/snapshot` | HTTP | Edge 摄像头推送实时快照 |
| `POST /edge/traffic/history-batch` | HTTP | Edge 推送历史客流批次 |
| `GetRawCustomerFlow` | gRPC | 查询原始客流记录 |

### 9.2 ai-assistant（AI 数据分析与对话）

| 接口 | 方法 | 功能 |
|------|------|------|
| `GET /health` | HTTP | 健康检查 |
| `POST /api/ai/chat/completions` | HTTP (SSE) | AI 对话（流式响应） |
| `GET /api/ai/chat/sessions?store_id=1` | HTTP | 获取会话列表 |
| `GET /api/ai/chat/history?session_id=xxx` | HTTP | 获取对话历史 |
| `POST /api/ai/chat/logs` | HTTP | 保存对话日志 |
| `GET /api/ai/chat/logs/{chat_id}` | HTTP | 获取单条日志 |
| `DELETE /api/ai/chat/logs/{chat_id}` | HTTP | 删除对话日志 |
| `TriggerDailyAnalysis` | gRPC | 触发 Prophet 预测 + 回写诊断/调拨 |
| `GetAnalysisReport` | gRPC | 获取详细诊断报告（JSON） |
| `GetSalesForecast` | gRPC | 获取结构化预测结果（强类型） |

---

## 10. Docker 部署

### 10.1 配置文件说明

所有敏感配置集中在根目录 `.env` 文件中：

```
Aegis/
├── .env                          ← 【你需要编辑这个文件】
├── docker-compose.yml            ← 编排文件（已配置好，一般不需修改）
├── .dockerignore                 ← Docker 构建排除规则
├── services/
│   ├── ai-assistant/Dockerfile   ← ai-assistant 镜像构建
│   └── traffic-sense/Dockerfile  ← traffic-sense 镜像构建
└── database/docker-init/         ← PostgreSQL 初始化 SQL
```

### 10.2 需要配置的信息

编辑 `Aegis/.env` 文件，填写以下配置：

```bash
# ── 必须修改 ──
POSTGRES_PASSWORD=aegis_dev          # 数据库密码（部署到云服务器时务必修改！）
DEEPSEEK_API_KEY=sk-xxxxxxxx         # DeepSeek API Key（不填则对话走 mock）

# ── 按需修改 ──
POSTGRES_USER=aegis                  # 数据库用户名
DEEPSEEK_BASE_URL=https://api.deepseek.com  # DeepSeek API 地址

# ── Go 微服务地址（Docker 内部 DNS，与 docker-compose.yml 中的 service 名对应）──
GO_BASIC_DATA_ADDR=basic-data-center:50054
GO_STORE_BUSINESS_ADDR=store-ops:50055
```

> **重要**：`.env` 文件已在 `.gitignore` 中，不会被提交到 Git。

### 10.3 Go 微服务地址说明

在 Docker 环境中，微服务之间通过 **Docker 内部 DNS** 通信，地址格式为 `服务名:端口`：

| 环境变量 | 本地开发默认值 | Docker 部署值 | 说明 |
|---------|-------------|-------------|------|
| `GO_BASIC_DATA_ADDR` | `localhost:50054` | `basic-data-center:50054` | Go 基础数据中心 |
| `GO_STORE_BUSINESS_ADDR` | `localhost:50055` | `store-ops:50055` | Go 门店业务服务 |

> `basic-data-center` 和 `store-ops` 需要与 Go 侧 docker-compose.yml 中的 service 名一致。

### 10.4 构建与启动

```bash
# 构建镜像
docker compose build

# 启动所有服务（后台运行）
docker compose up -d

# 查看日志
docker compose logs -f ai-assistant
docker compose logs -f traffic-sense

# 查看服务状态
docker compose ps

# 停止所有服务
docker compose down

# 停止并删除数据卷（重置数据库）
docker compose down -v
```

### 10.5 单独构建某个微服务

```bash
# 只构建 ai-assistant
docker compose build ai-assistant

# 只构建 traffic-sense
docker compose build traffic-sense

# 重新构建（不使用缓存）
docker compose build --no-cache ai-assistant
```

### 10.6 部署到云服务器

```bash
# 1. 将代码上传到云服务器
scp -r Aegis/ user@server:/opt/aegis/

# 2. SSH 登录云服务器
ssh user@server

# 3. 修改 .env 配置
cd /opt/aegis/Aegis
nano .env
# 修改 POSTGRES_PASSWORD 和 DEEPSEEK_API_KEY

# 4. 构建并启动
docker compose up -d --build

# 5. 验证服务
curl http://localhost:8084/health
curl http://localhost:8083/health
```

### 10.7 端口映射

| 微服务 | 容器内端口 | 宿主机端口 | 协议 |
|--------|----------|----------|------|
| PostgreSQL | 5432 | 5432 | TCP |
| traffic-sense | 8083 | 8083 | HTTP |
| traffic-sense | 50051 | 50051 | gRPC |
| ai-assistant | 8084 | 8084 | HTTP |
| ai-assistant | 50053 | 50053 | gRPC |
