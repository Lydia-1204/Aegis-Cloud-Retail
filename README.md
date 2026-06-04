# Aegis Cloud Retail

Aegis Cloud Retail 是一个面向零售门店与总部协同的全栈示例系统。仓库当前包含两个前端应用、四个后端微服务、一个统一 API 网关、PostgreSQL 迁移和种子数据，以及用于服务器部署的 Docker / Nginx / GitHub Actions 配置。

## 项目结构

```text
.
├── frontend/                       # React + TypeScript + Vite 前端 monorepo
│   ├── apps/web-hq                 # 总部端
│   ├── apps/web-store              # 门店端
│   └── packages/shared             # 共享类型、HTTP 封装、mock 数据
├── services/
│   ├── foundation-data             # Go 基础数据服务：认证、门店、SKU、用户
│   ├── store-ops                   # Go 门店业务服务：销售、库存、调拨
│   ├── traffic-sense               # Python 客流感知服务：快照、历史、实时 WebSocket
│   └── ai-assistant                # Python AI 助手：对话、会话、日志、分析
├── database/
│   ├── docker-init                 # PostgreSQL 初始化脚本
│   ├── migrations                  # Go / Python 两套数据库迁移
│   └── seeds                       # 演示数据
├── deploy/
│   ├── Dockerfile.gateway          # API 网关镜像
│   ├── docker-compose.prod.yml     # 网关 + Nginx 生产叠加配置
│   ├── nginx.conf                  # /hq、/store、/api、/edge/traffic 路由
│   └── remote-deploy.sh            # 服务器部署脚本
├── docker-compose.yml              # 本地后端基础栈
├── integration_gateway.py          # FastAPI API 网关
└── go.work                         # Go workspace
```

## 技术栈

- 前端：React 18、React Router、TypeScript、Vite、npm workspaces
- Go 服务：Go 1.22、标准库 HTTP、gRPC、pgx、JWT
- Python 服务：FastAPI、uvicorn、SQLAlchemy async、asyncpg、gRPC、OpenAI SDK
- 数据库：PostgreSQL 16、golang-migrate
- 部署：Docker Compose、Nginx、GitHub Actions

## 服务与端口

| 模块 | 默认端口 | 说明 |
| --- | --- | --- |
| `foundation-data` | HTTP `8081` / gRPC `50054` | 认证、门店、SKU、用户基础数据 |
| `store-ops` | HTTP `8082` / gRPC `50055` | 销售、库存、调拨业务 |
| `traffic-sense` | HTTP `8083` / gRPC `50051` | 客流快照、历史批量、实时连接 |
| `ai-assistant` | HTTP `8084` / gRPC `50053` | AI 对话、会话、日志、预测分析 |
| `gateway` | HTTP `8080` | 统一转发 `/api/*` 和 `/edge/traffic/*` |
| `postgres` | `5432` | 数据库，包含 `aegis_go` 和 `aegis_python` |
| `web-hq` | `5173` | 总部端 Vite dev server |
| `web-store` | `5174` | 门店端 Vite dev server |

Go 服务共享 `aegis_go` 数据库；Python 服务共享 `aegis_python` 数据库。`docker-compose.yml` 会自动执行迁移和演示数据导入。

## 快速启动

### 1. 启动后端基础栈

在仓库根目录执行：

```bash
docker compose up -d --build
```

该命令会启动 PostgreSQL、数据库迁移、种子数据导入，以及四个后端微服务。查看状态：

```bash
docker compose ps
```

健康检查示例：

```bash
curl http://localhost:8081/health
curl http://localhost:8082/health
curl http://localhost:8083/health
curl http://localhost:8084/health
```

停止基础栈：

```bash
docker compose down
```

如需同时启动统一网关和 Nginx，可叠加生产配置：

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
```

注意：Nginx 会挂载 `frontend/apps/web-hq/dist` 和 `frontend/apps/web-store/dist`，因此使用 Nginx 前需要先构建前端。

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev:hq
```

另开一个终端启动门店端：

```bash
cd frontend
npm run dev:store
```

默认访问地址：

- 总部端：`http://localhost:5173`
- 门店端：`http://localhost:5174`

前端默认使用 mock 数据。本地联调真实接口时，在对应前端应用环境中设置：

```bash
VITE_USE_MOCK=false
VITE_API_BASE_URL=/api
```

## 前端构建

在 `frontend` 目录执行：

```bash
npm run build
```

生产部署到子路径时，当前 GitHub Actions 使用：

```bash
VITE_USE_MOCK=false VITE_API_BASE_URL=/api VITE_BASE_PATH=/hq/ npm run build -w @aegis/web-hq
VITE_USE_MOCK=false VITE_API_BASE_URL=/api VITE_BASE_PATH=/store/ npm run build -w @aegis/web-store
```

对应 Nginx 路由：

- `/hq/`：总部端静态站点
- `/store/`：门店端静态站点
- `/api/`：统一 API 网关
- `/edge/traffic/`：客流边缘接口

## API 入口

统一网关由 [integration_gateway.py](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/integration_gateway.py) 提供，主要转发规则如下：

- `/api/auth`、`/api/stores`、`/api/skus`、`/api/sku-categories`、`/api/users` -> `foundation-data`
- `/api/sales`、`/api/inventory`、`/api/transfers` -> `store-ops`
- `/api/ai/chat` -> `ai-assistant`
- `/api/ai/traffic`、`/edge/traffic` -> `traffic-sense`

两个 Go 服务提供 Swagger UI：

- `http://localhost:8081/swagger`
- `http://localhost:8082/swagger`

## 环境变量

示例文件见 [configs/env.example](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/configs/env.example)。常用变量：

| 变量 | 说明 |
| --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | PostgreSQL 默认账号和 Go 数据库名 |
| `GO_DATABASE_URL` / `DATABASE_URL` | Go 服务数据库连接 |
| `PYTHON_DATABASE_URL` | Python 服务数据库连接 |
| `FOUNDATION_DATA_JWT_SECRET` / `JWT_SECRET` | JWT 签名密钥 |
| `CORS_ALLOW_ORIGINS` | 允许访问后端的前端来源 |
| `DEEPSEEK_API_KEY` | AI 助手调用大模型的 API Key |
| `DEEPSEEK_BASE_URL` | DeepSeek/OpenAI 兼容接口地址，默认 `https://api.deepseek.com` |
| `SEED_DEMO_DATA` | 是否导入演示数据，默认 `true` |

`ai-assistant` 未配置 `DEEPSEEK_API_KEY` 时仍可启动，但真实大模型对话能力不可用，会使用服务内的降级逻辑。

## 部署

仓库包含 GitHub Actions 自动部署流程：[.github/workflows/deploy.yml](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/.github/workflows/deploy.yml)。

部署流程会根据变更范围决定是否构建前端、是否重建指定服务，随后打包仓库并通过 SSH 执行 [deploy/remote-deploy.sh](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/deploy/remote-deploy.sh)。

需要配置的 GitHub Secrets：

- `SERVER_HOST`
- `SERVER_USER`
- `SERVER_PORT`
- `SERVER_APP_DIR`
- `SERVER_ORIGIN`
- `SERVER_SSH_KEY`

服务器上手动部署可使用：

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml logs --tail=100
```

## 常用开发命令

```bash
# 后端基础栈
docker compose up -d --build
docker compose logs -f foundation-data store-ops traffic-sense ai-assistant

# 前端
cd frontend
npm run dev:hq
npm run dev:store
npm run build
npm run lint

# Go 服务
cd services/foundation-data && go test ./...
cd ../store-ops && go test ./...
```

Python 服务当前提供若干脚本式测试文件，位于：

- [services/traffic-sense/test_grpc.py](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/services/traffic-sense/test_grpc.py)
- [services/ai-assistant/test_ai_assistant.py](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/services/ai-assistant/test_ai_assistant.py)
- [services/ai-assistant/test_chat_api.py](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/services/ai-assistant/test_chat_api.py)

