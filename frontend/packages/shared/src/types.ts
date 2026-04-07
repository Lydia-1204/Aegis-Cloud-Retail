export type RoleName = "Head" | "Store";

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PagedData<T> {
  page: number;
  limit: number;
  total: number;
  data: T[];
}

export interface ApiBases {
  foundationData: string;
  storeOps: string;
  trafficSense: string;
  aiAssistant: string;
}

export const DEFAULT_API_BASES: ApiBases = {
  foundationData: "http://localhost:8081/api",
  storeOps: "http://localhost:8082/api",
  trafficSense: "http://localhost:8083/api",
  aiAssistant: "http://localhost:8084/api",
};

export interface LoginReq {
  account_name: string;
  password: string;
}

export interface LoginRes {
  user_id: number;
  account_name: string;
  role_name: RoleName;
  store_id: number;
  user_name: string;
  token: string;
}

export interface UserMe {
  user_id: number;
  account_name: string;
  user_name: string;
  role_id: number;
  role_name: RoleName;
  store_id: number;
  permissions: string[];
}

export interface StoresQuery {
  page?: number;
  limit?: number;
  keyword?: string;
  store_status?: "active" | "inactive";
}

export interface SkusQuery {
  page?: number;
  limit?: number;
  keyword?: string;
  category_id?: number;
}

export interface UsersQuery {
  store_id?: number;
  role_id?: number;
  page?: number;
  limit?: number;
}

export interface SalesQuery {
  store_id?: number;
  sales_date?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface InventoryQuery {
  store_id?: number;
  keyword?: string;
  category_id?: number;
  low_stock?: boolean;
  page?: number;
  limit?: number;
}

export interface TransfersQuery {
  store_id?: number;
  status?: TransferStatus;
  page?: number;
  limit?: number;
}

export interface TrafficLogsQuery {
  store_id?: number;
  date?: string;
  start_time?: string;
  end_time?: string;
  page?: number;
  limit?: number;
}

export interface Store {
  store_id: number;
  store_code: string;
  store_name: string;
  store_location: string;
  store_area: number;
  store_status: "active" | "inactive";
}

export interface SKU {
  sku_id: number;
  sku_code: string;
  sku_name: string;
  category_id: number;
  category_name: string;
  std_cost: number;
  sug_price: number;
  sku_status: "sale" | "unsale";
}

export interface User {
  user_id: number;
  store_id: number;
  role_id: number;
  role_name: RoleName;
  user_name: string;
  account_name: string;
}

export interface SalesDaily {
  sales_id: number;
  store_id: number;
  sales_date: string;
  total_orders: number;
  total_income: number;
  total_profit: number;
}

export interface InventoryItem {
  inventory_id: number;
  store_id: number;
  sku_id: number;
  sku_code: string;
  sku_name: string;
  category_name: string;
  actual_quantity: number;
  is_locked: boolean;
}

export type TransferStatus =
  | "ai_generated"
  | "pending_approval"
  | "issued_pending_confirmation"
  | "in_negotiation"
  | "confirmed_executed"
  | "cancelled";

export interface TransferDetail {
  detail_id: number;
  order_id: number;
  sku_id: number;
  sku_name: string;
  suggested_qty: number;
  actual_qty: number;
  transfer_direction: "H2S" | "S2H";
}

export interface TransferOrder {
  order_id: number;
  store_id: number;
  store_name: string;
  status: TransferStatus;
  feedback: string | null;
  details: TransferDetail[];
}

export interface TrafficLog {
  customer_log_id: number;
  store_id: number;
  record_timestamp: string;
  in_count: number;
}

export interface StoreDashboard {
  store_id: number;
  store_name: string;
  date: string;
  traffic_summary: {
    total_in_count: number;
    current_in_store: number;
    hourly_breakdown: Array<{
      hour: number;
      in_count: number;
    }>;
  };
  sales_summary: {
    total_orders: number;
    total_income: number;
    total_profit: number;
    conversion_rate: number;
  };
  low_stock_alerts: Array<{
    sku_id: number;
    sku_name: string;
    actual_quantity: number;
  }>;
  pending_transfers_count: number;
}
