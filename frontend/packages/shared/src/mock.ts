import type {
  AcknowledgeReq,
  ApiResponse,
  ChatCompletionChunk,
  ChatCompletionReq,
  ChatHistoryRes,
  ChatSessionItem,
  ChatSessionListData,
  ChatSessionsQuery,
  ConfirmReq,
  FeedbackReq,
  InventoryAdjustReq,
  InventoryItem,
  InventoryQuery,
  LoginReq,
  LoginRes,
  PagedData,
  PasswordChangeReq,
  SKUCategory,
  SKUCreateReq,
  SKUUpdateReq,
  SKU,
  SkusQuery,
  SalesDaily,
  SalesDailyCreateReq,
  SalesDailyDetail,
  SalesDailyUpdateReq,
  SalesQuery,
  StoreCreateReq,
  StoreUpdateReq,
  Store,
  StoresQuery,
  TransferOrder,
  TransferStatus,
  TransferCreateReq,
  TransfersQuery,
  UserCreateReq,
  UserUpdateReq,
  User,
  UserMe,
  UsersQuery,
} from "./types";

const mockStores: Store[] = [
  {
    store_id: 1,
    store_code: "S001",
    store_name: "葵涌旗舰店",
    store_location: "香港新界葵涌葵涌道123号",
    store_area: 150,
    store_status: "active",
  },
  {
    store_id: 2,
    store_code: "S002",
    store_name: "旺角分店",
    store_location: "香港九龙旺角西洋菜南街88号",
    store_area: 98.5,
    store_status: "active",
  },
  {
    store_id: 3,
    store_code: "S003",
    store_name: "铜锣湾分店",
    store_location: "香港铜锣湾轩尼诗道500号",
    store_area: 120,
    store_status: "inactive",
  },
];

const mockSkus: SKU[] = [
  {
    sku_id: 101,
    sku_code: "SKU001",
    sku_name: "可口可乐 330ml",
    category_id: 1,
    category_name: "饮料",
    std_cost: 2.5,
    sug_price: 5,
    sku_status: "sale",
  },
  {
    sku_id: 102,
    sku_code: "SKU002",
    sku_name: "薯片原味 75g",
    category_id: 2,
    category_name: "零食",
    std_cost: 4,
    sug_price: 8.5,
    sku_status: "sale",
  },
  {
    sku_id: 103,
    sku_code: "SKU003",
    sku_name: "矿泉水 500ml",
    category_id: 1,
    category_name: "饮料",
    std_cost: 0.8,
    sug_price: 2,
    sku_status: "sale",
  },
];

const mockUsers: User[] = [
  {
    user_id: 1,
    store_id: 0,
    role_id: 1,
    role_name: "Head",
    user_name: "张三",
    account_name: "head001",
  },
  {
    user_id: 5,
    store_id: 1,
    role_id: 2,
    role_name: "Store",
    user_name: "李四",
    account_name: "store001_mgr",
  },
];

let mockHeadPassword = "123456";
let mockStorePassword = "123456";

const mockSkuCategories: SKUCategory[] = [
  { category_id: 1, category_name: "饮料" },
  { category_id: 2, category_name: "零食" },
  { category_id: 3, category_name: "日用品" },
  { category_id: 4, category_name: "生鲜" },
];

const mockSales: SalesDaily[] = [
  {
    sales_id: 1,
    store_id: 1,
    sales_date: "2026-03-14",
    total_orders: 45,
    total_income: 12450.5,
    total_profit: 3200,
  },
  {
    sales_id: 2,
    store_id: 1,
    sales_date: "2026-03-13",
    total_orders: 38,
    total_income: 9800,
    total_profit: 2600,
  },
];

let nextSalesId = 3;
let nextSalesDetailId = 201;

const mockSalesDetails: Record<number, SalesDailyDetail> = {
  1: {
    sales_id: 1,
    store_id: 1,
    sales_date: "2026-03-14",
    total_orders: 45,
    total_income: 12450.5,
    total_profit: 3200,
    details: [
      {
        detail_id: 101,
        sales_id: 1,
        sku_id: 101,
        sku_name: "可口可乐 330ml",
        sku_amount: 120,
        sku_income: 600,
        sku_profit: 300,
      },
      {
        detail_id: 102,
        sales_id: 1,
        sku_id: 102,
        sku_name: "薯片原味 75g",
        sku_amount: 80,
        sku_income: 680,
        sku_profit: 360,
      },
    ],
  },
  2: {
    sales_id: 2,
    store_id: 1,
    sales_date: "2026-03-13",
    total_orders: 38,
    total_income: 9800,
    total_profit: 2600,
    details: [
      {
        detail_id: 103,
        sales_id: 2,
        sku_id: 103,
        sku_name: "矿泉水 500ml",
        sku_amount: 200,
        sku_income: 400,
        sku_profit: 240,
      },
    ],
  },
};

let nextOrderId = 1003;
let nextTransferDetailId = 601;

const mockInventory: InventoryItem[] = [
  {
    inventory_id: 1,
    store_id: 1,
    sku_id: 101,
    sku_code: "SKU001",
    sku_name: "可口可乐 330ml",
    category_name: "饮料",
    actual_quantity: 23,
    is_locked: false,
  },
  {
    inventory_id: 2,
    store_id: 1,
    sku_id: 102,
    sku_code: "SKU002",
    sku_name: "薯片原味 75g",
    category_name: "零食",
    actual_quantity: 156,
    is_locked: true,
  },
  {
    inventory_id: 3,
    store_id: 1,
    sku_id: 103,
    sku_code: "SKU003",
    sku_name: "矿泉水 500ml",
    category_name: "饮料",
    actual_quantity: 8,
    is_locked: false,
  },
];

const mockTransfers: TransferOrder[] = [
  {
    order_id: 1001,
    store_id: 1,
    store_name: "葵涌旗舰店",
    status: "issued_pending_confirmation",
    feedback: null,
    created_at: "2026-03-14T09:30:00Z",
    updated_at: "2026-03-14T10:00:00Z",
    details: [
      {
        detail_id: 501,
        order_id: 1001,
        sku_id: 101,
        sku_name: "可口可乐 330ml",
        suggested_qty: 50,
        actual_qty: 50,
        transfer_direction: "H2S",
      },
    ],
  },
  {
    order_id: 1002,
    store_id: 2,
    store_name: "旺角分店",
    status: "in_negotiation",
    feedback: "库容不足，建议可乐调减至30件",
    created_at: "2026-03-15T08:45:00Z",
    updated_at: "2026-03-15T11:20:00Z",
    details: [
      {
        detail_id: 502,
        order_id: 1002,
        sku_id: 101,
        sku_name: "可口可乐 330ml",
        suggested_qty: 60,
        actual_qty: 0,
        transfer_direction: "H2S",
      },
    ],
  },
];

const mockChatSessions: ChatSessionItem[] = [
  {
    session_id: "sess_998",
    title: "询问矿泉水销量",
    session_time: "2026-03-24T10:00:00Z",
  },
];

const mockChatHistories: Record<string, ChatHistoryRes> = {
  sess_998: {
    session_id: "sess_998",
    store_id: 1,
    messages: [
      {
        role: "user",
        content: "昨天矿泉水销量如何？",
        chat_time: "2026-03-24T10:00:00Z",
      },
      {
        role: "assistant",
        content: "昨天矿泉水销量为 150 瓶。",
        chat_time: "2026-03-24T10:00:15Z",
      },
    ],
  },
};

let nextChatSessionId = 999;


function toPaged<T>(data: T[], page = 1, limit = 10): PagedData<T> {
  return {
    page,
    limit,
    total: data.length,
    data: data.slice((page - 1) * limit, page * limit),
  };
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

function filterByKeyword<T>(
  rows: T[],
  keyword: string | undefined,
  projector: (row: T) => string
): T[] {
  if (!keyword) {
    return rows;
  }
  const kw = normalizeText(keyword);
  return rows.filter((row) => normalizeText(projector(row)).includes(kw));
}

function inDateRange(value: string, start?: string, end?: string): boolean {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return false;
  }
  if (start && time < new Date(start).getTime()) {
    return false;
  }
  if (end && time > new Date(end).getTime()) {
    return false;
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function ok<T>(data: T, message = "ok"): ApiResponse<T> {
  return { code: 0, message, data };
}

export function mockWebSocketTraffic(storeId: number, callback: (count: number) => void) {
  let currentCount = 10;

  const timer = setInterval(() => {
    const delta = Math.floor(Math.random() * 6) - 2;
    currentCount = Math.max(0, currentCount + delta);
    const mockMessage = {
      event: "TRAFFIC_TICK",
      store_id: storeId,
      data: { current_people_count: currentCount },
    };

    callback(mockMessage.data.current_people_count);
  }, 1000);

  return () => clearInterval(timer);
}

export class AegisMockApi {
  public async login(payload: LoginReq): Promise<ApiResponse<LoginRes | null>> {
    await sleep(120);

    if (payload.account_name === "head001" && payload.password === mockHeadPassword) {
      return {
        code: 0,
        message: "登录成功",
        data: {
          user_id: 1,
          account_name: "head001",
          role_name: "Head",
          store_id: 0,
          user_name: "张三",
          token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_payload.mock_sig",
        },
      };
    }

    if (payload.account_name === "store001_mgr" && payload.password === mockStorePassword) {
      return {
        code: 0,
        message: "登录成功",
        data: {
          user_id: 5,
          account_name: "store001_mgr",
          role_name: "Store",
          store_id: 1,
          user_name: "李四",
          token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_store_payload.mock_sig",
        },
      };
    }

    return {
      code: 1001,
      message: "账号或密码错误",
      data: null,
    };
  }

  public async me(token: string): Promise<ApiResponse<UserMe | null>> {
    await sleep(100);

    if (token === "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_payload.mock_sig") {
      return {
        code: 0,
        message: "ok",
        data: {
          user_id: 1,
          account_name: "head001",
          user_name: "张三",
          role_id: 1,
          role_name: "Head",
          store_id: 0,
          permissions: ["store:manage", "sku:manage", "transfer:approve", "analytics:all"],
        },
      };
    }

    if (token === "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_store_payload.mock_sig") {
      return {
        code: 0,
        message: "ok",
        data: {
          user_id: 5,
          account_name: "store001_mgr",
          user_name: "李四",
          role_id: 2,
          role_name: "Store",
          store_id: 1,
          permissions: ["sales:edit", "inventory:edit", "transfer:ack", "traffic:view"],
        },
      };
    }

    return {
      code: 2001,
      message: "Token 已过期，请重新登录",
      data: null,
    };
  }

  public async changePassword(
    token: string,
    payload: PasswordChangeReq
  ): Promise<ApiResponse<null>> {
    await sleep(120);

    if (token === "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_payload.mock_sig") {
      if (payload.old_password !== mockHeadPassword) {
        return { code: 1001, message: "旧密码不正确", data: null };
      }
      mockHeadPassword = payload.new_password;
      return ok(null, "密码修改成功");
    }

    if (token === "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_store_payload.mock_sig") {
      if (payload.old_password !== mockStorePassword) {
        return { code: 1001, message: "旧密码不正确", data: null };
      }
      mockStorePassword = payload.new_password;
      return ok(null, "密码修改成功");
    }

    return { code: 2001, message: "Token 已过期，请重新登录", data: null };
  }

  public async getStores(query?: StoresQuery): Promise<ApiResponse<PagedData<Store>>> {
    await sleep(150);

    let rows = [...mockStores];
    rows = filterByKeyword(rows, query?.keyword, (x) => `${x.store_name} ${x.store_code}`);
    if (query?.store_status) {
      rows = rows.filter((x) => x.store_status === query.store_status);
    }

    return ok(toPaged(rows, query?.page ?? 1, query?.limit ?? 10));
  }

  public async getStoreById(store_id: number): Promise<ApiResponse<Store | null>> {
    await sleep(120);
    const target = mockStores.find((x) => x.store_id === store_id);
    if (!target) {
      return { code: 1001, message: "门店不存在", data: null };
    }
    return ok(target);
  }

  public async createStore(payload: StoreCreateReq): Promise<ApiResponse<Store | null>> {
    await sleep(150);
    const exists = mockStores.some((x) => x.store_code === payload.store_code);
    if (exists) {
      return {
        code: 1003,
        message: `门店编码 ${payload.store_code} 已存在`,
        data: null,
      };
    }

    const row: Store = {
      store_id: Math.max(...mockStores.map((x) => x.store_id)) + 1,
      ...payload,
    };
    mockStores.push(row);
    return ok(row, "门店创建成功");
  }

  public async updateStore(
    store_id: number,
    payload: StoreUpdateReq
  ): Promise<ApiResponse<Store | null>> {
    await sleep(150);
    const idx = mockStores.findIndex((x) => x.store_id === store_id);
    if (idx < 0) {
      return { code: 1001, message: "门店不存在", data: null };
    }
    mockStores[idx] = { ...mockStores[idx], ...payload };
    return ok(mockStores[idx], "更新成功");
  }

  public async deactivateStore(store_id: number): Promise<ApiResponse<null>> {
    await sleep(120);
    const idx = mockStores.findIndex((x) => x.store_id === store_id);
    if (idx < 0) {
      return { code: 1001, message: "门店不存在", data: null };
    }
    mockStores[idx] = { ...mockStores[idx], store_status: "inactive" };
    return ok(null, "门店已停用");
  }

  public async getSkus(query?: SkusQuery): Promise<ApiResponse<PagedData<SKU>>> {
    await sleep(150);

    let rows = [...mockSkus];
    rows = filterByKeyword(rows, query?.keyword, (x) => `${x.sku_name} ${x.sku_code}`);
    if (query?.category_id) {
      rows = rows.filter((x) => x.category_id === query.category_id);
    }

    return ok(toPaged(rows, query?.page ?? 1, query?.limit ?? 10));
  }

  public async getSkuById(sku_id: number): Promise<ApiResponse<SKU | null>> {
    await sleep(120);
    const target = mockSkus.find((x) => x.sku_id === sku_id);
    if (!target) {
      return { code: 1001, message: "SKU 不存在", data: null };
    }
    return ok(target);
  }

  public async createSku(payload: SKUCreateReq): Promise<ApiResponse<SKU | null>> {
    await sleep(150);
    const exists = mockSkus.some((x) => x.sku_code === payload.sku_code);
    if (exists) {
      return {
        code: 1003,
        message: `SKU 编码 ${payload.sku_code} 已存在`,
        data: null,
      };
    }

    if (payload.sug_price < payload.std_cost && !payload.force) {
      return {
        code: 1002,
        message: `建议售价（${payload.sug_price.toFixed(2)}）低于进价（${payload.std_cost.toFixed(
          2
        )}），请确认后重新提交（附带 force: true）`,
        data: {
          std_cost: payload.std_cost,
          sug_price: payload.sug_price,
          sku_status: payload.sku_status,
        } as unknown as SKU,
      };
    }

    const category = mockSkuCategories.find((x) => x.category_id === payload.category_id);
    const row: SKU = {
      sku_id: Math.max(...mockSkus.map((x) => x.sku_id)) + 1,
      sku_code: payload.sku_code,
      sku_name: payload.sku_name,
      category_id: payload.category_id,
      category_name: category?.category_name ?? "未知分类",
      std_cost: payload.std_cost,
      sug_price: payload.sug_price,
      sku_status: payload.sku_status,
    };
    mockSkus.push(row);
    return ok(row, "SKU 创建成功");
  }

  public async updateSku(sku_id: number, payload: SKUUpdateReq): Promise<ApiResponse<SKU | null>> {
    await sleep(150);
    const idx = mockSkus.findIndex((x) => x.sku_id === sku_id);
    if (idx < 0) {
      return { code: 1001, message: "SKU 不存在", data: null };
    }

    const nextStdCost = payload.std_cost ?? mockSkus[idx].std_cost;
    const nextSugPrice = payload.sug_price ?? mockSkus[idx].sug_price;
    if (nextSugPrice < nextStdCost && !payload.force) {
      return {
        code: 1002,
        message: `建议售价（${nextSugPrice.toFixed(2)}）低于进价（${nextStdCost.toFixed(
          2
        )}），请确认后重新提交（附带 force: true）`,
        data: {
          std_cost: nextStdCost,
          sug_price: nextSugPrice,
          sku_status: mockSkus[idx].sku_status,
        } as unknown as SKU,
      };
    }

    let nextCategoryName = mockSkus[idx].category_name;
    if (payload.category_id !== undefined) {
      nextCategoryName =
        mockSkuCategories.find((x) => x.category_id === payload.category_id)?.category_name ??
        "未知分类";
    }

    mockSkus[idx] = {
      ...mockSkus[idx],
      ...payload,
      category_name: nextCategoryName,
    };
    return ok(mockSkus[idx], "更新成功");
  }

  public async deactivateSku(sku_id: number): Promise<ApiResponse<null>> {
    await sleep(120);
    const idx = mockSkus.findIndex((x) => x.sku_id === sku_id);
    if (idx < 0) {
      return { code: 1001, message: "SKU 不存在", data: null };
    }
    mockSkus[idx] = { ...mockSkus[idx], sku_status: "unsale" };
    return ok(null, "SKU 已停用");
  }

  public async getSkuCategories(): Promise<ApiResponse<SKUCategory[]>> {
    await sleep(100);
    return ok(mockSkuCategories);
  }

  public async getUsers(query?: UsersQuery): Promise<ApiResponse<PagedData<User>>> {
    await sleep(150);

    let rows = [...mockUsers];
    if (query?.store_id !== undefined) {
      rows = rows.filter((x) => x.store_id === query.store_id);
    }
    if (query?.role_id !== undefined) {
      rows = rows.filter((x) => x.role_id === query.role_id);
    }

    return ok(toPaged(rows, query?.page ?? 1, query?.limit ?? 10));
  }

  public async createUser(payload: UserCreateReq): Promise<ApiResponse<User | null>> {
    await sleep(150);
    const exists = mockUsers.some((x) => x.account_name === payload.account_name);
    if (exists) {
      return { code: 1003, message: `账号 ${payload.account_name} 已存在`, data: null };
    }

    const row: User = {
      user_id: Math.max(...mockUsers.map((x) => x.user_id)) + 1,
      store_id: payload.store_id,
      role_id: payload.role_id,
      role_name: payload.role_id === 1 ? "Head" : "Store",
      user_name: payload.user_name,
      account_name: payload.account_name,
    };
    mockUsers.push(row);
    return ok(row, "用户创建成功");
  }

  public async updateUser(user_id: number, payload: UserUpdateReq): Promise<ApiResponse<User | null>> {
    await sleep(150);
    const idx = mockUsers.findIndex((x) => x.user_id === user_id);
    if (idx < 0) {
      return { code: 1001, message: "用户不存在", data: null };
    }

    const nextRoleId = payload.role_id ?? mockUsers[idx].role_id;
    mockUsers[idx] = {
      ...mockUsers[idx],
      ...payload,
      role_name: nextRoleId === 1 ? "Head" : "Store",
    };
    return ok(mockUsers[idx], "更新成功");
  }

  public async getSales(query: SalesQuery): Promise<ApiResponse<PagedData<SalesDaily>>> {
    await sleep(150);

    let rows = [...mockSales];
    rows = rows.filter((x) => x.store_id === query.store_id);
    if (query.sales_date) {
      rows = rows.filter((x) => x.sales_date === query.sales_date);
    }
    if (query.start_date || query.end_date) {
      rows = rows.filter((x) => inDateRange(x.sales_date, query.start_date, query.end_date));
    }

    return ok(toPaged(rows, query.page ?? 1, query.limit ?? 10));
  }

  public async getSalesById(sales_id: number): Promise<ApiResponse<SalesDailyDetail | null>> {
    await sleep(120);
    const row = mockSalesDetails[sales_id];
    if (!row) {
      return { code: 1001, message: "销售流水不存在", data: null };
    }
    return ok(row);
  }

  public async createSalesDaily(
    payload: SalesDailyCreateReq
  ): Promise<ApiResponse<SalesDailyDetail | null>> {
    await sleep(150);

    const existing = mockSales.find(
      (x) => x.store_id === payload.store_id && x.sales_date === payload.sales_date
    );
    if (existing && !payload.force_overwrite) {
      return {
        code: 1006,
        message: `${payload.sales_date} 已存在销售记录（sales_id: ${existing.sales_id}），请确认覆盖后传 force_overwrite: true 重新提交`,
        data: null,
      };
    }

    if (existing && payload.force_overwrite) {
      return this.updateSalesDaily(existing.sales_id, payload);
    }

    const sales_id = nextSalesId++;
    const detailRows = payload.details.map((d) => ({
      detail_id: nextSalesDetailId++,
      sales_id,
      sku_id: d.sku_id,
      sku_name: mockSkus.find((s) => s.sku_id === d.sku_id)?.sku_name ?? "未知SKU",
      sku_amount: d.sku_amount,
      sku_income: d.sku_income,
      sku_profit: d.sku_profit,
    }));

    const summary: SalesDaily = {
      sales_id,
      store_id: payload.store_id,
      sales_date: payload.sales_date,
      total_orders: payload.total_orders,
      total_income: payload.total_income,
      total_profit: payload.total_profit,
    };

    const detail: SalesDailyDetail = {
      ...summary,
      details: detailRows,
    };

    mockSales.push(summary);
    mockSalesDetails[sales_id] = detail;
    return ok(detail, "销售流水提交成功");
  }

  public async updateSalesDaily(
    sales_id: number,
    payload: SalesDailyUpdateReq
  ): Promise<ApiResponse<SalesDailyDetail | null>> {
    await sleep(150);
    const idx = mockSales.findIndex((x) => x.sales_id === sales_id);
    if (idx < 0) {
      return { code: 1001, message: "销售流水不存在", data: null };
    }

    const detailRows = payload.details.map((d) => ({
      detail_id: nextSalesDetailId++,
      sales_id,
      sku_id: d.sku_id,
      sku_name: mockSkus.find((s) => s.sku_id === d.sku_id)?.sku_name ?? "未知SKU",
      sku_amount: d.sku_amount,
      sku_income: d.sku_income,
      sku_profit: d.sku_profit,
    }));

    const summary: SalesDaily = {
      sales_id,
      store_id: payload.store_id,
      sales_date: payload.sales_date,
      total_orders: payload.total_orders,
      total_income: payload.total_income,
      total_profit: payload.total_profit,
    };

    mockSales[idx] = summary;
    mockSalesDetails[sales_id] = { ...summary, details: detailRows };
    return ok(mockSalesDetails[sales_id], "更新成功");
  }

  public async getInventory(query: InventoryQuery): Promise<ApiResponse<PagedData<InventoryItem>>> {
    await sleep(150);

    let rows = [...mockInventory];
    rows = rows.filter((x) => x.store_id === query.store_id);
    rows = filterByKeyword(rows, query.keyword, (x) => `${x.sku_name} ${x.sku_code}`);
    if (query.category_id) {
      rows = rows.filter((x) => {
        const sku = mockSkus.find((s) => s.sku_id === x.sku_id);
        return sku?.category_id === query.category_id;
      });
    }
    if (query.low_stock) {
      rows = rows.filter((x) => x.actual_quantity < 20);
    }

    return ok(toPaged(rows, query.page ?? 1, query.limit ?? 10));
  }

  public async adjustInventory(
    payload: InventoryAdjustReq
  ): Promise<ApiResponse<InventoryItem | null>> {
    await sleep(150);

    const idx = mockInventory.findIndex(
      (x) => x.store_id === payload.store_id && x.sku_id === payload.sku_id
    );
    if (idx < 0) {
      return { code: 1001, message: "库存记录不存在", data: null };
    }

    if (mockInventory[idx].is_locked) {
      return {
        code: 1005,
        message: `SKU ${payload.sku_id}（${mockInventory[idx].sku_name}）正在参与调拨流程，暂时无法修改库存`,
        data: null,
      };
    }

    const current = mockInventory[idx].actual_quantity;
    const ratio = current === 0 ? 1 : Math.abs(payload.actual_quantity - current) / current;
    if (ratio > 0.3 && !payload.remark?.trim()) {
      return {
        code: 1007,
        message: `修正幅度超过 30%（当前库存：${current}，修正后：${payload.actual_quantity}），请在 remark 字段填写原因后重新提交`,
        data: null,
      };
    }

    mockInventory[idx] = {
      ...mockInventory[idx],
      actual_quantity: payload.actual_quantity,
    };
    return ok(mockInventory[idx], "库存修正成功");
  }

  public async getTransfers(query?: TransfersQuery): Promise<ApiResponse<PagedData<TransferOrder>>> {
    await sleep(150);

    let rows = [...mockTransfers];
    if (query?.store_id !== undefined) {
      rows = rows.filter((x) => x.store_id === query.store_id);
    }
    if (query?.status) {
      rows = rows.filter((x) => x.status === query.status);
    }
    if (query?.start_date || query?.end_date) {
      rows = rows.filter((x) => inDateRange(x.created_at, query.start_date, query.end_date));
    }

    return ok(toPaged(rows, query?.page ?? 1, query?.limit ?? 10));
  }

  public async createTransfer(
    payload: TransferCreateReq
  ): Promise<ApiResponse<TransferOrder | null>> {
    await sleep(150);
    const storeName = mockStores.find((x) => x.store_id === payload.store_id)?.store_name ?? "未知门店";
    const order_id = nextOrderId++;
    const details = payload.details.map((d) => ({
      detail_id: nextTransferDetailId++,
      order_id,
      sku_id: d.sku_id,
      sku_name: mockSkus.find((s) => s.sku_id === d.sku_id)?.sku_name ?? "未知SKU",
      suggested_qty: d.suggested_qty,
      actual_qty: d.actual_qty,
      transfer_direction: d.transfer_direction,
    }));

    const row: TransferOrder = {
      order_id,
      store_id: payload.store_id,
      store_name: storeName,
      status: "pending_approval",
      feedback: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      details,
    };
    mockTransfers.push(row);
    return ok(row, "调拨单创建成功");
  }

  private updateTransferStatus(
    order_id: number,
    from: TransferStatus[],
    to: TransferStatus,
    message: string
  ): ApiResponse<TransferOrder | null> {
    const idx = mockTransfers.findIndex((x) => x.order_id === order_id);
    if (idx < 0) {
      return { code: 1001, message: "调拨单不存在", data: null };
    }
    if (!from.includes(mockTransfers[idx].status)) {
      return {
        code: 1004,
        message: `当前状态为 ${mockTransfers[idx].status}，不允许执行此操作`,
        data: null,
      };
    }
    mockTransfers[idx] = {
      ...mockTransfers[idx],
      status: to,
      updated_at: new Date().toISOString(),
    };
    return ok(mockTransfers[idx], message);
  }

  public async issueTransfer(order_id: number): Promise<ApiResponse<TransferOrder | null>> {
    await sleep(120);
    return this.updateTransferStatus(
      order_id,
      ["pending_approval"],
      "issued_pending_confirmation",
      "调拨单已下发，等待门店确认"
    );
  }

  public async acknowledgeTransfer(
    order_id: number,
    payload: AcknowledgeReq
  ): Promise<ApiResponse<TransferOrder | null>> {
    await sleep(120);
    const result = this.updateTransferStatus(
      order_id,
      ["issued_pending_confirmation"],
      "confirmed_executed",
      "调拨单已确认，库存已同步更新"
    );
    if (result.code !== 0 || !result.data) {
      return result;
    }
    if (payload.details?.length) {
      const map = new Map(payload.details.map((x) => [x.detail_id, x.actual_qty]));
      result.data.details = result.data.details.map((d) => ({
        ...d,
        actual_qty: map.get(d.detail_id) ?? d.actual_qty,
      }));
    }
    return result;
  }

  public async feedbackTransfer(
    order_id: number,
    payload: FeedbackReq
  ): Promise<ApiResponse<TransferOrder | null>> {
    await sleep(120);
    const idx = mockTransfers.findIndex((x) => x.order_id === order_id);
    if (idx < 0) {
      return { code: 1001, message: "调拨单不存在", data: null };
    }
    if (mockTransfers[idx].status !== "issued_pending_confirmation") {
      return {
        code: 1004,
        message: `当前状态为 ${mockTransfers[idx].status}，不允许执行此操作`,
        data: null,
      };
    }
    mockTransfers[idx] = {
      ...mockTransfers[idx],
      status: "in_negotiation",
      feedback: payload.feedback,
      updated_at: new Date().toISOString(),
    };
    return ok(mockTransfers[idx], "异议已提交，等待总部处理");
  }

  public async confirmTransfer(
    order_id: number,
    payload: ConfirmReq
  ): Promise<ApiResponse<TransferOrder | null>> {
    await sleep(120);
    const result = this.updateTransferStatus(
      order_id,
      ["in_negotiation"],
      "issued_pending_confirmation",
      "已修改调拨数量并重新下发，等待门店确认"
    );
    if (result.code !== 0 || !result.data) {
      return result;
    }
    if (payload.details?.length) {
      const map = new Map(payload.details.map((x) => [x.detail_id, x.actual_qty]));
      result.data.details = result.data.details.map((d) => ({
        ...d,
        actual_qty: map.get(d.detail_id) ?? d.actual_qty,
      }));
    }
    return result;
  }

  public async cancelTransfer(order_id: number): Promise<ApiResponse<null>> {
    await sleep(120);
    const idx = mockTransfers.findIndex((x) => x.order_id === order_id);
    if (idx < 0) {
      return { code: 1001, message: "调拨单不存在", data: null };
    }
    if (["confirmed_executed", "cancelled"].includes(mockTransfers[idx].status)) {
      return {
        code: 1004,
        message: `当前状态为 ${mockTransfers[idx].status}，不允许执行此操作`,
        data: null,
      };
    }
    mockTransfers[idx] = {
      ...mockTransfers[idx],
      status: "cancelled",
      updated_at: new Date().toISOString(),
    };
    return ok(null, "调拨单已作废");
  }

  public async getChatSessions(
    query: ChatSessionsQuery
  ): Promise<ApiResponse<ChatSessionListData>> {
    await sleep(100);
    const limit = query.limit ?? 20;
    const filtered = mockChatSessions.filter((item) => {
      const history = mockChatHistories[item.session_id];
      return history?.store_id === query.store_id;
    });
    return ok(toPaged(filtered, 1, limit), "success");
  }

  public async getChatHistory(session_id: string): Promise<ApiResponse<ChatHistoryRes | null>> {
    await sleep(100);
    const history = mockChatHistories[session_id];
    if (!history) {
      return { code: 1001, message: "会话不存在", data: null };
    }
    return ok(history, "success");
  }

  public streamChatCompletions(
    payload: ChatCompletionReq,
    onChunk: (chunk: ChatCompletionChunk) => void
  ): () => void {
    const session_id = payload.session_id ?? `sess_${nextChatSessionId++}`;
    const now = new Date().toISOString();
    const reply = `已收到问题：${payload.query}。建议结合客流高峰时段提前补货矿泉水与高频快消品。`;
    const chunks = [reply.slice(0, 12), reply.slice(12, 24), reply.slice(24)];

    if (!mockChatHistories[session_id]) {
      mockChatHistories[session_id] = {
        session_id,
        store_id: payload.store_id,
        messages: [],
      };
    }

    mockChatHistories[session_id].messages.push({
      role: "user",
      content: payload.query,
      chat_time: now,
    });

    const title = payload.query.slice(0, 20) || "新会话";
    const existingIdx = mockChatSessions.findIndex((x) => x.session_id === session_id);
    const sessionItem: ChatSessionItem = {
      session_id,
      title,
      session_time: now,
    };
    if (existingIdx >= 0) {
      mockChatSessions.splice(existingIdx, 1);
    }
    mockChatSessions.unshift(sessionItem);

    let idx = 0;
    let canceled = false;
    const timer = setInterval(() => {
      if (canceled) {
        clearInterval(timer);
        return;
      }

      if (idx < chunks.length) {
        onChunk({
          session_id,
          content: chunks[idx],
          is_finish: false,
        });
        idx += 1;
        return;
      }

      onChunk({
        session_id,
        content: "",
        is_finish: true,
      });
      mockChatHistories[session_id].messages.push({
        role: "assistant",
        content: reply,
        chat_time: new Date().toISOString(),
      });
      clearInterval(timer);
    }, 220);

    return () => {
      canceled = true;
      clearInterval(timer);
    };
  }

}
