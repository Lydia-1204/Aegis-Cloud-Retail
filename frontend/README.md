# Aegis 前端

Aegis 前端是一个基于 React + TypeScript + Vite 的 monorepo，包含总部端和门店端两个应用，以及一个共享类型与接口封装包。

## 目录结构

```text
frontend/
├── apps/
│   ├── web-hq/                     # 总部端应用
│   │   └── src/
│   │       ├── auth/               # 登录态、角色权限控制
│   │       ├── components/         # 通用布局与基础组件
│   │       ├── pages/              # 总部端页面
│   │       ├── services/           # 总部端接口封装
│   │       ├── App.tsx             # 路由入口
│   │       ├── main.tsx            # 应用启动入口
│   │       ├── index.css           # 全局样式
│   │       └── vite-env.d.ts       # Vite 类型声明
│   └── web-store/                  # 门店端应用
│       └── src/
│           ├── auth/               # 登录态、角色权限控制
│           ├── components/         # 通用布局与基础组件
│           ├── pages/              # 门店端页面
│           ├── services/           # 门店端接口封装
│           ├── App.tsx             # 路由入口
│           ├── main.tsx            # 应用启动入口
│           ├── index.css           # 全局样式
│           └── vite-env.d.ts       # Vite 类型声明
├── packages/
│   └── shared/                     # 共享包
│       └── src/
│           ├── http.ts             # HTTP 客户端封装
│           ├── mock.ts             # mock 数据与模拟接口
│           ├── types.ts            # 共享类型定义
│           └── index.ts            # 对外导出入口
└── README.md
```

### 主要目录说明

- `apps/web-hq`：总部端后台，默认端口 `5173`
- `apps/web-store`：门店端后台，默认端口 `5174`
- `packages/shared`：共享接口、类型、HTTP 封装和 mock 数据

## 环境要求

- Node.js 18+ 
- npm 9+

## 安装依赖

在 `frontend` 目录下执行：

```bash
npm install
```

## 启动开发环境

### 总部端

```bash
npm run dev:hq
```

默认访问地址：`http://localhost:5173`

### 门店端

```bash
npm run dev:store
```

默认访问地址：`http://localhost:5174`

## 构建

构建整个前端工作区：

```bash
npm run build
```

## 代码检查

执行所有已配置的 lint 任务：

```bash
npm run lint
```

## 接口模式

前端默认使用 mock 数据运行，便于本地开发。

如果要切换到真实后端接口，在对应应用的环境变量中设置：

```bash
VITE_USE_MOCK=false
```

未设置或不等于 `false` 时，前端会继续使用 mock 模式。

## 接口地址约定

共享包中当前默认的后端地址如下：

- `foundationData`：`http://localhost:8080/api`
- `storeOps`：`http://localhost:8080/api`
- `trafficSense`：`http://localhost:8080/api`
- `aiAssistant`：`http://localhost:8080/api`

## 文件功能说明

### 总部端核心文件

| 文件 | 作用 | 主要功能 |
| --- | --- | --- |
| `src/App.tsx` | 路由入口 | 配置总部端路由、权限守卫和页面跳转 |
| `src/main.tsx` | 应用入口 | 挂载 React 应用、注入路由与全局样式 |
| `src/auth/` | 鉴权模块 | 负责登录态管理、角色校验和路由守卫 |
| `src/components/` | 公共组件 | 提供总部端统一布局、导航和页面容器 |
| `src/pages/` | 页面模块 | 承载门店管理、SKU 管理、用户管理、经营分析等页面 |
| `src/services/` | 接口模块 | 封装总部端调用的 API 请求 |
| `src/index.css` | 样式文件 | 定义全局样式和基础视觉规范 |

### 门店端核心文件

| 文件 | 作用 | 主要功能 |
| --- | --- | --- |
| `src/App.tsx` | 路由入口 | 配置门店端路由、权限守卫和页面跳转 |
| `src/main.tsx` | 应用入口 | 挂载 React 应用、注入路由与全局样式 |
| `src/auth/` | 鉴权模块 | 负责登录态管理、角色校验和路由守卫 |
| `src/components/` | 公共组件 | 提供门店端统一布局、导航和页面容器 |
| `src/pages/` | 页面模块 | 承载销售流水、门店信息、库存盘点、调拨确认、客流感知等页面 |
| `src/services/` | 接口模块 | 封装门店端调用的 API 请求 |
| `src/index.css` | 样式文件 | 定义全局样式和基础视觉规范 |

### 共享包核心文件

| 文件 | 作用 | 主要功能 |
| --- | --- | --- |
| `src/types.ts` | 类型定义 | 提供登录、门店、SKU、用户、库存、调拨、销售、客流等共享类型 |
| `src/http.ts` | HTTP 封装 | 统一处理请求、分页查询、错误抛出和鉴权头 |
| `src/mock.ts` | Mock 数据 | 提供本地开发用的模拟接口和示例数据 |
| `src/index.ts` | 导出入口 | 统一导出共享包能力，方便各应用引用 |

## 功能概览

### 总部端

- 门店管理
- SKU 管理
- 用户管理
- 全域经营与分析监控
- 调拨审核与协商
- AI 对话
- 修改密码

### 门店端

- 销售流水
- 门店信息
- 库存盘点
- 调拨确认
- 客流感知
- AI 对话
- 修改密码

## 说明

- `@aegis/shared` 提供统一的类型定义和 mock 实现，两个应用都会复用。
- 当前前端代码已按总部端和门店端分别组织，路由、页面和接口封装都在各自应用内维护。
- 如果切换到真实后端，请确保后端接口、鉴权和返回结构与共享类型保持一致。

## 常用脚本

在 `frontend` 根目录下：

```bash
npm run dev:hq
npm run dev:store
npm run build
npm run lint
```
