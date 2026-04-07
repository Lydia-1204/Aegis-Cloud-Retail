import type {
  InventoryItem,
  InventoryQuery,
  LoginReq,
  LoginRes,
  PagedData,
  SKU,
  SkusQuery,
  SalesDaily,
  SalesQuery,
  Store,
  StoresQuery,
  StoreDashboard,
  TrafficLog,
  TrafficLogsQuery,
  TransferOrder,
  TransfersQuery,
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

const mockTraffic: TrafficLog[] = [
  {
    customer_log_id: 301,
    store_id: 1,
    record_timestamp: "2026-03-14T14:00:00Z",
    in_count: 45,
  },
  {
    customer_log_id: 302,
    store_id: 1,
    record_timestamp: "2026-03-14T15:00:00Z",
    in_count: 67,
  },
  {
    customer_log_id: 303,
    store_id: 1,
    record_timestamp: "2026-03-14T16:00:00Z",
    in_count: 32,
  },
];

const mockDashboard: StoreDashboard = {
  store_id: 1,
  store_name: "葵涌旗舰店",
  date: "2026-03-14",
  traffic_summary: {
    total_in_count: 320,
    current_in_store: 38,
    hourly_breakdown: [
      { hour: 9, in_count: 12 },
      { hour: 10, in_count: 34 },
      { hour: 11, in_count: 45 },
      { hour: 12, in_count: 67 },
      { hour: 13, in_count: 58 },
      { hour: 14, in_count: 45 },
      { hour: 15, in_count: 32 },
      { hour: 16, in_count: 27 },
    ],
  },
  sales_summary: {
    total_orders: 40,
    total_income: 10800,
    total_profit: 2900,
    conversion_rate: 0.125,
  },
  low_stock_alerts: [
    { sku_id: 101, sku_name: "可口可乐 330ml", actual_quantity: 23 },
    { sku_id: 103, sku_name: "矿泉水 500ml", actual_quantity: 8 },
  ],
  pending_transfers_count: 1,
};

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

export class AegisMockApi {
  public async login(payload: LoginReq): Promise<LoginRes> {
    await sleep(120);

    if (payload.account_name === "head001" && payload.password === "123456") {
      return {
        user_id: 1,
        account_name: "head001",
        role_name: "Head",
        store_id: 0,
        user_name: "张三",
        token: "mock-head-token",
      };
    }

    if (payload.account_name === "store001_mgr" && payload.password === "123456") {
      return {
        user_id: 5,
        account_name: "store001_mgr",
        role_name: "Store",
        store_id: 1,
        user_name: "李四",
        token: "mock-store-token",
      };
    }

    throw new Error("账号或密码错误");
  }

  public async me(token: string): Promise<UserMe> {
    await sleep(100);

    if (token === "mock-head-token") {
      return {
        user_id: 1,
        account_name: "head001",
        user_name: "张三",
        role_id: 1,
        role_name: "Head",
        store_id: 0,
        permissions: ["store:manage", "sku:manage", "transfer:approve", "analytics:all"],
      };
    }

    return {
      user_id: 5,
      account_name: "store001_mgr",
      user_name: "李四",
      role_id: 2,
      role_name: "Store",
      store_id: 1,
      permissions: ["sales:edit", "inventory:edit", "transfer:ack", "traffic:view"],
    };
  }

  public async getStores(query?: StoresQuery): Promise<PagedData<Store>> {
    await sleep(150);

    let rows = [...mockStores];
    rows = filterByKeyword(rows, query?.keyword, (x) => `${x.store_name} ${x.store_code}`);
    if (query?.store_status) {
      rows = rows.filter((x) => x.store_status === query.store_status);
    }

    return toPaged(rows, query?.page ?? 1, query?.limit ?? 10);
  }

  public async getSkus(query?: SkusQuery): Promise<PagedData<SKU>> {
    await sleep(150);

    let rows = [...mockSkus];
    rows = filterByKeyword(rows, query?.keyword, (x) => `${x.sku_name} ${x.sku_code}`);
    if (query?.category_id) {
      rows = rows.filter((x) => x.category_id === query.category_id);
    }

    return toPaged(rows, query?.page ?? 1, query?.limit ?? 10);
  }

  public async getUsers(query?: UsersQuery): Promise<PagedData<User>> {
    await sleep(150);

    let rows = [...mockUsers];
    if (query?.store_id !== undefined) {
      rows = rows.filter((x) => x.store_id === query.store_id);
    }
    if (query?.role_id !== undefined) {
      rows = rows.filter((x) => x.role_id === query.role_id);
    }

    return toPaged(rows, query?.page ?? 1, query?.limit ?? 10);
  }

  public async getSales(query?: SalesQuery): Promise<PagedData<SalesDaily>> {
    await sleep(150);

    let rows = [...mockSales];
    if (query?.store_id !== undefined) {
      rows = rows.filter((x) => x.store_id === query.store_id);
    }
    if (query?.sales_date) {
      rows = rows.filter((x) => x.sales_date === query.sales_date);
    }
    if (query?.start_date || query?.end_date) {
      rows = rows.filter((x) => inDateRange(x.sales_date, query.start_date, query.end_date));
    }

    return toPaged(rows, query?.page ?? 1, query?.limit ?? 10);
  }

  public async getInventory(query?: InventoryQuery): Promise<PagedData<InventoryItem>> {
    await sleep(150);

    let rows = [...mockInventory];
    if (query?.store_id !== undefined) {
      rows = rows.filter((x) => x.store_id === query.store_id);
    }
    rows = filterByKeyword(rows, query?.keyword, (x) => `${x.sku_name} ${x.sku_code}`);
    if (query?.category_id) {
      rows = rows.filter((x) => {
        const sku = mockSkus.find((s) => s.sku_id === x.sku_id);
        return sku?.category_id === query.category_id;
      });
    }
    if (query?.low_stock) {
      rows = rows.filter((x) => x.actual_quantity < 20);
    }

    return toPaged(rows, query?.page ?? 1, query?.limit ?? 10);
  }

  public async getTransfers(query?: TransfersQuery): Promise<PagedData<TransferOrder>> {
    await sleep(150);

    let rows = [...mockTransfers];
    if (query?.store_id !== undefined) {
      rows = rows.filter((x) => x.store_id === query.store_id);
    }
    if (query?.status) {
      rows = rows.filter((x) => x.status === query.status);
    }

    return toPaged(rows, query?.page ?? 1, query?.limit ?? 10);
  }

  public async getTrafficLogs(query?: TrafficLogsQuery): Promise<PagedData<TrafficLog>> {
    await sleep(150);

    let rows = [...mockTraffic];
    if (query?.store_id !== undefined) {
      rows = rows.filter((x) => x.store_id === query.store_id);
    }
    if (query?.date) {
      rows = rows.filter((x) => x.record_timestamp.startsWith(query.date ?? ""));
    }
    if (query?.start_time || query?.end_time) {
      rows = rows.filter((x) =>
        inDateRange(x.record_timestamp, query.start_time, query.end_time)
      );
    }

    return toPaged(rows, query?.page ?? 1, query?.limit ?? 100);
  }

  public async getStoreDashboard(storeId = 1): Promise<StoreDashboard> {
    await sleep(120);
    if (storeId === 1) {
      return mockDashboard;
    }

    const store = mockStores.find((x) => x.store_id === storeId) ?? mockStores[0];
    return {
      ...mockDashboard,
      store_id: store.store_id,
      store_name: store.store_name,
    };
  }
}
