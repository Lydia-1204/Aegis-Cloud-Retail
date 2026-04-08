# Aegis 前后端通信接口设计文档

---

## 1. 全局规范

### 1.1 基础约定

| 项目 | 规范 |
| --- | --- |
| Base URL | `http://localhost:8080/api`（开发） / `https://api.aegis.com/api`（生产） |
| WebSocket | `ws://localhost:8080/ws/dashboard?token=<JWT>` |
| 数据格式 | `application/json` |
| 时间格式 | ISO 8601，如 `2026-03-14T09:30:00Z` |
| 分页参数 | `page`（从 1 起）+ `limit`（默认 10），响应含 `total` |
| 鉴权方式 | `Authorization: Bearer <JWT>` |

### 1.2 统一响应 Envelope

**所有接口均返回此结构：**

```json
{
  "code":    0,
  "message": "ok",
  "data":    { }
}
```

```go
// models/response.go
type Response struct {
    Code    int         `json:"code"`
    Message string      `json:"message"`
    Data    interface{} `json:"data"`
}
```

```tsx
// types/api.ts
export interface ApiResponse<T = unknown> {
  code:    number;
  message: string;
  data:    T;
}
```

### 1.3 分页响应结构

```tsx
export interface PagedData<T> {
  page:  number;
  limit: number;
  total: number;
  data:  T[];
}
// 完整响应：ApiResponse<PagedData<T>>
```

### 1.4 业务错误码

| code | 含义 |
| --- | --- |
| `0` | 成功 |
| `1001` | 参数校验失败 |
| `1002` | 价格倒挂（suggest < cost） |
| `1003` | 编码已存在（store_code / sku_code 重复） |
| `1004` | 状态流转非法（调拨单状态机） |
| `1005` | SKU 被调拨锁定，暂不可修改库存 |
| `1006` | 销售补录超过 48 小时限制 |
| `1007` | 库存修正幅度超过 30%，需填写根因 |
| `2001` | 未携带 Token / Token 过期 → HTTP 401 |
| `2002` | 越权操作（店长访问他店数据）→ HTTP 403 |
| `5001` | 服务器内部错误 |
| `5002` | AI 引擎超时 |

### 1.5 命名约定（严格对齐 ER 图）

所有字段名与数据库列名 **完全一致**，使用 `snake_case`。

| 数据库表 | 关键字段（原样使用） |
| --- | --- |
| `STORE` | `store_id`, `store_code`, `store_name`, `store_location`, `store_area`, `store_status` |
| `USER` | `user_id`, `store_id`, `role_id`, `user_name`, `account_name`, `password` |
| `ROLE` | `role_id`, `role_name`, `permissions` |
| `SKU` | `sku_id`, `sku_code`, `sku_name`, `category_id`, `std_cost`, `sug_price` |
| `SKU_CATEGORY` | `category_id`, `category_name` |
| `INVENTORY` | `inventory_id`, `store_id`, `sku_id`, `actual_quantity` |
| `SALES_DAILY` | `sales_id`, `store_id`, `sales_date`, `total_orders`, `total_income`, `total_profit` |
| `SALES_DETAIL` | `detail_id`, `sales_id`, `sku_id`, `sku_amount`, `sku_income`, `sku_profit` |
| `CUSTOMER_LOG` | `customer_log_id`, `store_id`, `record_timestamp`, `in_count`, `customer_start_time`, `customer_end_time` |
| `TRANSFER_ORDER` | `order_id`, `store_id`, `status`, `feedback` |
| `TRANSFER_DETAIL` | `detail_id`, `order_id`, `sku_id`, `suggested_qty`, `actual_qty`, `transfer_direction` |
| `AI_INVENTORY_DIAGNOSIS` | `inventory_diagnosis_id`, `store_id`, `sku_id`, `inventory_diagonsis_result_type`, `inventory_root_cause` |
| `AI_CUSTOME` | `ai_customer_id`, `store_id`, `customer_start_time`, `customer_end_time`, `customer_enter_total`, `customer_leave_total`, `ai_customer_stats_time` |
| `AI_CHAT_LOGS` | `chat_id`, `store_id`, `chat_session_id`, `chat_query`, `context_snapshot`, `chat_final_prompt`, `ai_response`, `chat_tokens_used`, `chat_time` |
| `AI_ANALYSIS` | `ai_analysis_id`, `store_id`, `sku_id`, `analysis_label`, `strategy_key`, `analysis_data`, `analysis_time` |
| `AI_EXPERT_KNOWLEDGE` | `knowledge_id`, `strategy_key`, `scenario_name`, `expert_prompt`, `is_active`, `knowledge_time`, `knowledge_updated_time` |

> ⚠️ 注意：`inventory_diagonsis_result_type` 和 `store_diagonsis_result_type` 保留原 ER 图拼写（含 typo），前后端统一使用，不得自行更正。
> 

---

## 2. 认证与 RBAC

### 2.1 `POST /api/auth/login` 用户登录（Go-基础数据中心）

**请求体：**

```tsx
// types/auth.ts
export interface LoginReq {
  account_name: string;
  password:     string;
}
```

```go
type LoginReq struct {
    AccountName string `json:"account_name" binding:"required"`
    Password    string `json:"password"     binding:"required"`
}
```

**请求示例：**

```json
{
  "account_name": "head001",
  "password":     "123456"
}
```

**成功响应 `data`：**

```tsx
export interface LoginRes {
  user_id:      number;  // USER.user_id
  account_name: string;  // USER.account_name
  role_name:    "Head" | "Store";  // ROLE.role_name
  store_id:     number;  // USER.store_id，总部固定为 0
  user_name:    string;  // USER.user_name
  token:        string;  // JWT
}
```

```go
type LoginRes struct {
    UserId      int    `json:"user_id"`
    AccountName string `json:"account_name"`
    RoleName    string `json:"role_name"`
    StoreId     int    `json:"store_id"`
    UserName    string `json:"user_name"`
    Token       string `json:"token"`
}
```

**Mock 成功响应（总部管理员）：**

```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "user_id":      1,
    "account_name": "head001",
    "role_name":    "Head",
    "store_id":     0,
    "user_name":    "张三",
    "token":        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_payload.mock_sig"
  }
}
```

**Mock 成功响应（门店店长）：**

```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "user_id":      5,
    "account_name": "store001_mgr",
    "role_name":    "Store",
    "store_id":     1,
    "user_name":    "李四",
    "token":        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_store_payload.mock_sig"
  }
}
```

**失败响应（账号或密码错误）：**

```json
{
  "code":    1001,
  "message": "账号或密码错误",
  "data":    null
}
```

---

### 2.2 `GET /api/auth/me` 获取当前登录用户信息（Go-基础数据中心）

**请求头：** `Authorization: Bearer <JWT>`（必须）

**无请求体。**

**成功响应 `data`：**

```tsx
export interface UserMe {
  user_id:      number;
  account_name: string;
  user_name:    string;
  role_id:      number;   // ROLE.role_id
  role_name:    "Head" | "Store";
  store_id:     number;   // 总部为 0
  permissions:  string[]; // ROLE.permissions 展开后的字符串数组
}
```

```go
type UserMeRes struct {
    UserId      int      `json:"user_id"`
    AccountName string   `json:"account_name"`
    UserName    string   `json:"user_name"`
    RoleId      int      `json:"role_id"`
    RoleName    string   `json:"role_name"`
    StoreId     int      `json:"store_id"`
    Permissions []string `json:"permissions"`
}
```

**Mock 响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "user_id":      1,
    "account_name": "head001",
    "user_name":    "张三",
    "role_id":      1,
    "role_name":    "Head",
    "store_id":     0,
    "permissions":  ["store:manage", "sku:manage", "transfer:approve", "analytics:all"]
  }
}
```

**Token 失效响应（HTTP 401）：**

```json
{
  "code":    2001,
  "message": "Token 已过期，请重新登录",
  "data":    null
}
```

---

## 3. 基础数据中心

### 3.1 门店管理（STORE 表）

### `GET /api/stores` 获取门店列表（Go-基础数据中心）

**权限：** `Head` 角色

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `page` | number | 否 | 默认 1 |
| `limit` | number | 否 | 默认 10，最大 100 |
| `keyword` | string | 否 | 模糊匹配 `store_name` / `store_code` |
| `store_status` | string | 否 | `"active"` | `"inactive"` 精确过滤 |

**成功响应 `data`：**

```tsx
export interface Store {
  store_id:       number;
  store_code:     string;
  store_name:     string;
  store_location: string;
  store_area:     number;
  store_status:   "active" | "inactive";
}
// 响应类型：ApiResponse<PagedData<Store>>
```

```go
type Store struct {
    StoreId       int     `json:"store_id"`
    StoreCode     string  `json:"store_code"`
    StoreName     string  `json:"store_name"`
    StoreLocation string  `json:"store_location"`
    StoreArea     float64 `json:"store_area"`
    StoreStatus   string  `json:"store_status"`
}
```

**Mock 响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "page":  1,
    "limit": 10,
    "total": 3,
    "data": [
      {
        "store_id":       1,
        "store_code":     "S001",
        "store_name":     "葵涌旗舰店",
        "store_location": "香港新界葵涌葵涌道123号",
        "store_area":     150.0,
        "store_status":   "active"
      },
      {
        "store_id":       2,
        "store_code":     "S002",
        "store_name":     "旺角分店",
        "store_location": "香港九龙旺角西洋菜南街88号",
        "store_area":     98.5,
        "store_status":   "active"
      },
      {
        "store_id":       3,
        "store_code":     "S003",
        "store_name":     "铜锣湾分店",
        "store_location": "香港铜锣湾轩尼诗道500号",
        "store_area":     120.0,
        "store_status":   "inactive"
      }
    ]
  }
}
```

---

### `GET /api/stores/:store_id` 获取单个门店详情（Go-基础数据中心）

**权限：** `Head`；`Store` 角色只能访问自己的 `store_id`（后端中间件校验）

**无请求体。**

**成功响应 `data`：** 单个 `Store` 对象（结构同上）

**Mock 响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "store_id":       1,
    "store_code":     "S001",
    "store_name":     "葵涌旗舰店",
    "store_location": "香港新界葵涌葵涌道123号",
    "store_area":     150.0,
    "store_status":   "active"
  }
}
```

**门店不存在响应：**

```json
{
  "code":    1001,
  "message": "门店不存在",
  "data":    null
}
```

---

### `POST /api/stores` 新增门店（Go-基础数据中心）

**权限：** `Head`

**请求体：**

```tsx
export interface StoreCreateReq {
  store_code:     string;   // 全局唯一，重复返回 code:1003
  store_name:     string;
  store_location: string;
  store_area:     number;
  store_status:   "active" | "inactive";
}
```

```go
type StoreCreateReq struct {
    StoreCode     string  `json:"store_code"     binding:"required,max=20"`
    StoreName     string  `json:"store_name"     binding:"required,max=100"`
    StoreLocation string  `json:"store_location" binding:"required"`
    StoreArea     float64 `json:"store_area"     binding:"required,gt=0"`
    StoreStatus   string  `json:"store_status"   binding:"required,oneof=active inactive"`
}
```

**请求示例：**

```json
{
  "store_code":     "S004",
  "store_name":     "沙田新城市广场店",
  "store_location": "香港新界沙田正街18号新城市广场",
  "store_area":     200.0,
  "store_status":   "active"
}
```

**成功响应 `data`：** 新建的完整 `Store` 对象（含 `store_id`）

```json
{
  "code": 0,
  "message": "门店创建成功",
  "data": {
    "store_id":       4,
    "store_code":     "S004",
    "store_name":     "沙田新城市广场店",
    "store_location": "香港新界沙田正街18号新城市广场",
    "store_area":     200.0,
    "store_status":   "active"
  }
}
```

**编码重复响应：**

```json
{
  "code":    1003,
  "message": "门店编码 S004 已存在",
  "data":    null
}
```

---

### `PUT /api/stores/:store_id` 修改门店信息（Go-基础数据中心）

**权限：** `Head`（`store_code` 不可修改，后端忽略该字段）

**请求体：**（所有字段可选，仅传需要修改的字段）（store_id store_code不能改）

```tsx
export interface StoreUpdateReq {
  store_name?:     string;
  store_location?: string;
  store_area?:     number;
  store_status?:   "active" | "inactive";
}
```

```go
type StoreUpdateReq struct {
    StoreName     *string  `json:"store_name"`
    StoreLocation *string  `json:"store_location"`
    StoreArea     *float64 `json:"store_area"`
    StoreStatus   *string  `json:"store_status"`
}
```

**请求示例：**

```json
{
  "store_status": "inactive"
}
```

**成功响应 `data`：** 更新后的完整 `Store` 对象

```json
{
  "code": 0,
  "message": "更新成功",
  "data": {
    "store_id":       1,
    "store_code":     "S001",
    "store_name":     "葵涌旗舰店",
    "store_location": "香港新界葵涌葵涌道123号",
    "store_area":     150.0,
    "store_status":   "inactive"
  }
}
```

---

### `DELETE /api/stores/:store_id` 停用门店（Go-基础数据中心）

这里！！！注意，门店停用以后对应的店员账号要怎么处理，我的建议是员工登录的时候检测对应门店是否active

**权限：** `Head`（软删除，将 `store_status` 置为 `"inactive"`）

**无请求体。**

**成功响应：**

```json
{
  "code":    0,
  "message": "门店已停用",
  "data":    null
}
```

**门店不存在响应：**

```json
{
  "code":    1001,
  "message": "门店不存在",
  "data":    null
}
```

---

### 3.2 SKU 目录维护（SKU / SKU_CATEGORY 表）

### `GET /api/skus` 获取 SKU 列表（Go-基础数据中心）

**权限：** `Head` / `Store`

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `page` | number | 否 | 默认 1 |
| `limit` | number | 否 | 默认 10 |
| `keyword` | string | 否 | 模糊匹配 `sku_name` / `sku_code` |
| `category_id` | number | 否 | 按分类过滤 |

**成功响应 `data`：**

```tsx
export interface SKU {
  sku_id:        number;
  sku_code:      string;
  sku_name:      string;
  category_id:   number;   // SKU_CATEGORY.category_id
  category_name: string;   // JOIN SKU_CATEGORY 后附加
  std_cost:      number;   // 标准进价（decimal）
  sug_price:     number;   // 建议售价（decimal）
  sku_status     string;   // enum(sale/unsale)
}
// 响应类型：ApiResponse<PagedData<SKU>>
```

```go
type SKURes struct {
    SkuId        int     `json:"sku_id"`
    SkuCode      string  `json:"sku_code"`
    SkuName      string  `json:"sku_name"`
    CategoryId   int     `json:"category_id"`
    CategoryName string  `json:"category_name"`
    StdCost      float64 `json:"std_cost"`
    SugPrice     float64 `json:"sug_price"`
    SkuStatus    string  `json:"sku_status"`
}
```

**Mock 响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "page":  1,
    "limit": 10,
    "total": 3,
    "data": [
      {
        "sku_id":        101,
        "sku_code":      "SKU001",
        "sku_name":      "可口可乐 330ml",
        "category_id":   1,
        "category_name": "饮料",
        "std_cost":      2.50,
        "sug_price":     5.00,
        "sku_status":    "sale"
      },
      {
        "sku_id":        102,
        "sku_code":      "SKU002",
        "sku_name":      "薯片原味 75g",
        "category_id":   2,
        "category_name": "零食",
        "std_cost":      4.00,
        "sug_price":     8.50,
        "sku_status":    "sale"
      },
      {
        "sku_id":        103,
        "sku_code":      "SKU003",
        "sku_name":      "矿泉水 500ml",
        "category_id":   1,
        "category_name": "饮料",
        "std_cost":      0.80,
        "sug_price":     2.00,
        "sku_status":    "sale"
      }
    ]
  }
}
```

---

### `GET /api/skus/:sku_id` 获取单个 SKU 详情（Go-基础数据中心）

**权限：** `Head` / `Store`

**无请求体。**

**成功响应 `data`：** 单个 `SKU` 对象（结构同上）

**Mock 响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "sku_id":        101,
    "sku_code":      "SKU001",
    "sku_name":      "可口可乐 330ml",
    "category_id":   1,
    "category_name": "饮料",
    "std_cost":      2.50,
    "sug_price":     5.00,
    "sku_status":    "sale"
  }
}
```

---

### `POST /api/skus` 新增 SKU（Go-基础数据中心）

**权限：** `Head`

**请求体：**

```tsx
export interface SKUCreateReq {
  sku_code:    string;
  sku_name:    string;
  category_id: number;
  std_cost:    number;
  sug_price:   number;  // 若 < std_cost 后端返回 code:1002（前端仍可强制提交带 force:true）
  sku_status   string;   // enum(sale)
}
```

```go
type SKUCreateReq struct {
    SkuCode    string  `json:"sku_code"    binding:"required"`
    SkuName    string  `json:"sku_name"    binding:"required"`
    CategoryId int     `json:"category_id" binding:"required,gt=0"`
    StdCost    float64 `json:"std_cost"    binding:"required,gt=0"`
    SugPrice   float64 `json:"sug_price"   binding:"required,gt=0"`
    Force      bool    `json:"force"`       // 价格倒挂时用户确认后传 true
    SkuStatus  string  `json:"sku_status"  binding:"required"`
}
```

**请求示例：**

```json
{
  "sku_code":    "SKU004",
  "sku_name":    "绿茶 500ml",
  "category_id": 1,
  "std_cost":    1.20,
  "sug_price":   3.50,
  "sku_status":    "sale"
}
```

**成功响应 `data`：** 新建的完整 SKU 对象（含 `sku_id` 和 `category_name`）

```json
{
  "code": 0,
  "message": "SKU 创建成功",
  "data": {
    "sku_id":        104,
    "sku_code":      "SKU004",
    "sku_name":      "绿茶 500ml",
    "category_id":   1,
    "category_name": "饮料",
    "std_cost":      1.20,
    "sug_price":     3.50,
    "sku_status":    "sale"
  }
}
```

**价格倒挂响应（`sug_price` < `std_cost`，未传 `force:true`）：**

这里记得后端业务逻辑也判断一下

```json
{
  "code":    1002,
  "message": "建议售价（1.00）低于进价（1.20），请确认后重新提交（附带 force: true）",
  "data": {
    "std_cost":  1.20,
    "sug_price": 1.00,
    "sku_status":"sale"
  }
}
```

**SKU 编码重复响应：**

```json
{
  "code":    1003,
  "message": "SKU 编码 SKU004 已存在",
  "data":    null
}
```

---

### `PUT /api/skus/:sku_id` 修改 SKU（Go-基础数据中心）

**权限：** `Head`（`sku_code` 不可修改，后端忽略；价格变更自动写 audit log）

**请求体：**（所有字段可选）

```tsx
export interface SKUUpdateReq {
  sku_name?:    string;
  category_id?: number;
  std_cost?:    number;
  sug_price?:   number;
  force?:       boolean;  // 价格倒挂二次确认
}
```

```go
type SKUUpdateReq struct {
    SkuName    *string  `json:"sku_name"`
    CategoryId *int     `json:"category_id"`
    StdCost    *float64 `json:"std_cost"`
    SugPrice   *float64 `json:"sug_price"`
    Force      bool     `json:"force"`
}
```

**成功响应 `data`：** 更新后的完整 SKU 对象

```json
{
  "code": 0,
  "message": "更新成功",
  "data": {
    "sku_id":        101,
    "sku_code":      "SKU001",
    "sku_name":      "可口可乐 330ml（新包装）",
    "category_id":   1,
    "category_name": "饮料",
    "std_cost":      2.60,
    "sug_price":     5.50
  }
}
```

---

### `DELETE /api/skus/:sku_id` 停用 SKU（Go-基础数据中心）

**权限：** `Head`

我们的SKU表并没有相应字段，没办法软删除，在表里加了一个字段sku_status，

sku_status变为unsale

**无请求体。**

**成功响应：**

```json
{
  "code":    0,
  "message": "SKU 已停用",
  "data":    null
}
```

---

### `GET /api/sku-categories` 获取所有 SKU 分类（下拉选项用）（Go-基础数据中心）

**权限：** `Head` / `Store`

**无请求参数。**

**成功响应 `data`：**

```tsx
export interface SKUCategory {
  category_id:   number;
  category_name: string;
}
```

**Mock 响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    { "category_id": 1, "category_name": "饮料" },
    { "category_id": 2, "category_name": "零食" },
    { "category_id": 3, "category_name": "日用品" },
    { "category_id": 4, "category_name": "生鲜" }
  ]
}
```

---

### 3.3 用户/人员档案（USER / ROLE 表）

### `GET /api/users` 获取用户列表（Go-基础数据中心）

**权限：** `Head`

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `store_id` | number | 否 | 按门店过滤；传 0 查总部人员 |
| `role_id` | number | 否 | 按角色过滤 |
| `page` | number | 否 | 默认 1 |
| `limit` | number | 否 | 默认 10 |

**成功响应 `data`：**

```tsx
export interface User {
  user_id:      number;
  store_id:     number;   // 总部为 0
  role_id:      number;
  role_name:    "Head" | "Store";
  user_name:    string;
  account_name: string;
  // password 不返回
}
// 响应类型：ApiResponse<PagedData<User>>
```

```go
type UserRes struct {
    UserId      int    `json:"user_id"`
    StoreId     int    `json:"store_id"`
    RoleId      int    `json:"role_id"`
    RoleName    string `json:"role_name"`
    UserName    string `json:"user_name"`
    AccountName string `json:"account_name"`
}
```

**Mock 响应（`GET /api/users?store_id=1`）：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "page":  1,
    "limit": 10,
    "total": 2,
    "data": [
      {
        "user_id":      5,
        "store_id":     1,
        "role_id":      2,
        "role_name":    "Store",
        "user_name":    "李四",
        "account_name": "store001_mgr"
      },
      {
        "user_id":      6,
        "store_id":     1,
        "role_id":      2,
        "role_name":    "Store",
        "user_name":    "王五",
        "account_name": "store001_staff"
      }
    ]
  }
}
```

---

### `POST /api/users` 新增用户（Go-基础数据中心）

**权限：** `Head`

**请求体：**

```tsx
export interface UserCreateReq {
  store_id:     number;   // 总部人员传 0
  role_id:      number;
  user_name:    string;
  account_name: string;
  password:     string;   // 仅创建时传，不出现在任何响应中
}
```

```go
type UserCreateReq struct {
    StoreId     int    `json:"store_id"     binding:"gte=0"`
    RoleId      int    `json:"role_id"      binding:"required,gt=0"`
    UserName    string `json:"user_name"    binding:"required"`
    AccountName string `json:"account_name" binding:"required"`
    Password    string `json:"password"     binding:"required,min=6"`
}
```

**请求示例：**

```json
{
  "store_id":     1,
  "role_id":      2,
  "user_name":    "赵六",
  "account_name": "store001_zhao",
  "password":     "abc123"
}
```

**成功响应 `data`：** 新建用户对象（**不含 password**）

```json
{
  "code": 0,
  "message": "用户创建成功",
  "data": {
    "user_id":      7,
    "store_id":     1,
    "role_id":      2,
    "role_name":    "Store",
    "user_name":    "赵六",
    "account_name": "store001_zhao"
  }
}
```

---

### `PUT /api/users/:user_id` 修改用户信息（Go-基础数据中心）

**权限：** `Head`（`account_name` 不可修改，`password` 单独通过修改密码接口变更）

**请求体：**

```tsx
export interface UserUpdateReq {
  store_id?:  number;
  role_id?:   number;
  user_name?: string;
}
```

```go
type UserUpdateReq struct {
    StoreId  *int    `json:"store_id"`
    RoleId   *int    `json:"role_id"`
    UserName *string `json:"user_name"`
}
```

**成功响应 `data`：** 更新后的完整用户对象（不含 password）

```json
{
  "code": 0,
  "message": "更新成功",
  "data": {
    "user_id":      7,
    "store_id":     2,
    "role_id":      2,
    "role_name":    "Store",
    "user_name":    "赵六（调岗）",
    "account_name": "store001_zhao"
  }
}
```

---

## 4. 门店日常业务

### 4.1 销售流水录入（SALES_DAILY / SALES_DETAIL 表）

### `GET /api/sales/daily` 查询销售流水列表（Go-门店日常经营）

**权限：** `Head`（查所有）/ `Store`（只能查自己 `store_id`，后端强制覆盖）

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `store_id` | number | 是 | 门店 ID |
| `sales_date` | string | 否 | `YYYY-MM-DD`，精确匹配单日 |
| `start_date` | string | 否 | 范围查询起始 `YYYY-MM-DD` |
| `end_date` | string | 否 | 范围查询结束 `YYYY-MM-DD` |
| `page` | number | 否 | 默认 1 |
| `limit` | number | 否 | 默认 10 |

**成功响应 `data`：**

```tsx
export interface SalesDaily {
  sales_id:     number;
  store_id:     number;
  sales_date:   string;    // YYYY-MM-DD
  total_orders: number;
  total_income: number;    // decimal
  total_profit: number;    // decimal
}
// 列表不含 details，需调用单条详情接口获取
// 响应类型：ApiResponse<PagedData<SalesDaily>>
```

**Mock 响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "page":  1,
    "limit": 10,
    "total": 2,
    "data": [
      {
        "sales_id":     1,
        "store_id":     1,
        "sales_date":   "2026-03-14",
        "total_orders": 45,
        "total_income": 12450.50,
        "total_profit": 3200.00
      },
      {
        "sales_id":     2,
        "store_id":     1,
        "sales_date":   "2026-03-13",
        "total_orders": 38,
        "total_income": 9800.00,
        "total_profit": 2600.00
      }
    ]
  }
}
```

---

### `GET /api/sales/daily/:sales_id` 获取单条流水及明细（Go-门店日常经营）

**权限：** `Head` / 归属门店的 `Store`

**无请求体。**

**成功响应 `data`：**

```tsx
export interface SalesDetail {
  detail_id:  number;
  sales_id:   number;
  sku_id:     number;
  sku_name:   string;   // JOIN SKU 附加
  sku_amount: number;
  sku_income: number;
  sku_profit: number;
}

export interface SalesDailyDetail extends SalesDaily {
  details: SalesDetail[];
}
```

```go
type SalesDetailRes struct {
    DetailId  int     `json:"detail_id"`
    SalesId   int     `json:"sales_id"`
    SkuId     int     `json:"sku_id"`
    SkuName   string  `json:"sku_name"`
    SkuAmount int     `json:"sku_amount"`
    SkuIncome float64 `json:"sku_income"`
    SkuProfit float64 `json:"sku_profit"`
}
type SalesDailyDetailRes struct {
    SalesId     int              `json:"sales_id"`
    StoreId     int              `json:"store_id"`
    SalesDate   string           `json:"sales_date"`
    TotalOrders int              `json:"total_orders"`
    TotalIncome float64          `json:"total_income"`
    TotalProfit float64          `json:"total_profit"`
    Details     []SalesDetailRes `json:"details"`
}
```

**Mock 响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "sales_id":     1,
    "store_id":     1,
    "sales_date":   "2026-03-14",
    "total_orders": 45,
    "total_income": 12450.50,
    "total_profit": 3200.00,
    "details": [
      {
        "detail_id":  101,
        "sales_id":   1,
        "sku_id":     101,
        "sku_name":   "可口可乐 330ml",
        "sku_amount": 120,
        "sku_income": 600.00,
        "sku_profit": 300.00
      },
      {
        "detail_id":  102,
        "sales_id":   1,
        "sku_id":     102,
        "sku_name":   "薯片原味 75g",
        "sku_amount": 80,
        "sku_income": 680.00,
        "sku_profit": 360.00
      }
    ]
  }
}
```

---

### `POST /api/sales/daily` 新增/提交销售流水（Go-门店日常经营）

**权限：** `Store`（只能提交自己 `store_id` 的数据，后端校验）

同步扣除库存

**请求体：**

```tsx
export interface SalesDailyCreateReq {
  store_id:     number;
  sales_date:   string;    // YYYY-MM-DD，仅允许过去 48 小时内，否则返回 code:1006
  total_orders: number;
  total_income: number;
  total_profit: number;
  force_overwrite: boolean;   // 当日已有数据时需传 true 才可覆盖
  details: Array<{
    sku_id:     number;
    sku_amount: number;
    sku_income: number;
    sku_profit: number;
  }>;
}
```

```go
type SalesDailyCreateReq struct {
    StoreId       int               `json:"store_id"       binding:"required,gt=0"`
    SalesDate     string            `json:"sales_date"     binding:"required"`
    TotalOrders   int               `json:"total_orders"   binding:"required,gt=0"`
    TotalIncome   float64           `json:"total_income"   binding:"required,gt=0"`
    TotalProfit   float64           `json:"total_profit"   binding:"required"`
    ForceOverwrite bool             `json:"force_overwrite"`
    Details       []SalesDetailReq  `json:"details"        binding:"required,min=1"`
}
type SalesDetailReq struct {
    SkuId     int     `json:"sku_id"     binding:"required,gt=0"`
    SkuAmount int     `json:"sku_amount" binding:"required,gt=0"`
    SkuIncome float64 `json:"sku_income" binding:"required,gte=0"`
    SkuProfit float64 `json:"sku_profit" binding:"required"`
}
```

**请求示例：**

```json
{
  "store_id":      1,
  "sales_date":    "2026-03-14",
  "total_orders":  45,
  "total_income":  12450.50,
  "total_profit":  3200.00,
  "force_overwrite": false,
  "details": [
    { "sku_id": 101, "sku_amount": 120, "sku_income": 600.00,  "sku_profit": 300.00 },
    { "sku_id": 102, "sku_amount": 80,  "sku_income": 680.00,  "sku_profit": 360.00 },
    { "sku_id": 103, "sku_amount": 200, "sku_income": 400.00,  "sku_profit": 240.00 }
  ]
}
```

**成功响应 `data`：** 新建的完整流水记录（含 `sales_id` 和明细的 `detail_id`）

```json
{
  "code": 0,
  "message": "销售流水提交成功",
  "data": {
    "sales_id":     3,
    "store_id":     1,
    "sales_date":   "2026-03-14",
    "total_orders": 45,
    "total_income": 12450.50,
    "total_profit": 3200.00,
    "details": [
      { "detail_id": 201, "sales_id": 3, "sku_id": 101, "sku_name": "可口可乐 330ml", "sku_amount": 120, "sku_income": 600.00,  "sku_profit": 300.00 },
      { "detail_id": 202, "sales_id": 3, "sku_id": 102, "sku_name": "薯片原味 75g",   "sku_amount": 80,  "sku_income": 680.00,  "sku_profit": 360.00 },
      { "detail_id": 203, "sales_id": 3, "sku_id": 103, "sku_name": "矿泉水 500ml",   "sku_amount": 200, "sku_income": 400.00,  "sku_profit": 240.00 }
    ]
  }
}
```

**当日已有数据（未传 `force_overwrite:true`）：**

```json
{
  "code":    1006,
  "message": "2026-03-14 已存在销售记录（sales_id: 1），请确认覆盖后传 force_overwrite: true 重新提交",
  "data": {
    "existing_sales_id": 1
  }
}
```

**超出 48 小时补录限制：**

```json
{
  "code":    1006,
  "message": "超出补录时限，仅允许补录过去 48 小时内的数据",
  "data":    null
}
```

---

### `PUT /api/sales/daily/:sales_id` 修改销售流水（Go-门店日常经营）

同步扣除库存

**权限：** `Store`（只能修改自己门店的数据，后端校验归属）

**请求体：** 同 `SalesDailyCreateReq`（含完整 details，全量覆盖明细）

**成功响应 `data`：** 更新后的完整 `SalesDailyDetail` 对象（结构同 GET 单条）

---

### 4.2 库存实物动态盘点（INVENTORY 表）

### `GET /api/inventory` 查询库存列表（Go-门店日常经营）

**权限：** `Head`（所有门店）/ `Store`（仅自己门店）

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `store_id` | number | 是 | 门店 ID |
| `keyword` | string | 否 | 模糊匹配 `sku_name` / `sku_code` |
| `category_id` | number | 否 | 按分类过滤 |
| `low_stock` | boolean | 否 | `true` 时只返回低于安全阈值的库存 |
| `page` | number | 否 | 默认 1 |
| `limit` | number | 否 | 默认 10 |

**成功响应 `data`：**

```tsx
export interface InventoryItem {
  inventory_id:   number;   // INVENTORY.inventory_id
  store_id:       number;
  sku_id:         number;
  sku_code:       string;   // JOIN SKU 附加
  sku_name:       string;   // JOIN SKU 附加
  category_name:  string;   // JOIN SKU_CATEGORY 附加
  actual_quantity:number;   // INVENTORY.actual_quantity
  is_locked:      boolean;  // 是否被调拨锁定（后端计算）
}
// 响应类型：ApiResponse<PagedData<InventoryItem>>
```

```go
type InventoryItemRes struct {
    InventoryId    int    `json:"inventory_id"`
    StoreId        int    `json:"store_id"`
    SkuId          int    `json:"sku_id"`
    SkuCode        string `json:"sku_code"`
    SkuName        string `json:"sku_name"`
    CategoryName   string `json:"category_name"`
    ActualQuantity int    `json:"actual_quantity"`
    IsLocked       bool   `json:"is_locked"`
}
```

**Mock 响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "page":  1,
    "limit": 10,
    "total": 3,
    "data": [
      {
        "inventory_id":    1,
        "store_id":        1,
        "sku_id":          101,
        "sku_code":        "SKU001",
        "sku_name":        "可口可乐 330ml",
        "category_name":   "饮料",
        "actual_quantity": 23,
        "is_locked":       false
      },
      {
        "inventory_id":    2,
        "store_id":        1,
        "sku_id":          102,
        "sku_code":        "SKU002",
        "sku_name":        "薯片原味 75g",
        "category_name":   "零食",
        "actual_quantity": 156,
        "is_locked":       true
      },
      {
        "inventory_id":    3,
        "store_id":        1,
        "sku_id":          103,
        "sku_code":        "SKU003",
        "sku_name":        "矿泉水 500ml",
        "category_name":   "饮料",
        "actual_quantity": 48,
        "is_locked":       false
      }
    ]
  }
}
```

---

### `POST /api/inventory/adjust` 库存盘点修正（Go-门店日常经营）

我们人为规定这里修改库存是除了正常买卖以外的其他原因

**权限：** `Store`（只能修改自己门店库存）

**请求体：**

```tsx
export interface InventoryAdjustReq {
  store_id:                        number;
  sku_id:                          number;
  actual_quantity:                 number;   // 盘点后实际数量（全量覆盖）
  inventory_diagonsis_result_type: "Normal" | "Shortage" | "Unsale";
  inventory_root_cause:            object;  // AI 建议的原因 JSON，人工修正时可自填
  remark?:                         string;  // 修正幅度 >30% 时必填，否则返回 code:1007
}
```

```go
type InventoryAdjustReq struct {
    StoreId                       int             `json:"store_id"                         binding:"required,gt=0"`
    SkuId                         int             `json:"sku_id"                           binding:"required,gt=0"`
    ActualQuantity                int             `json:"actual_quantity"                  binding:"required,gte=0"`
    InventoryDiagonsisResultType  string          `json:"inventory_diagonsis_result_type"  binding:"required,oneof=Normal Shortage Unsale"`
    InventoryRootCause            json.RawMessage `json:"inventory_root_cause"             binding:"required"`
    Remark                        string          `json:"remark"`
}
```

**请求示例：**

```json
{
  "store_id":                       1,
  "sku_id":                         101,
  "actual_quantity":                20,
  "inventory_diagonsis_result_type":"Shortage",
  "inventory_root_cause":           { "reason": "货架损耗", "detail": "搬运时破损3件" },
  "remark":                         "搬运时破损，已确认"
}
```

**成功响应 `data`：** 更新后的完整库存条目

```json
{
  "code": 0,
  "message": "库存修正成功",
  "data": {
    "inventory_id":    1,
    "store_id":        1,
    "sku_id":          101,
    "sku_code":        "SKU001",
    "sku_name":        "可口可乐 330ml",
    "category_name":   "饮料",
    "actual_quantity": 20,
    "is_locked":       false
  }
}
```

**SKU 被锁定响应（`code:1005`）：**

```json
{
  "code":    1005,
  "message": "SKU 101（可口可乐 330ml）正在参与调拨流程，暂时无法修改库存",
  "data":    null
}
```

**修正幅度 >30% 未填 remark（`code:1007`）：**

```json
{
  "code":    1007,
  "message": "修正幅度超过 30%（当前库存：23，修正后：10），请在 remark 字段填写原因后重新提交",
  "data": {
    "current_quantity": 23,
    "new_quantity":     10,
    "change_ratio":     0.565
  }
}
```

---

### 4.3 调拨单双向确认（TRANSFER_ORDER / TRANSFER_DETAIL 表）

### 调拨单状态机

```
ai_generated
    │
    ▼
pending_approval ──────────────────────────────► cancelled
    │
    ▼
issued_pending_confirmation ──────────────────► cancelled
    │                │
    ▼                ▼
confirmed_executed  in_negotiation ──► pending_approval（总部修改后重下发）
                        │
                        ▼
                    cancelled
```

| 状态值 | 中文含义 | 允许的操作 |
| --- | --- | --- |
| `ai_generated` | AI 建议已生成 | 总部审核 → `pending_approval` |
| `pending_approval` | 待总部审核 | 总部下发 → `issued_pending_confirmation`；总部取消 → `cancelled` |
| `issued_pending_confirmation` | 已下发，待门店确认 | 店长确认 → `confirmed_executed`；店长异议 → `in_negotiation` |
| `in_negotiation` | 协商中 | 总部重新下发 → `issued_pending_confirmation`；总部取消 → `cancelled` |
| `confirmed_executed` | 已确认执行 | 触发库存扣减（终态） |
| `cancelled` | 已作废 | （终态） |

---

### `GET /api/transfers` 查询调拨单列表（Go-门店日常经营）

**权限：** `Head`（全部）/ `Store`（仅自己门店相关单据）

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `store_id` | number | 否 | 按门店过滤 |
| `status` | string | 否 | 按状态过滤，如 `issued_pending_confirmation` |
| `start_date` | string | 否 | `YYYY-MM-DD` |
| `end_date` | string | 否 | `YYYY-MM-DD` |
| `page` | number | 否 | 默认 1 |
| `limit` | number | 否 | 默认 10 |

**成功响应 `data`：**

```tsx
export type TransferStatus =
  | "ai_generated"
  | "pending_approval"
  | "issued_pending_confirmation"
  | "in_negotiation"
  | "confirmed_executed"
  | "cancelled";

export interface TransferDetail {
  detail_id:         number;
  order_id:          number;
  sku_id:            number;
  sku_name:          string;   // JOIN SKU 附加
  suggested_qty:     number;   // AI 建议量
  actual_qty:        number;   // 人工确认量
  transfer_direction:"H2S" | "S2H";
}

export interface TransferOrder {
  order_id:  number;
  store_id:  number;
  store_name:string;    // JOIN STORE 附加
  status:    TransferStatus;
  feedback:  string | null;
  details:   TransferDetail[];
}
// 列表响应类型：ApiResponse<PagedData<TransferOrder>>
```

```go
type TransferDetailRes struct {
    DetailId          int    `json:"detail_id"`
    OrderId           int    `json:"order_id"`
    SkuId             int    `json:"sku_id"`
    SkuName           string `json:"sku_name"`
    SuggestedQty      int    `json:"suggested_qty"`
    ActualQty         int    `json:"actual_qty"`
    TransferDirection string `json:"transfer_direction"`
}
type TransferOrderRes struct {
    OrderId   int                  `json:"order_id"`
    StoreId   int                  `json:"store_id"`
    StoreName string               `json:"store_name"`
    Status    string               `json:"status"`
    Feedback  *string              `json:"feedback"`
    Details   []TransferDetailRes  `json:"details"`
}
```

**Mock 响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "page":  1,
    "limit": 10,
    "total": 2,
    "data": [
      {
        "order_id":  1001,
        "store_id":  1,
        "store_name":"葵涌旗舰店",
        "status":    "issued_pending_confirmation",
        "feedback":  null,
        "details": [
          { "detail_id": 501, "order_id": 1001, "sku_id": 101, "sku_name": "可口可乐 330ml", "suggested_qty": 50, "actual_qty": 50, "transfer_direction": "H2S" },
          { "detail_id": 502, "order_id": 1001, "sku_id": 103, "sku_name": "矿泉水 500ml",   "suggested_qty": 80, "actual_qty": 80, "transfer_direction": "H2S" }
        ]
      },
      {
        "order_id":  1002,
        "store_id":  2,
        "store_name":"旺角分店",
        "status":    "in_negotiation",
        "feedback":  "库容不足，建议可乐调减至30件",
        "details": [
          { "detail_id": 503, "order_id": 1002, "sku_id": 101, "sku_name": "可口可乐 330ml", "suggested_qty": 60, "actual_qty": 0, "transfer_direction": "H2S" }
        ]
      }
    ]
  }
}
```

---

### `POST /api/transfers` 总部新建调拨单（Go-门店日常经营）

**权限：** `Head`

**请求体：**

```tsx
export interface TransferCreateReq {
  store_id: number;
  details:  Array<{
    sku_id:            number;
    suggested_qty:     number;
    actual_qty:        number;
    transfer_direction:"H2S" | "S2H";
  }>;
}
```

```go
type TransferDetailReq struct {
    SkuId             int    `json:"sku_id"             binding:"required,gt=0"`
    SuggestedQty      int    `json:"suggested_qty"      binding:"required,gt=0"`
    ActualQty         int    `json:"actual_qty"         binding:"required,gte=0"`
    TransferDirection string `json:"transfer_direction" binding:"required,oneof=H2S S2H"`
}
type TransferCreateReq struct {
    StoreId int                  `json:"store_id" binding:"required,gt=0"`
    Details []TransferDetailReq  `json:"details"  binding:"required,min=1"`
}
```

**请求示例：**

```json
{
  "store_id": 1,
  "details": [
    { "sku_id": 101, "suggested_qty": 50, "actual_qty": 50, "transfer_direction": "H2S" },
    { "sku_id": 103, "suggested_qty": 80, "actual_qty": 80, "transfer_direction": "H2S" }
  ]
}
```

**成功响应 `data`：** 新建的完整调拨单（含 `order_id` 和明细 `detail_id`），初始状态为 `pending_approval`

```json
{
  "code": 0,
  "message": "调拨单创建成功",
  "data": {
    "order_id":  1003,
    "store_id":  1,
    "store_name":"葵涌旗舰店",
    "status":    "pending_approval",
    "feedback":  null,
    "details": [
      { "detail_id": 601, "order_id": 1003, "sku_id": 101, "sku_name": "可口可乐 330ml", "suggested_qty": 50, "actual_qty": 50, "transfer_direction": "H2S" },
      { "detail_id": 602, "order_id": 1003, "sku_id": 103, "sku_name": "矿泉水 500ml",   "suggested_qty": 80, "actual_qty": 80, "transfer_direction": "H2S" }
    ]
  }
}
```

---

### `PATCH /api/transfers/:order_id/issue` 总部下发调拨单（Go-门店日常经营）

**权限：** `Head`（当前状态必须为 `pending_approval`，否则返回 `code:1004`）

**无请求体。**

**状态流转：** `pending_approval` → `issued_pending_confirmation`

**成功响应 `data`：** 更新后的 `TransferOrder`（`status` 已变更）

```json
{
  "code": 0,
  "message": "调拨单已下发，等待门店确认",
  "data": {
    "order_id":  1003,
    "store_id":  1,
    "store_name":"葵涌旗舰店",
    "status":    "issued_pending_confirmation",
    "feedback":  null,
    "details": [
      { "detail_id": 601, "order_id": 1003, "sku_id": 101, "sku_name": "可口可乐 330ml", "suggested_qty": 50, "actual_qty": 50, "transfer_direction": "H2S" },
      { "detail_id": 602, "order_id": 1003, "sku_id": 103, "sku_name": "矿泉水 500ml",   "suggested_qty": 80, "actual_qty": 80, "transfer_direction": "H2S" }
    ]
  }
}
```

**状态流转非法响应：**

```json
{
  "code":    1004,
  "message": "当前状态为 confirmed_executed，不允许执行下发操作",
  "data": {
    "current_status": "confirmed_executed"
  }
}
```

---

### `PATCH /api/transfers/:order_id/acknowledge` 门店确认接单（Go-门店日常经营）

**权限：** `Store`（归属门店，当前状态必须为 `issued_pending_confirmation`）

**请求体：**（可选，附带实际确认数量修改，不传则沿用 `suggested_qty`）

```tsx
export interface AcknowledgeReq {
  details?: Array<{
    detail_id: number;
    actual_qty: number;   // 门店确认的实际数量
  }>;
}
```

```go
type AcknowledgeDetailReq struct {
    DetailId  int `json:"detail_id"  binding:"required,gt=0"`
    ActualQty int `json:"actual_qty" binding:"required,gte=0"`
}
type AcknowledgeReq struct {
    Details []AcknowledgeDetailReq `json:"details"`
}
```

**请求示例：**

```json
{
  "details": [
    { "detail_id": 601, "actual_qty": 50 },
    { "detail_id": 602, "actual_qty": 75 }
  ]
}
```

**状态流转：** `issued_pending_confirmation` → `confirmed_executed`，同时触发 INVENTORY `actual_quantity` 扣减/增加

**成功响应 `data`：** 更新后的 `TransferOrder`

```json
{
  "code": 0,
  "message": "调拨单已确认，库存已同步更新",
  "data": {
    "order_id":  1003,
    "store_id":  1,
    "store_name":"葵涌旗舰店",
    "status":    "confirmed_executed",
    "feedback":  null,
    "details": [
      { "detail_id": 601, "order_id": 1003, "sku_id": 101, "sku_name": "可口可乐 330ml", "suggested_qty": 50, "actual_qty": 50, "transfer_direction": "H2S" },
      { "detail_id": 602, "order_id": 1003, "sku_id": 103, "sku_name": "矿泉水 500ml",   "suggested_qty": 80, "actual_qty": 75, "transfer_direction": "H2S" }
    ]
  }
}
```

---

### `PATCH /api/transfers/:order_id/feedback` 门店发起异议（Go-门店日常经营）

**权限：** `Store`（归属门店，当前状态必须为 `issued_pending_confirmation`）

**请求体：**

```tsx
export interface FeedbackReq {
  feedback: string;   // 对应 TRANSFER_ORDER.feedback 字段，必填
}
```

```go
type FeedbackReq struct {
    Feedback string `json:"feedback" binding:"required"`
}
```

**请求示例：**

```json
{
  "feedback": "库容不足，建议可乐调减至30件，矿泉水维持80件"
}
```

**状态流转：** `issued_pending_confirmation` → `in_negotiation`

**成功响应 `data`：** 更新后的 `TransferOrder`

```json
{
  "code": 0,
  "message": "异议已提交，等待总部处理",
  "data": {
    "order_id":  1003,
    "store_id":  1,
    "store_name":"葵涌旗舰店",
    "status":    "in_negotiation",
    "feedback":  "库容不足，建议可乐调减至30件，矿泉水维持80件",
    "details": [
      { "detail_id": 601, "order_id": 1003, "sku_id": 101, "sku_name": "可口可乐 330ml", "suggested_qty": 50, "actual_qty": 50, "transfer_direction": "H2S" },
      { "detail_id": 602, "order_id": 1003, "sku_id": 103, "sku_name": "矿泉水 500ml",   "suggested_qty": 80, "actual_qty": 80, "transfer_direction": "H2S" }
    ]
  }
}
```

---

### `PATCH /api/transfers/:order_id/confirm` 总部最终确认（协商后重确认）（Go-门店日常经营）

**权限：** `Head`（当前状态必须为 `in_negotiation`）

**请求体：**（可选，修改明细数量后重下发）

```tsx
export interface ConfirmReq {
  details?: Array<{
    detail_id: number;
    actual_qty: number;
  }>;
}
```

**状态流转：** `in_negotiation` → `issued_pending_confirmation`

**成功响应 `data`：** 更新后的 `TransferOrder`（`status` 重置为 `issued_pending_confirmation`，等待门店再次确认）

```json
{
  "code": 0,
  "message": "已修改调拨数量并重新下发，等待门店确认",
  "data": {
    "order_id":  1003,
    "store_id":  1,
    "store_name":"葵涌旗舰店",
    "status":    "issued_pending_confirmation",
    "feedback":  "库容不足，建议可乐调减至30件，矿泉水维持80件",
    "details": [
      { "detail_id": 601, "order_id": 1003, "sku_id": 101, "sku_name": "可口可乐 330ml", "suggested_qty": 50, "actual_qty": 30, "transfer_direction": "H2S" },
      { "detail_id": 602, "order_id": 1003, "sku_id": 103, "sku_name": "矿泉水 500ml",   "suggested_qty": 80, "actual_qty": 80, "transfer_direction": "H2S" }
    ]
  }
}
```

---

### `PATCH /api/transfers/:order_id/cancel` 作废调拨单（Go-门店日常经营）

**权限：** `Head`（任何非终态均可取消）

**无请求体。**

**成功响应：**

```json
{
  "code":    0,
  "message": "调拨单已作废",
  "data":    null
}
```

---

## 5. 智能客流感知

---

### 5.1 WebSocket 实时客流推送

#### **WS** /api/ai/traffic/realtime/:store_id 实时客流推送订阅（Python-云端感知）

**权限：** Head / Store（后端校验 store_id 归属）

**Query** **参数：**

| 参数  | 类型   | 必填 | 说明                   |
| ----- | ------ | ---- | ---------------------- |
| token | string | 是   | JWT Token ?token=<JWT> |

**连接状态说明 (Handshake)：**  

- **连接成功**：返回 `HTTP 101 Switching Protocols`，连接保持。   
- **连接失败 (越权/Token无效)**：拒绝连接，返回 `HTTP 401/403`，触发前端 `ws.onerror` / `ws.onclose`。

**服务端下发报文 (遵循全局 WSTrafficUpdate 规范)：**

JSON

```Plain
{
  "event": "TRAFFIC_TICK",
  "store_id": 101,
  "data": {
    "current_people_count": 15
  }
}
```

- **前端** **Mock** **模拟脚本 (TypeScript)：**

TypeScript

```Plain
// 供前端在云端接口未开发完毕时，本地模拟大屏数字跳动使用
export function mockWebSocketTraffic(storeId: number, callback: (count: number) => void) {
  let currentCount = 10;
  
  const timer = setInterval(() => {
    // 模拟人数随机上下波动 (-2 到 +3)
    const delta = Math.floor(Math.random() * 6) - 2; 
    currentCount = Math.max(0, currentCount + delta); // 保证人数不为负数
    const mockMessage = {
      event: "TRAFFIC_TICK",
      store_id: storeId,
      data: { current_people_count: currentCount }
    };
    
    // 触发前端回调函数更新 UI
    callback(mockMessage.data.current_people_count);
  }, 1000); // 每秒推送一次
  
  // 返回清理函数，供组件销毁时调用
  return () => clearInterval(timer);
}
```

---

## 6. 分析与对话

### 6.1 对话

#### **POST /api/ai/chat/completions 发起 AI 助手对话（Python-云端对话）**

**权限：** Head / Store

**Headers：** `Accept: text/event-stream`, `Content-Type: application/json`

**请求体：**

TypeScript

```Plain
export interface ChatCompletionReq {
  store_id:   number;         
  session_id: string | null;  // 新对话传 null
  query:      string;
}
```

Python

```Plain
class ChatCompletionReq(BaseModel):
    store_id:   int    = Field(..., gt=0)
    session_id: str | None
    query:      str    = Field(..., min_length=1)
```

**请求示例：**

JSON

```Plain
{
  "store_id": 101,
  "session_id": null,
  "query": "昨天矿泉水销量如何？结合客流数据给我个建议"
}
```

**响应流 (SSE Event Stream 规范)：**

Plaintext

```Plain
data: {"session_id":"sess_998","content":"昨天","is_finish":false}
data: {"session_id":"sess_998","content":"矿泉水销量为150瓶。","is_finish":false}
data: {"session_id":"sess_998","content":"","is_finish":true}
```

#### **GET /api/ai/chat/sessions 获取历史对话菜单（Python-云端对话）**

**权限：** Head / Store

**Query** **参数：**

| 参数     | 类型   | 必填 | 说明    |
| -------- | ------ | ---- | ------- |
| store_id | number | 是   | 门店 ID |
| limit    | number | 否   | 默认 20 |

**成功响应 data：**

TypeScript

```Plain
export interface ChatSessionItem {
  session_id:   string;
  title:        string;
  session_time: string; // ISO 8601
}
// 响应类型：ApiResponse<PagedData<ChatSessionItem>>
```

Python

```Plain
class ChatSessionItem(BaseModel):
    session_id:   str
    title:        str
    session_time: str
```

**Mock** **响应：**

JSON

```Plain
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [
      {
        "session_id": "sess_998",
        "title": "询问矿泉水销量",
        "session_time": "2026-03-24T10:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 20
  }
}
```

#### **GET /api/ai/chat/history 获取单次对话详情（Python-云端对话）**

**权限：** Head / Store

**Query** **参数：**

| 参数       | 类型   | 必填 | 说明            |
| ---------- | ------ | ---- | --------------- |
| session_id | string | 是   | 关联的会话 UUID |

**成功响应 data：**

TypeScript

```Plain
export interface ChatMessage {
  role:      "user" | "assistant";
  content:   string;
  chat_time: string;
}

export interface ChatHistoryRes {
  session_id: string;
  store_id:   number;
  messages:   ChatMessage[];
}
```

Python

```Plain
class ChatMessage(BaseModel):
    role:      str
    content:   str
    chat_time: str
    
class ChatHistoryRes(BaseModel):
    session_id: str
    store_id:   int
    messages:   list[ChatMessage]
```

**Mock** **响应：**

JSON

```Plain
{
  "code": 0,
  "message": "success",
  "data": {
    "session_id": "sess_998",
    "store_id": 101,
    "messages": [
      {
        "role": "user",
        "content": "昨天矿泉水销量如何？",
        "chat_time": "2026-03-24T10:00:00Z"
      },
      {
        "role": "assistant",
        "content": "昨天矿泉水销量为 150 瓶。",
        "chat_time": "2026-03-24T10:00:15Z"
      }
    ]
  }
}
```

**失败响应示例 (越权访问他人对话)：**

JSON

```Plain
{
  "code": 2002,
  "message": "越权操作：您无权查看该门店的对话记录",
  "data": null
}
```

---

## 7. Mock 数据总览

### 7.1 全局基础 Mock（直接复制使用）

```tsx
// mock/base.ts

// STORE
export const mockStores = [
  { store_id: 1, store_code: "S001", store_name: "葵涌旗舰店",   store_location: "香港新界葵涌葵涌道123号",     store_area: 150.0, store_status: "active"   },
  { store_id: 2, store_code: "S002", store_name: "旺角分店",     store_location: "香港九龙旺角西洋菜南街88号", store_area: 98.5,  store_status: "active"   },
  { store_id: 3, store_code: "S003", store_name: "铜锣湾分店",   store_location: "香港铜锣湾轩尼诗道500号",    store_area: 120.0, store_status: "inactive" }
];

// SKU
export const mockSKUs = [
  { sku_id: 101, sku_code: "SKU001", sku_name: "可口可乐 330ml", category_id: 1, category_name: "饮料", std_cost: 2.50, sug_price: 5.00, sku_status："sale" },
  { sku_id: 102, sku_code: "SKU002", sku_name: "薯片原味 75g",   category_id: 2, category_name: "零食", std_cost: 4.00, sug_price: 8.50, sku_status："sale" },
  { sku_id: 103, sku_code: "SKU003", sku_name: "矿泉水 500ml",   category_id: 1, category_name: "饮料", std_cost: 0.80, sug_price: 2.00, sku_status："sale" }
];

// INVENTORY（门店1）
export const mockInventory = [
  { inventory_id: 1, store_id: 1, sku_id: 101, sku_code: "SKU001", sku_name: "可口可乐 330ml", category_name: "饮料", actual_quantity: 23,  is_locked: false },
  { inventory_id: 2, store_id: 1, sku_id: 102, sku_code: "SKU002", sku_name: "薯片原味 75g",   category_name: "零食", actual_quantity: 156, is_locked: true  },
  { inventory_id: 3, store_id: 1, sku_id: 103, sku_code: "SKU003", sku_name: "矿泉水 500ml",   category_name: "饮料", actual_quantity: 8,   is_locked: false }
];

// CUSTOMER_LOG（门店1，最近3小时）
export const mockTrafficLogs = [
  { customer_log_id: 301, store_id: 1, record_timestamp: "2026-03-14T14:00:00Z", in_count: 45 },
  { customer_log_id: 302, store_id: 1, record_timestamp: "2026-03-14T15:00:00Z", in_count: 67 },
  { customer_log_id: 303, store_id: 1, record_timestamp: "2026-03-14T16:00:00Z", in_count: 32 }
];

// TRANSFER_ORDER（状态机演示，覆盖全部6个状态）
export const mockTransferOrders = [
  {
    order_id: 1001, store_id: 1, store_name: "葵涌旗舰店",
    status: "issued_pending_confirmation", feedback: null,
    details: [
      { detail_id: 501, order_id: 1001, sku_id: 101, sku_name: "可口可乐 330ml", suggested_qty: 50, actual_qty: 50, transfer_direction: "H2S" }
    ]
  },
  {
    order_id: 1002, store_id: 2, store_name: "旺角分店",
    status: "in_negotiation", feedback: "库容不足，建议可乐调减至30件",
    details: [
      { detail_id: 502, order_id: 1002, sku_id: 101, sku_name: "可口可乐 330ml", suggested_qty: 60, actual_qty: 0, transfer_direction: "H2S" }
    ]
  },
  {
    order_id: 1003, store_id: 3, store_name: "铜锣湾分店",
    status: "confirmed_executed", feedback: null,
    details: [
      { detail_id: 503, order_id: 1003, sku_id: 103, sku_name: "矿泉水 500ml", suggested_qty: 100, actual_qty: 100, transfer_direction: "H2S" }
    ]
  }
];
```

---

## 8. 错误码速查表

| code | HTTP 状态码 | 场景 | message 示例 |
| --- | --- | --- | --- |
| `0` | 200 | 成功 | `"ok"` / `"操作成功"` |
| `1001` | 400 | 参数校验失败 | `"account_name 不能为空"` |
| `1002` | 200 | 价格倒挂（需二次确认） | `"建议售价低于进价，请确认后传 force:true"` |
| `1003` | 409 | 编码重复 | `"门店编码 S001 已存在"` |
| `1004` | 400 | 调拨单状态流转非法 | `"当前状态 confirmed_executed 不允许此操作"` |
| `1005` | 423 | SKU 被调拨锁定 | `"SKU 101 正在参与调拨，暂不可修改库存"` |
| `1006` | 400 | 销售补录超限 | `"超出 48 小时补录时限"` |
| `1007` | 400 | 库存修正幅度过大 | `"修正幅度超 30%，请填写 remark"` |
| `2001` | 401 | Token 无效/过期 | `"Token 已过期，请重新登录"` |
| `2002` | 403 | 越权访问 | `"无权访问门店 2 的数据"` |
| `5001` | 500 | 服务器内部错误 | `"服务器内部错误，请稍后重试"` |
| `5002` | 200 | AI 引擎超时 | `"AI 分析超时，请稍后重试"` |

---

## 9. 接口汇总索引

| 模块 | Method | 路径 | 描述 | 权限 |
| --- | --- | --- | --- | --- |
| **认证** | POST | `/api/auth/login` | 登录获取 JWT | 公开 |
| **认证** | GET | `/api/auth/me` | 获取当前用户信息 | 已登录 |
| **门店** | GET | `/api/stores` | 门店列表（分页+搜索） | Head |
| **门店** | GET | `/api/stores/:store_id` | 门店详情 | Head/Store |
| **门店** | POST | `/api/stores` | 新增门店 | Head |
| **门店** | PUT | `/api/stores/:store_id` | 修改门店 | Head |
| **门店** | DELETE | `/api/stores/:store_id` | 停用门店 | Head |
| **SKU** | GET | `/api/skus` | SKU 列表 | Head/Store |
| **SKU** | GET | `/api/skus/:sku_id` | SKU 详情 | Head/Store |
| **SKU** | POST | `/api/skus` | 新增 SKU | Head |
| **SKU** | PUT | `/api/skus/:sku_id` | 修改 SKU | Head |
| **SKU** | DELETE | `/api/skus/:sku_id` | 停用 SKU | Head |
| **SKU分类** | GET | `/api/sku-categories` | 获取所有分类 | Head/Store |
| **用户** | GET | `/api/users` | 用户列表 | Head |
| **用户** | POST | `/api/users` | 新增用户 | Head |
| **用户** | PUT | `/api/users/:user_id` | 修改用户 | Head |
| **销售** | GET | `/api/sales/daily` | 流水列表 | Head/Store |
| **销售** | GET | `/api/sales/daily/:sales_id` | 单条流水+明细 | Head/Store |
| **销售** | POST | `/api/sales/daily` | 提交流水 | Store |
| **销售** | PUT | `/api/sales/daily/:sales_id` | 修改流水 | Store |
| **库存** | GET | `/api/inventory` | 库存列表 | Head/Store |
| **库存** | POST | `/api/inventory/adjust` | 库存盘点修正 | Store |
| **调拨** | GET | `/api/transfers` | 调拨单列表 | Head/Store |
| **调拨** | POST | `/api/transfers` | 新建调拨单 | Head |
| **调拨** | PATCH | `/api/transfers/:order_id/issue` | 总部下发 | Head |
| **调拨** | PATCH | `/api/transfers/:order_id/acknowledge` | 门店确认 | Store |
| **调拨** | PATCH | `/api/transfers/:order_id/feedback` | 门店异议 | Store |
| **调拨** | PATCH | `/api/transfers/:order_id/confirm` | 总部协商确认 | Head |
| **调拨** | PATCH | `/api/transfers/:order_id/cancel` | 作废 | Head |
| **客流** | WS | `/api/ai/traffic/realtime/:store_id` | 实时客流推送订阅 | Head/Store |
| **对话** | POST | `/api/ai/chat/completions` | 发起 AI 助手对话 | Head/Store |
| **对话** | GET | `/api/ai/chat/sessions` | 获取历史对话菜单 | Head/Store |
| **对话** | GET | `/api/ai/chat/history` | 获取单次对话详情 | Head/Store |


---