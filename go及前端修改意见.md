# Go 及前端修改意见

本文档只记录当前无法靠修改两个 AI 微服务完全解决的联调事项。本次实现未修改 Go 与前端源码。

## Nginx 路由建议

前端真实模式默认使用 `http://localhost:8080/api` 和 `ws://localhost:8080/api` 作为统一入口。建议由 Nginx 或同类网关负责以下路由：

- `/api/ai/chat/*` 转发到 `ai-assistant:8084`。
- `/api/ai/traffic/*` 转发到 `traffic-sense:8083`，其中 WebSocket 路由需要保留 `Upgrade` 和 `Connection` 头。
- `/api/auth/*`、`/api/stores*`、`/api/skus*`、`/api/sku-categories*`、`/api/users*` 转发到 `foundation-data:8081`。
- `/api/sales/*`、`/api/inventory*`、`/api/transfers*` 转发到 `store-ops:8082`。

## Go gRPC 能力边界

当前 AI 到 Go 的通信已按现有契约全部使用 gRPC：

- `foundation-data:50054`：`GetSkuDictionary`、`GetStoreContext`。
- `store-ops:50055`：`GetBusinessSnapshot`、`PushCustomerFlow`、`SyncInventoryDiagnosis`、`CreateAITransferOrder`。

这些接口足够支持 AI 对话上下文、客流同步、库存诊断回写和 AI 调拨单创建。但如果未来要求“网关到 Go 也全部通过 gRPC”，Go 侧还需要补齐以下 gRPC API：

- 登录与当前用户：`Login`、`Me`、`ChangePassword`。
- 基础数据：门店、SKU、SKU 分类、用户的列表/详情/新增/修改/停用。
- 门店经营：销售流水、库存盘点、调拨单查询和状态流转。

## 前端建议

当前前端源码可以继续保持不变，由 Nginx 维护统一入口即可。若后续不使用 Nginx，则需要前端支持按服务配置 base URL，例如：

- `foundationData=http://localhost:8081/api`
- `storeOps=http://localhost:8082/api`
- `trafficSense=http://localhost:8083/api`
- `aiAssistant=http://localhost:8084/api`

