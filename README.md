# Aegis Cloud Retail

Aegis Cloud Retail 是一个面向零售门店与总部协同的全栈系统。当前仓库包含两个前端应用、四个后端微服务、PostgreSQL 数据库迁移与演示数据、统一 API 网关，以及基于 Docker Compose、Nginx 和 GitHub Actions 的部署配置。

## 目录结构

```text
.
├── frontend/                         # React + TypeScript + Vite 前端 monorepo
│   ├── apps/web-hq                   # 总部端
│   ├── apps/web-store                # 门店端
│   └── packages/shared               # 共享类型、HTTP 封装、mock 数据
├── services/
│   ├── foundation-data               # Go 基础数据服务：认证、门店、SKU、用户
│   ├── store-ops                     # Go 门店业务服务：销售、库存、调拨
│   ├── traffic-sense                 # Python 客流感知服务
│   └── ai-assistant                  # Python AI 对话与分析服务
├── database/
│   ├── docker-init                   # PostgreSQL 初始化脚本
│   ├── migrations                    # Go / Python 两套数据库迁移
│   └── seeds                         # 演示数据
├── deploy/
│   ├── Dockerfile.gateway            # API 网关镜像
│   ├── docker-compose.prod.yml       # gateway + nginx 叠加配置
│   ├── nginx.conf                    # 生产反向代理与静态资源配置
│   └── remote-deploy.sh              # GitHub Actions 远程部署脚本
├── docker-compose.yml                # 本地后端基础栈
├── integration_gateway.py            # FastAPI 统一 API 网关
└── go.work                           # Go workspace
```

## 技术栈

- 前端：React 18、React Router、TypeScript、Vite、npm workspaces
- Go 服务：Go 1.22、标准库 HTTP、gRPC、pgx、JWT
- Python 服务：FastAPI、uvicorn、SQLAlchemy async、asyncpg、gRPC
- AI 能力：OpenAI SDK，默认按 DeepSeek 兼容接口配置
- 数据库：PostgreSQL 16、golang-migrate
- 部署：Docker Compose、Nginx、GitHub Actions

## 服务说明

| 服务 | 默认端口 | 主要职责 |
| --- | --- | --- |
| `foundation-data` | HTTP `8081` / gRPC `50054` | 登录认证、门店、SKU、SKU 分类、用户 |
| `store-ops` | HTTP `8082` / gRPC `50055` | 销售流水、库存、调拨、调拨预测 |
| `traffic-sense` | HTTP `8083` / gRPC `50051` | 客流快照、历史批量、实时 WebSocket |
| `ai-assistant` | HTTP `8084` / gRPC `50053` | AI 对话、会话、聊天日志、数据分析 |
| `gateway` | HTTP `8080` | 统一转发 `/api/*` 与 `/edge/traffic/*` |
| `postgres` | `5432` | `aegis_go` 和 `aegis_python` 两套数据库 |

`foundation-data` 和 `store-ops` 共用 `aegis_go`；`traffic-sense` 和 `ai-assistant` 共用 `aegis_python`。`docker-compose.yml` 会在 PostgreSQL 健康后执行迁移和演示数据导入。

## 本地启动

### 后端基础栈

在仓库根目录执行：

```bash
docker compose up -d --build
```

该命令会启动：

- `postgres`
- `db-migrate-go`
- `db-migrate-python`
- `db-seed`
- `foundation-data`
- `store-ops`
- `traffic-sense`
- `ai-assistant`

查看状态：

```bash
docker compose ps
```

健康检查：

```bash
curl http://localhost:8081/health
curl http://localhost:8082/health
curl http://localhost:8083/health
curl http://localhost:8084/health
```

停止服务：

```bash
docker compose down
```

如果不想导入演示数据：

```bash
SEED_DEMO_DATA=false docker compose up -d --build
```

### 前端开发

```bash
cd frontend
npm install
```

启动总部端：

```bash
npm run dev:hq
```

启动门店端：

```bash
npm run dev:store
```

默认访问地址：

- 总部端：`http://localhost:5173`
- 门店端：`http://localhost:5174`

前端默认使用 mock 数据。联调真实后端时设置：

```bash
VITE_USE_MOCK=false
VITE_API_BASE_URL=/api
```

## 前端构建

在 `frontend` 目录执行：

```bash
npm run build
```

生产部署到子路径时需要指定 base path。当前 GitHub Actions 使用的构建方式是：

```bash
VITE_USE_MOCK=false VITE_API_BASE_URL=/api VITE_BASE_PATH=/hq/ npm run build -w @aegis/web-hq
VITE_USE_MOCK=false VITE_API_BASE_URL=/api VITE_BASE_PATH=/store/ npm run build -w @aegis/web-store
```

## API 网关与生产入口

`docker-compose.yml` 只启动后端基础栈，不包含 gateway 和 nginx。需要完整生产入口时叠加：

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
```

Nginx 默认暴露：

- `/hq/`：总部端静态资源
- `/store/`：门店端静态资源
- `/api/`：统一 API 网关
- `/edge/traffic/`：客流边缘接口

注意：`deploy/docker-compose.prod.yml` 会挂载 `frontend/apps/web-hq/dist` 和 `frontend/apps/web-store/dist`，因此启动 nginx 前需要先构建前端。

网关转发规则来自 [integration_gateway.py](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/integration_gateway.py)：

- `/api/auth`、`/api/stores`、`/api/skus`、`/api/sku-categories`、`/api/users` -> `foundation-data`
- `/api/sales`、`/api/inventory`、`/api/transfers` -> `store-ops`
- `/api/ai/chat` -> `ai-assistant`
- `/api/ai/traffic`、`/edge/traffic` -> `traffic-sense`

两个 Go 服务提供 Swagger UI：

- `http://localhost:8081/swagger`
- `http://localhost:8082/swagger`

## 环境变量

示例文件见 [configs/env.example](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/configs/env.example)。

| 变量 | 说明 |
| --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | PostgreSQL 用户、密码和 Go 数据库名 |
| `GO_DATABASE_URL` / `DATABASE_URL` | Go 服务数据库连接 |
| `PYTHON_DATABASE_URL` | Python 服务数据库连接 |
| `FOUNDATION_DATA_JWT_SECRET` / `JWT_SECRET` | JWT 签名密钥 |
| `CORS_ALLOW_ORIGINS` | 后端允许的前端来源 |
| `DEEPSEEK_API_KEY` | AI 助手调用大模型所需的 API Key |
| `DEEPSEEK_BASE_URL` | DeepSeek/OpenAI 兼容接口地址 |
| `SEED_DEMO_DATA` | 是否导入演示数据，默认 `true` |

`ai-assistant` 未配置 `DEEPSEEK_API_KEY` 时仍可启动，但真实大模型对话能力不可用，会走服务内的降级逻辑。

## 自动部署

GitHub Actions 工作流位于 [.github/workflows/deploy.yml](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/.github/workflows/deploy.yml)。它会在 push 到 `main` 时运行，先根据变更文件判断是否需要部署：

- 前端源码或共享包变更：构建前端并部署 nginx
- 后端服务目录变更：部署对应服务
- Compose、迁移、部署脚本等基础设施变更：全量部署
- 只有根目录 README 等未命中规则的文档变更：运行检测后跳过部署

远程部署依赖 GitHub Secrets：

- `SERVER_HOST`
- `SERVER_USER`
- `SERVER_PORT`
- `SERVER_APP_DIR`
- `SERVER_ORIGIN`
- `SERVER_SSH_KEY`

部署脚本详情见 [deploy/remote-deploy.sh](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/deploy/remote-deploy.sh)，GitHub Secrets 配置说明见 [deploy/GITHUB_ACTIONS_SETUP.md](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/deploy/GITHUB_ACTIONS_SETUP.md)。

## 常用命令

```bash
# 后端
docker compose up -d --build
docker compose ps
docker compose logs -f foundation-data store-ops traffic-sense ai-assistant

# 前端
cd frontend
npm run dev:hq
npm run dev:store
npm run build
npm run lint

# Go 服务测试
cd services/foundation-data && go test ./...
cd ../store-ops && go test ./...
```

Python 服务当前提供脚本式测试文件，例如：

- [services/traffic-sense/test_grpc.py](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/services/traffic-sense/test_grpc.py)
- [services/ai-assistant/test_ai_assistant.py](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/services/ai-assistant/test_ai_assistant.py)
- [services/ai-assistant/test_chat_api.py](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/services/ai-assistant/test_chat_api.py)
