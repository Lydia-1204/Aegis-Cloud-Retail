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

### 5.1 视频上传与解析（UC-SENSE-01）

### `POST /api/video/upload` 上传监控视频（multipart/form-data）

**权限：** `Store`

**Form Fields：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `store_id` | number | 是 | 门店 ID |
| `video` | File | 是 | 视频文件（mp4/avi，最大 500MB） |
| `timestamp` | string | 是 | 视频起始时间，ISO 8601 |

**成功响应 `data`：**（异步处理，仅返回任务 ID）

```tsx
export interface VideoUploadRes {
  task_id: string;   // 异步任务 ID，用于轮询状态
  status:  "queued"; // 初始状态固定为 queued
}
```

```json
{
  "code": 0,
  "message": "视频已加入处理队列",
  "data": {
    "task_id": "task_20260314_store1_a3f8c2",
    "status":  "queued"
  }
}
```

---

### `GET /api/video/task/:task_id` 查询视频解析任务状态

**权限：** `Store`（自己门店的任务）/ `Head`

**成功响应 `data`：**

```tsx
export interface VideoTaskStatus {
  task_id:    string;
  store_id:   number;
  status:     "queued" | "processing" | "completed" | "failed";
  progress:   number;   // 0-100
  error_msg:  string | null;
  created_at: string;
  finished_at:string | null;
}
```

**Mock 响应（处理中）：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "task_id":    "task_20260314_store1_a3f8c2",
    "store_id":   1,
    "status":     "processing",
    "progress":   45,
    "error_msg":  null,
    "created_at": "2026-03-14T16:00:00Z",
    "finished_at":null
  }
}
```

**Mock 响应（完成）：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "task_id":    "task_20260314_store1_a3f8c2",
    "store_id":   1,
    "status":     "completed",
    "progress":   100,
    "error_msg":  null,
    "created_at": "2026-03-14T16:00:00Z",
    "finished_at":"2026-03-14T16:04:23Z"
  }
}
```

---

### 5.2 客流统计查询（CUSTOMER_LOG 表，只读）

### `GET /api/traffic/logs` 查询客流记录

**权限：** `Head` / `Store`（仅自己门店）

> ⚠️ `in_count` 由 AI/YOLO 直写，后端拒绝任何针对此表的 POST/PUT 请求。
> 

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `store_id` | number | 是 | 门店 ID |
| `date` | string | 否 | `YYYY-MM-DD`，查询该日所有记录 |
| `start_time` | string | 否 | ISO 8601 范围查询起始 |
| `end_time` | string | 否 | ISO 8601 范围查询结束 |
| `page` | number | 否 | 默认 1 |
| `limit` | number | 否 | 默认 100 |

**成功响应 `data`：**

```tsx
export interface TrafficLog {
  customer_log_id:  number;
  store_id:         number;
  record_timestamp: string;   // ISO 8601，CUSTOMER_LOG.record_timestamp
  in_count:         number;   // 该时间点进店人数，AI 直写，不可修改
}
// 响应类型：ApiResponse<PagedData<TrafficLog>>
```

```go
type TrafficLogRes struct {
    CustomerLogId   int    `json:"customer_log_id"`
    StoreId         int    `json:"store_id"`
    RecordTimestamp string `json:"record_timestamp"`
    InCount         int    `json:"in_count"`
}
```

**Mock 响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "page":  1,
    "limit": 100,
    "total": 3,
    "data": [
      { "customer_log_id": 301, "store_id": 1, "record_timestamp": "2026-03-14T14:00:00Z", "in_count": 45 },
      { "customer_log_id": 302, "store_id": 1, "record_timestamp": "2026-03-14T15:00:00Z", "in_count": 67 },
      { "customer_log_id": 303, "store_id": 1, "record_timestamp": "2026-03-14T16:00:00Z", "in_count": 32 }
    ]
  }
}
```

---

### 5.3 门店经营看板（UC-SENSE-03）

<aside>
💡

这里要分开，实时客流从AI实时客流感知部分获取，其余数据从Go门店经营部分获取

</aside>

### `GET /api/dashboard/store/:store_id` 门店经营实时快照

**权限：** `Head` / 归属门店的 `Store`

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `date` | string | 否 | `YYYY-MM-DD`，默认今日 |

**成功响应 `data`：**

```tsx
export interface StoreDashboard {
  store_id:          number;
  store_name:        string;
  date:              string;          // YYYY-MM-DD

  // 客流汇总（来自 CUSTOMER_LOG）
  traffic_summary: {
    total_in_count:    number;        // 当日累计进店人数（sum of in_count）
    current_in_store:  number;        // 当前在店估算人数
    hourly_breakdown:  Array<{
      hour:     number;               // 0-23
      in_count: number;
    }>;
  };

  // 销售汇总（来自 SALES_DAILY + SALES_DETAIL）
  sales_summary: {
    total_orders:    number;
    total_income:    number;
    total_profit:    number;
    conversion_rate: number;          // total_orders / total_in_count，保留4位小数
  };

  // 低库存预警（来自 INVENTORY，actual_quantity < 安全阈值）
  low_stock_alerts: Array<{
    sku_id:          number;
    sku_name:        string;
    actual_quantity: number;
  }>;

  // 待处理调拨单数量
  pending_transfers_count: number;
}
```

**Mock 响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "store_id":   1,
    "store_name": "葵涌旗舰店",
    "date":       "2026-03-14",
    "traffic_summary": {
      "total_in_count":   320,
      "current_in_store": 38,
      "hourly_breakdown": [
        { "hour": 9,  "in_count": 12 },
        { "hour": 10, "in_count": 34 },
        { "hour": 11, "in_count": 45 },
        { "hour": 12, "in_count": 67 },
        { "hour": 13, "in_count": 58 },
        { "hour": 14, "in_count": 45 },
        { "hour": 15, "in_count": 32 },
        { "hour": 16, "in_count": 27 }
      ]
    },
    "sales_summary": {
      "total_orders":    40,
      "total_income":    10800.00,
      "total_profit":    2900.00,
      "conversion_rate": 0.1250
    },
    "low_stock_alerts": [
      { "sku_id": 101, "sku_name": "可口可乐 330ml", "actual_quantity": 23 },
      { "sku_id": 103, "sku_name": "矿泉水 500ml",   "actual_quantity": 8  }
    ],
    "pending_transfers_count": 1
  }
}
```

---

### 5.4 WebSocket 实时客流推送

### `WS /ws/dashboard?token=<JWT>` 建立实时推送长连接

**连接后无需发送订阅消息**，后端根据 JWT 中的 `store_id` 自动推送对应门店数据（`Head` 角色接收所有门店推送）。

**服务端 → 前端推送消息格式：**

```tsx
// types/websocket.ts
export type WSMessageType = "traffic_update" | "transfer_notify" | "low_stock_alert";

export interface WSTrafficUpdate {
  type: "traffic_update";
  data: {
    store_id:       number;
    in_count_delta: number;   // 本次新增进店人数
    timestamp:      string;   // ISO 8601
  };
}

export interface WSTransferNotify {
  type: "transfer_notify";
  data: {
    order_id:  number;
    store_id:  number;
    status:    TransferStatus;
    message:   string;
  };
}

export interface WSLowStockAlert {
  type: "low_stock_alert";
  data: {
    store_id:        number;
    sku_id:          number;
    sku_name:        string;
    actual_quantity: number;
  };
}

export type WSMessage = WSTrafficUpdate | WSTransferNotify | WSLowStockAlert;
```

**前端使用示例：**

```tsx
const ws = new WebSocket(`ws://localhost:8080/ws/dashboard?token=${token}`);

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data) as WSMessage;
  switch (msg.type) {
    case "traffic_update":
      // 更新 ECharts 客流图
      console.log(`门店${msg.data.store_id} 新增${msg.data.in_count_delta} 人`);
      break;
    case "transfer_notify":
      // 弹出调拨单通知
      break;
    case "low_stock_alert":
      // 显示低库存警告
      break;
  }
};
```

**Mock 推送消息示例：**

```json
// traffic_update
{
  "type": "traffic_update",
  "data": {
    "store_id":       1,
    "in_count_delta": 3,
    "timestamp":      "2026-03-14T17:01:23Z"
  }
}

// transfer_notify（门店收到）
{
  "type": "transfer_notify",
  "data": {
    "order_id": 1003,
    "store_id": 1,
    "status":   "issued_pending_confirmation",
    "message":  "总部已下发调拨单，请及时确认"
  }
}

// low_stock_alert
{
  "type": "low_stock_alert",
  "data": {
    "store_id":        1,
    "sku_id":          101,
    "sku_name":        "可口可乐 330ml",
    "actual_quantity": 8
  }
}
```

---

## 6. 全域分析与决策

### 6.1 全域经营看板（总部视图）

### `GET /api/dashboard/global` 全域经营核心指标

**权限：** `Head`

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `date` | string | 否 | `YYYY-MM-DD`，默认今日 |
| `date_range` | string | 否 | `"week"` | `"month"`，与 `date` 互斥 |

**成功响应 `data`：**

```tsx
export interface GlobalDashboard {
  date:       string;
  date_range: string;

  // 汇总数据
  summary: {
    total_revenue:          number;   // sum(SALES_DAILY.total_income)
    total_profit:           number;   // sum(SALES_DAILY.total_profit)
    total_orders:           number;
    total_traffic:          number;   // sum(CUSTOMER_LOG.in_count)
    avg_conversion_rate:    number;
    pending_transfer_count: number;   // status=issued_pending_confirmation 的调拨单数
  };

  // 门店排行（按 total_income 降序）
  store_ranking: Array<{
    store_id:        number;
    store_name:      string;
    total_income:    number;
    total_orders:    number;
    total_traffic:   number;
    conversion_rate: number;
    rank:            number;
  }>;

  // 近7日营收趋势
  revenue_trend: Array<{
    date:         string;
    total_income: number;
    total_profit: number;
  }>;

  // 异常门店（来自 AI_STORE_DIAGNOSIS）
  anomaly_stores: Array<{
    store_diagnosis_id:        number;
    store_id:                  number;
    store_name:                string;
    store_diagonsis_result_type: string;  // AI_STORE_DIAGNOSIS.store_diagonsis_result_type
    store_root_cause:          object;    // AI_STORE_DIAGNOSIS.store_root_cause (JSON)
  }>;
}
```

**Mock 响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "date":       "2026-03-14",
    "date_range": "day",
    "summary": {
      "total_revenue":          89600.00,
      "total_profit":           23400.00,
      "total_orders":           1240,
      "total_traffic":          8900,
      "avg_conversion_rate":    0.1393,
      "pending_transfer_count": 3
    },
    "store_ranking": [
      { "store_id": 1, "store_name": "葵涌旗舰店",     "total_income": 38200.00, "total_orders": 540, "total_traffic": 3800, "conversion_rate": 0.1421, "rank": 1 },
      { "store_id": 2, "store_name": "旺角分店",       "total_income": 31400.00, "total_orders": 430, "total_traffic": 3200, "conversion_rate": 0.1344, "rank": 2 },
      { "store_id": 3, "store_name": "铜锣湾分店",     "total_income": 20000.00, "total_orders": 270, "total_traffic": 1900, "conversion_rate": 0.1421, "rank": 3 }
    ],
    "revenue_trend": [
      { "date": "2026-03-08", "total_income": 82000.00, "total_profit": 21000.00 },
      { "date": "2026-03-09", "total_income": 95000.00, "total_profit": 25000.00 },
      { "date": "2026-03-10", "total_income": 88000.00, "total_profit": 23000.00 },
      { "date": "2026-03-11", "total_income": 91000.00, "total_profit": 24000.00 },
      { "date": "2026-03-12", "total_income": 78000.00, "total_profit": 20000.00 },
      { "date": "2026-03-13", "total_income": 85000.00, "total_profit": 22000.00 },
      { "date": "2026-03-14", "total_income": 89600.00, "total_profit": 23400.00 }
    ],
    "anomaly_stores": [
      {
        "store_diagnosis_id":         10,
        "store_id":                   2,
        "store_name":                 "旺角分店",
        "store_diagonsis_result_type":"HighTrafficLowConversion",
        "store_root_cause":           { "reason": "核心SKU断货", "sku_ids": [101, 103], "suggestion": "立即补货" }
      }
    ]
  }
}）
```

---

### 6.2 AI 智能供货建议（UC-ANALYSIS-01）

### `GET /api/ai/supply-suggestions` 获取 AI 补货建议（GO-门店经营模块）

读 AI_INVENTORY_DIAGNOSIS表

**权限：** `Head`

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `store_id` | number | 否 | 指定门店，不传则返回全部门店 |
| `days` | number | 否 | 预测周期（天），默认 7 |
| `priority` | string | 否 | `"high"` | `"medium"` | `"low"` 过滤 |

**成功响应 `data`：**

```tsx
export interface SupplySuggestion {
  // 来自 AI_INVENTORY_DIAGNOSIS 表
  inventory_diagnosis_id:          number;
  store_id:                        number;
  store_name:                      string;   // JOIN STORE
  sku_id:                          number;
  sku_name:                        string;   // JOIN SKU
  sku_code:                        string;
  inventory_diagonsis_result_type: "Normal" | "Shortage" | "Unsale";
  inventory_root_cause:            object;   // AI_INVENTORY_DIAGNOSIS.inventory_root_cause

  // 补货建议扩展字段（AI 计算，不存入 ER 表，实时返回）
  current_stock:    number;         // 当前 INVENTORY.actual_quantity
  predicted_demand: number;         // AI 预测需求量
  suggested_qty:    number;         // 建议补货数量
  priority:         "high" | "medium" | "low";
  stockout_in_hours:number | null;  // 预计断货剩余小时数，null 表示无断货风险
}
// 响应类型：ApiResponse<SupplySuggestion[]>
```

```go
type SupplySuggestionRes struct {
    InventoryDiagnosisId          int             `json:"inventory_diagnosis_id"`
    StoreId                       int             `json:"store_id"`
    StoreName                     string          `json:"store_name"`
    SkuId                         int             `json:"sku_id"`
    SkuName                       string          `json:"sku_name"`
    SkuCode                       string          `json:"sku_code"`
    InventoryDiagonsisResultType  string          `json:"inventory_diagonsis_result_type"`
    InventoryRootCause            json.RawMessage `json:"inventory_root_cause"`
    CurrentStock                  int             `json:"current_stock"`
    PredictedDemand               int             `json:"predicted_demand"`
    SuggestedQty                  int             `json:"suggested_qty"`
    Priority                      string          `json:"priority"`
    StockoutInHours               *int            `json:"stockout_in_hours"`
}
```

**Mock 响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "inventory_diagnosis_id":          1,
      "store_id":                        1,
      "store_name":                      "葵涌旗舰店",
      "sku_id":                          101,
      "sku_name":                        "可口可乐 330ml",
      "sku_code":                        "SKU001",
      "inventory_diagonsis_result_type": "Shortage",
      "inventory_root_cause":            { "cause": "近7日销量激增35%，当前库存不足以支撑3天" },
      "current_stock":                   23,
      "predicted_demand":                80,
      "suggested_qty":                   70,
      "priority":                        "high",
      "stockout_in_hours":               18
    },
    {
      "inventory_diagnosis_id":          2,
      "store_id":                        1,
      "store_name":                      "葵涌旗舰店",
      "sku_id":                          102,
      "sku_name":                        "薯片原味 75g",
      "sku_code":                        "SKU002",
      "inventory_diagonsis_result_type": "Unsale",
      "inventory_root_cause":            { "cause": "近14日销量下降60%，建议促销清库" },
      "current_stock":                   180,
      "predicted_demand":                20,
      "suggested_qty":                   0,
      "priority":                        "low",
      "stockout_in_hours":               null
    }
  ]
}
```

---

### `POST /api/ai/supply-suggestions/to-transfer` 将 AI 建议转为调拨单

这个我觉得不用单独做一个API，只要创建调拨单的时候显示出来就行了，我的建议是可以直接删掉？

**权限：** `Head`

**请求体：**

```tsx
export interface SuggestionToTransferReq {
  inventory_diagnosis_id: number;   // 指定哪条建议
  actual_qty:             number;   // 管理员确认的实际调拨数量
  transfer_direction:     "H2S" | "S2H";
}
```

```go
type SuggestionToTransferReq struct {
    InventoryDiagnosisId int    `json:"inventory_diagnosis_id" binding:"required,gt=0"`
    ActualQty            int    `json:"actual_qty"             binding:"required,gt=0"`
    TransferDirection    string `json:"transfer_direction"     binding:"required,oneof=H2S S2H"`
}
```

**成功响应 `data`：** 新建的 `TransferOrder`（`status=pending_approval`，结构同 4.3）

```json
{
  "code": 0,
  "message": "调拨单草稿已创建，请审核后下发",
  "data": {
    "order_id":  1004,
    "store_id":  1,
    "store_name":"葵涌旗舰店",
    "status":    "pending_approval",
    "feedback":  null,
    "details": [
      { "detail_id": 701, "order_id": 1004, "sku_id": 101, "sku_name": "可口可乐 330ml", "suggested_qty": 70, "actual_qty": 70, "transfer_direction": "H2S" }
    ]
  }
}
```

---

### 6.3 全域经营异常监测（UC-ANALYSIS-03）

### `GET /api/analysis/store-diagnoses` 获取门店诊断结果列表

这个我记得是不是说过直接删了来着

**权限：** `Head`

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `store_id` | number | 否 | 不传则返回全部 |
| `result_type` | string | 否 | 精确匹配 `store_diagonsis_result_type` |

**成功响应 `data`：**

```tsx
export interface StoreDiagnosis {
  store_diagnosis_id:          number;
  store_id:                    number;
  store_name:                  string;    // JOIN STORE
  store_diagonsis_result_type: string;    // AI_STORE_DIAGNOSIS.store_diagonsis_result_type
  store_root_cause:            object;    // AI_STORE_DIAGNOSIS.store_root_cause (JSON)
  // 关联的专家策略（来自 EXPERTS_KNOWLEDGE）
  expert_strategy:             string | null;  // EXPERTS_KNOWLEDGE.strategy
}
```

```go
type StoreDiagnosisRes struct {
    StoreDiagnosisId          int             `json:"store_diagnosis_id"`
    StoreId                   int             `json:"store_id"`
    StoreName                 string          `json:"store_name"`
    StoreDiagonsisResultType  string          `json:"store_diagonsis_result_type"`
    StoreRootCause            json.RawMessage `json:"store_root_cause"`
    ExpertStrategy            *string         `json:"expert_strategy"`
}
```

**Mock 响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "store_diagnosis_id":         10,
      "store_id":                   2,
      "store_name":                 "旺角分店",
      "store_diagonsis_result_type":"HighTrafficLowConversion",
      "store_root_cause":           {
        "anomaly": "客流高但转化率低于均值30%",
        "factors": ["核心SKU缺货", "陈列位不合理"],
        "period":  "2026-03-12 至 2026-03-14"
      },
      "expert_strategy": "立即补货核心 SKU，并调整主货架陈列，优先展示高毛利商品"
    },
    {
      "store_diagnosis_id":         11,
      "store_id":                   3,
      "store_name":                 "铜锣湾分店",
      "store_diagonsis_result_type":"Normal",
      "store_root_cause":           { "summary": "各项指标正常" },
      "expert_strategy":            null
    }
  ]
}
```

---

### `GET /api/analysis/inventory-diagnoses` 获取库存诊断结果列表

这个我记得也是说删去来着

**权限：** `Head` / `Store`（仅自己门店）

**Query 参数：** `store_id`、`sku_id`、`result_type`（`Normal` / `Shortage` / `Unsale`）

**成功响应 `data`：**

```tsx
export interface InventoryDiagnosis {
  inventory_diagnosis_id:          number;
  store_id:                        number;
  store_name:                      string;
  sku_id:                          number;
  sku_name:                        string;
  inventory_diagonsis_result_type: "Normal" | "Shortage" | "Unsale";
  inventory_root_cause:            object;  // JSON
}
```

**Mock 响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "inventory_diagnosis_id":          1,
      "store_id":                        1,
      "store_name":                      "葵涌旗舰店",
      "sku_id":                          101,
      "sku_name":                        "可口可乐 330ml",
      "inventory_diagonsis_result_type": "Shortage",
      "inventory_root_cause":            { "cause": "销量激增，补货周期内断货风险高" }
    },
    {
      "inventory_diagnosis_id":          2,
      "store_id":                        1,
      "store_name":                      "葵涌旗舰店",
      "sku_id":                          102,
      "sku_name":                        "薯片原味 75g",
      "inventory_diagonsis_result_type": "Unsale",
      "inventory_root_cause":            { "cause": "周转率低于品类均值60%，建议促销处理" }
    }
  ]
}
```

---

### 6.4 AI 督导对话助手（UC-ANALYSIS-04，双路 RAG）

### `POST /api/ai/query` 发起 AI 问答（SSE 流式返回）

**权限：** `Head` / `Store`

**请求 Content-Type：** `application/json`

**响应 Content-Type：** `text/event-stream`

**请求体：**

```tsx
export interface AIQueryReq {
  query:             string;   // 用户自然语言问题
  context_store_id?: number;  // 可选，限定查询范围；店长必填且只能传自己的 store_id
}
```

```go
type AIQueryReq struct {
    Query           string `json:"query"              binding:"required"`
    ContextStoreId  *int   `json:"context_store_id"`
}
```

**请求示例：**

```json
{
  "query":            "昨天葵涌店转化率多少？",
  "context_store_id": 1
}
```

**SSE 事件流规范（后端逐 token 推送）：**

```tsx
// 每条 SSE 均为：data: <JSON>\n\n

// 1. 流式文本 token
export interface SSEDeltaEvent {
  type:    "delta";
  content: string;
}

// 2. 携带数据引用（AI 引用了哪些数据源）
export interface SSESourceEvent {
  type:    "source";
  sources: Array<{
    table:  string;    // 数据来源表，如 "SALES_DAILY", "CUSTOMER_LOG"
    detail: string;
  }>;
}

// 3. 推荐快捷跳转
export interface SSEActionEvent {
  type:    "action";
  actions: Array<{
    label: string;
    route: string;
  }>;
}

// 4. 流结束
export interface SSEDoneEvent {
  type: "done";
}

// 5. 错误（越权或查询失败）
export interface SSEErrorEvent {
  type:    "error";
  message: string;
}
```

**Go 后端推送示例：**

```go
c.Header("Content-Type", "text/event-stream")
c.Header("Cache-Control", "no-cache")
c.Header("Connection", "keep-alive")

for chunk := range llmStream {
    payload, _ := json.Marshal(map[string]string{"type": "delta", "content": chunk})
    fmt.Fprintf(w, "data: %s\n\n", payload)
    w.(http.Flusher).Flush()
}
fmt.Fprintf(w, "data: %s\n\n", `{"type":"done"}`)
```

**前端接收示例：**

```tsx
const response = await fetch("/api/ai/query", {
  method:  "POST",
  headers: {
    "Content-Type":  "application/json",
    "Authorization": `Bearer${token}`
  },
  body: JSON.stringify({ query: "昨天葵涌店转化率多少？", context_store_id: 1 })
});

const reader  = response.body!.getReader();
const decoder = new TextDecoder();
let   fullAnswer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = decoder.decode(value);
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const evt = JSON.parse(line.slice(6));
    if (evt.type === "delta")  fullAnswer += evt.content;
    if (evt.type === "action") renderQuickActions(evt.actions);
    if (evt.type === "done")   break;
    if (evt.type === "error")  showError(evt.message);
  }
}
```

**Mock SSE 事件流（完整一次会话）：**

```
data: {"type":"delta","content":"昨日（2026-03-13）"}
data: {"type":"delta","content":"葵涌旗舰店"}
data: {"type":"delta","content":"客流 **298 人**，"}
data: {"type":"delta","content":"成交订单 **37 单**，"}
data: {"type":"delta","content":"转化率为 **12.4%**，"}
data: {"type":"delta","content":"较上周同期（15.2%）下降 **2.8 个百分点**。\n\n"}
data: {"type":"delta","content":"主要原因：可口可乐 330ml 库存告急（剩余 23 件），"}
data: {"type":"delta","content":"导致高频购买客流流失。建议立即补货。"}
data: {"type":"source","sources":[{"table":"CUSTOMER_LOG","detail":"2026-03-13 葵涌店客流记录"},{"table":"SALES_DAILY","detail":"2026-03-13 葵涌店日结"},{"table":"AI_INVENTORY_DIAGNOSIS","detail":"SKU101 缺货诊断"}]}
data: {"type":"action","actions":[{"label":"查看补货建议","route":"/ai/supply-suggestions?store_id=1"},{"label":"发起调拨","route":"/transfers/create?store_id=1"}]}
data: {"type":"done"}
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
| **视频** | POST | `/api/video/upload` | 上传视频 | Store |
| **视频** | GET | `/api/video/task/:task_id` | 查询解析任务 | Store/Head |
| **客流** | GET | `/api/traffic/logs` | 客流记录（只读） | Head/Store |
| **看板** | GET | `/api/dashboard/store/:store_id` | 门店经营快照 | Head/Store |
| **看板** | GET | `/api/dashboard/global` | 全域经营指标 | Head |
| **AI分析** | GET | `/api/ai/supply-suggestions` | AI 补货建议 | Head |
| **AI分析** | POST | `/api/ai/supply-suggestions/to-transfer` | 建议转调拨单 | Head |
| **AI分析** | GET | `/api/analysis/store-diagnoses` | 门店诊断列表 | Head |
| **AI分析** | GET | `/api/analysis/inventory-diagnoses` | 库存诊断列表 | Head/Store |
| **AI助手** | POST | `/api/ai/query` | SSE 对话流 | Head/Store |
| **WebSocket** | WS | `/ws/dashboard?token=` | 实时推送长连接 | 已登录 |

---