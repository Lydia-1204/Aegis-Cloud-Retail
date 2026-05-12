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
10. [Docker 部署](#10-docker-部署)

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
| `DEEPSEEK_API_KEY` | `""` (空) | DeepSeek 大模型 API Key。不设置时 `ai-assistant` 仍可启动，对话走本地 fallback |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek API 地址，可改为第三方代理 |
| `GO_BASIC_DATA_ADDRS` | `localhost:50054` | Go 基础数据中心 gRPC 地址列表，逗号分隔，按顺序失败回退 |
| `GO_STORE_BUSINESS_ADDRS` | `localhost:50055` | Go 门店业务 gRPC 地址列表，逗号分隔，按顺序失败回退 |
| `GO_BASIC_DATA_ADDR` | `localhost:50054` | 兼容旧配置。未配置 `GO_BASIC_DATA_ADDRS` 时使用 |
| `GO_STORE_BUSINESS_ADDR` | `localhost:50055` | 兼容旧配置。未配置 `GO_STORE_BUSINESS_ADDRS` 时使用 |
| `CORS_ALLOW_ORIGINS` | 本地前端常用端口 | 允许跨域访问的前端 Origin，逗号分隔 |
| `JWT_SECRET` | `foundation-data-dev-secret` | `traffic-sense` WebSocket JWT 校验密钥，优先级最高 |
| `FOUNDATION_DATA_JWT_SECRET` | `foundation-data-dev-secret` | `JWT_SECRET` 未配置时使用，兼容 Go foundation-data token |

### 5.3 设置方式

**PowerShell（临时，当前会话有效）**：

```powershell
$env:PYTHON_DATABASE_URL = "postgresql+asyncpg://postgres:123456@localhost:5432/aegis_python"
$env:DEEPSEEK_API_KEY = "sk-xxxxxxxxxxxxxxxx"
$env:GO_BASIC_DATA_ADDRS = "localhost:50054"
$env:GO_STORE_BUSINESS_ADDRS = "localhost:50055"
```

**Linux/macOS**：

```bash
export PYTHON_DATABASE_URL="postgresql+asyncpg://postgres:123456@localhost:5432/aegis_python"
export DEEPSEEK_API_KEY="sk-xxxxxxxxxxxxxxxx"
export GO_BASIC_DATA_ADDRS="localhost:50054"
export GO_STORE_BUSINESS_ADDRS="localhost:50055"
```

> `DEEPSEEK_API_KEY` 不要写入源码、README 或提交到 Git。开发测试时可以留空，服务会记录 `LLM API key not configured, using local fallback` 并继续启动。
>
> AI 微服务调用 Go 微服务只使用 gRPC。前端/Edge 到 AI 的 HTTP、SSE、WebSocket 入口仍保留，后续统一入口路由由 Nginx 或网关层处理。

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

如果未配置 `DEEPSEEK_API_KEY`，日志中可能出现：

```
LLM API key not configured, using local fallback
```

这是开发/测试环境的预期行为，服务仍会正常提供 `/health`、HTTP SSE 和 gRPC 接口。

### 6.3 端口汇总

| 微服务 | HTTP 端口 | gRPC 端口 |
|--------|----------|----------|
| traffic-sense | 8083 | 50051 |
| ai-assistant | 8084 | 50053 |

---

## 7. 运行测试

### 7.1 Python 语法检查

```powershell
cd services/ai-assistant
python -m compileall -q src

cd ../traffic-sense
python -m compileall -q src
```

### 7.2 全量测试（推荐）

确保两个服务都已启动，然后运行：

```powershell
conda activate aegis
cd services/ai-assistant
python test_ai_assistant.py
```

测试覆盖 11 大类 73 项检查：HTTP 接口、gRPC 接口、数据库连接、Go Client Mock Fallback、Prophet 预测等。

### 7.3 单独测试 gRPC 接口

```powershell
cd services/ai-assistant
python test_grpc.py
```

`traffic-sense` 也提供独立 gRPC 测试：

```powershell
cd services/traffic-sense
python test_grpc.py
```

### 7.4 单独测试 HTTP 对话接口

```powershell
cd services/ai-assistant
python test_chat_api.py
```

### 7.5 Docker smoke test

```powershell
docker compose build ai-assistant traffic-sense

# 不配置 DEEPSEEK_API_KEY，验证 ai-assistant 仍可启动
docker run --rm -e ENV=production -e PYTHON_DATABASE_URL= -p 8084:8084 -p 50053:50053 aegis-ai-assistant:latest

# 另开终端验证
curl http://localhost:8084/health
```

期望返回：

```json
{"service":"ai-assistant","status":"ok"}
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

AI 调用 Go 服务时只使用 gRPC，不使用 HTTP 转发。`ai-assistant` 的 `BasicDataService`、`StoreBusinessService` 客户端和 `traffic-sense` 的 `StoreBusinessService` 客户端都支持多地址失败回退。

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

WebSocket 鉴权使用 JWT，密钥优先读取 `JWT_SECRET`，其次读取 `FOUNDATION_DATA_JWT_SECRET`，默认 `foundation-data-dev-secret`。门店 claim 兼容 Go token 的 `sid` 和旧版 `store_id`。

向 Go `StoreBusinessService.PushCustomerFlow` 同步客流时，`record_timestamp` 使用 RFC3339 UTC 格式，兼容 Go 侧 `time.RFC3339` 校验。

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

`POST /api/ai/chat/completions` 会在发送最终 `is_finish=true` SSE 事件前完成对话日志入库，避免前端立即查询 `/api/ai/chat/history` 时偶发查不到会话。

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
# ── 数据库配置 ──
POSTGRES_USER=aegis
POSTGRES_PASSWORD=aegis_dev          # 部署到云服务器时务必修改
POSTGRES_DB=aegis_go

# ── DeepSeek 配置 ──
# 可留空。留空时 ai-assistant 正常启动，对话走本地 fallback。
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com

# ── Go 微服务 gRPC 地址（Docker 内部 DNS，与 docker-compose.yml 中的 service 名对应）──
GO_BASIC_DATA_ADDRS=basic-data-center:50054
GO_STORE_BUSINESS_ADDRS=store-ops:50055

# 旧变量仍兼容；未配置 *_ADDRS 时使用
GO_BASIC_DATA_ADDR=basic-data-center:50054
GO_STORE_BUSINESS_ADDR=store-ops:50055

# ── 本地直接访问 AI 服务时的 CORS 配置 ──
CORS_ALLOW_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174

# ── traffic-sense WebSocket JWT 校验配置 ──
JWT_SECRET=foundation-data-dev-secret
# 或使用 Go foundation-data 的同名配置：
# FOUNDATION_DATA_JWT_SECRET=foundation-data-dev-secret
```

> **重要**：`.env` 文件已在 `.gitignore` 中，不会被提交到 Git。真实 `DEEPSEEK_API_KEY` 只能放在 `.env`、CI/CD Secret 或服务器环境变量中，不要写入文档和源码。

### 10.3 Go 微服务地址说明

在 Docker 环境中，微服务之间通过 **Docker 内部 DNS** 通信，地址格式为 `服务名:端口`：

| 环境变量 | 本地开发默认值 | Docker 部署值 | 说明 |
|---------|-------------|-------------|------|
| `GO_BASIC_DATA_ADDRS` | `localhost:50054` | `basic-data-center:50054` | Go 基础数据中心，支持逗号分隔多地址 |
| `GO_STORE_BUSINESS_ADDRS` | `localhost:50055` | `store-ops:50055` | Go 门店业务服务，支持逗号分隔多地址 |
| `GO_BASIC_DATA_ADDR` | `localhost:50054` | `basic-data-center:50054` | 兼容旧配置 |
| `GO_STORE_BUSINESS_ADDR` | `localhost:50055` | `store-ops:50055` | 兼容旧配置 |

> `basic-data-center` 和 `store-ops` 需要与 Go 侧 docker-compose.yml 中的 service 名一致。
>
> AI 调用 Go 的链路只走 gRPC。Go 服务暂不可用时，AI 服务会记录 gRPC 不可用日志，并使用本地 mock/fallback 数据保证开发测试可继续。

### 10.4 构建与启动

```bash
# 构建镜像
docker compose build

# 只构建两个 AI 服务
docker compose build ai-assistant traffic-sense

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
# 修改 POSTGRES_PASSWORD；如需真实大模型回复，再配置新的 DEEPSEEK_API_KEY

# 4. 构建并启动
docker compose up -d --build

# 5. 验证服务
curl http://localhost:8084/health
curl http://localhost:8083/health
```

### 10.7 无 DeepSeek Key 的 Docker 启动验证

`DEEPSEEK_API_KEY` 为空是合法的开发/测试配置：

```bash
docker run --rm \
  -e ENV=production \
  -e PYTHON_DATABASE_URL= \
  -p 8084:8084 \
  -p 50053:50053 \
  aegis-ai-assistant:latest
```

另开终端验证：

```bash
curl http://localhost:8084/health
```

期望返回：

```json
{"service":"ai-assistant","status":"ok"}
```

### 10.8 端口映射

| 微服务 | 容器内端口 | 宿主机端口 | 协议 |
|--------|----------|----------|------|
| PostgreSQL | 5432 | 5432 | TCP |
| traffic-sense | 8083 | 8083 | HTTP |
| traffic-sense | 50051 | 50051 | gRPC |
| ai-assistant | 8084 | 8084 | HTTP |
| ai-assistant | 50053 | 50053 | gRPC |
