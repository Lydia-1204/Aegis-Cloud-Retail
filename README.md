# Aegis Cloud Retail

Aegis Cloud Retail 是一个面向零售门店与总部协同场景的全栈系统，包含：

- 总部端 Web 应用
- 门店端 Web 应用
- 2 个 Go 微服务
- 2 个 Python AI 微服务
- 统一 API 网关
- Nginx 生产静态站点与反向代理
- PostgreSQL、迁移与种子数据

当前仓库已适配服务器部署、GitHub Actions 自动部署，以及国内常见镜像源环境。

## 系统结构

```text
frontend/
  apps/web-hq            总部端前端
  apps/web-store         门店端前端
  packages/shared        前后端共享类型与请求封装

services/
  foundation-data        Go 基础数据服务
  store-ops              Go 门店业务服务
  traffic-sense          Python 客流感知服务
  ai-assistant           Python AI 对话与分析服务

deploy/
  docker-compose.prod.yml  生产部署附加配置
  nginx.conf                生产 Nginx 配置
  remote-deploy.sh          服务器部署脚本
  GITHUB_ACTIONS_SETUP.md   自动部署配置说明

database/
  migrations/             Go / Python 数据库迁移
  seeds/                  示例种子数据
```

## 运行架构

生产环境默认通过 Nginx 暴露以下入口：

- `/hq/`：总部端
- `/store/`：门店端
- `/api/`：统一 API 网关入口
- `/edge/traffic/`：客流相关入口

后端服务默认端口：

- `foundation-data`：`8081` / gRPC `50054`
- `store-ops`：`8082` / gRPC `50055`
- `traffic-sense`：`8083` / gRPC `50051`
- `ai-assistant`：`8084` / gRPC `50053`
- `gateway`：`8080`
- `postgres`：`5432`

## 快速开始

### 1. 本地一键启动后端栈

仓库根目录执行：

```bash
docker compose up -d --build
```

默认会启动：

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

停止：

```bash
docker compose down
```

### 2. 本地启动前端

进入前端目录：

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

### 3. 构建前端

```bash
cd frontend
npm run build
```

## 环境变量

示例配置见 [configs/env.example](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/configs/env.example)。

常见关键变量：

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `GO_DATABASE_URL`
- `PYTHON_DATABASE_URL`
- `FOUNDATION_DATA_JWT_SECRET`
- `CORS_ALLOW_ORIGINS`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`

### AI 对话注意事项

`ai-assistant` 服务在未配置 `DEEPSEEK_API_KEY` 时仍可启动，但会进入本地 fallback 模式，无法提供真实大模型对话能力。

生产服务器补充方式：

```bash
ssh root@47.99.126.89
cd /opt/aegis
nano .env
```

将下面这行填成真实值：

```env
DEEPSEEK_API_KEY=your-real-key
```

保存后重启：

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build ai-assistant
```

## 生产部署

当前生产服务器信息：

- 服务器：阿里云 ECS Ubuntu 22.04
- IP：`47.99.126.89`
- 用户：`root`
- 部署目录：`/opt/aegis`
- 总部端：`http://47.99.126.89/hq/`
- 门店端：`http://47.99.126.89/store/`

### 自动部署

已配置 GitHub Actions 工作流：

- [deploy.yml](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/.github/workflows/deploy.yml)

自动部署流程会：

- 判断本次 push 的改动范围
- 仅构建必要的前端或后端服务
- 打包仓库并上传服务器
- 在服务器执行定向或全量 `docker compose` 部署

GitHub Secrets 配置详见：

- [deploy/GITHUB_ACTIONS_SETUP.md](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/deploy/GITHUB_ACTIONS_SETUP.md)

### 手动部署

服务器上常用命令：

```bash
cd /opt/aegis
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml logs --tail=100
```

## 国内镜像源说明

仓库已针对常见网络环境做过适配：

- Go：`GOPROXY=https://goproxy.cn,direct`
- Alpine：`mirrors.aliyun.com`
- pip：`https://pypi.tuna.tsinghua.edu.cn/simple`
- Debian / Ubuntu 容器源：阿里云镜像
- Docker daemon registry mirrors：在部署脚本中自动补充

相关文件：

- [services/foundation-data/Dockerfile](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/services/foundation-data/Dockerfile)
- [services/store-ops/Dockerfile](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/services/store-ops/Dockerfile)
- [services/traffic-sense/Dockerfile](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/services/traffic-sense/Dockerfile)
- [services/ai-assistant/Dockerfile](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/services/ai-assistant/Dockerfile)
- [deploy/Dockerfile.gateway](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/deploy/Dockerfile.gateway)
- [deploy/remote-deploy.sh](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/deploy/remote-deploy.sh)

## 常见问题

### 1. 页面刷新后 404

生产环境部署在 `/hq/` 和 `/store/` 子路径下，前端路由已按 `BASE_URL` 配置 `basename`。如果线上刷新仍然 404，通常说明：

- 前端最新构建还没有重新部署
- 或 Nginx 当前仍在使用旧静态文件

建议重新触发前端部署后再验证。

### 2. AI 对话不可用

优先检查：

```bash
grep '^DEEPSEEK_API_KEY=' /opt/aegis/.env
docker compose -f /opt/aegis/docker-compose.yml -f /opt/aegis/deploy/docker-compose.prod.yml logs --tail=100 ai-assistant
```

如果日志出现：

```text
LLM API key not configured
```

说明还没有正确注入真实 API Key。

### 3. GitHub Actions 显示失败，但服务器服务正常

如果日志中包含：

```text
client_loop: send disconnect: Broken pipe
```

通常是 GitHub Runner 到服务器的 SSH 长连接中断，而不是部署本身失败。当前 workflow 已加入 SSH keepalive 参数缓解该问题。

### 4. 旧版 docker-compose 导致部署异常

服务器部署脚本默认要求 `docker compose` v2。如果服务器只有旧版 `docker-compose` v1，可能会出现容器元数据兼容问题。建议统一使用：

```bash
docker compose version
```

## 更多文档

- [frontend/README.md](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/frontend/README.md)
- [AI-README.md](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/AI-README.md)
- [deploy/GITHUB_ACTIONS_SETUP.md](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/deploy/GITHUB_ACTIONS_SETUP.md)
- [运行流程.md](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/运行流程.md)
- [Aegis接口设计文档.md](/Users/lydia/Desktop/专综/Aegis-Cloud-Retail/Aegis接口设计文档.md)
