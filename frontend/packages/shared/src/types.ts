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
  foundationData: "http://localhost:8080/api",
  storeOps: "http://localhost:8080/api",
  trafficSense: "http://localhost:8080/api",
  aiAssistant: "http://localhost:8080/api",
};

export interface TrafficTickData {
  current_people_count: number;
}

export interface WSTrafficUpdate {
  event: "TRAFFIC_TICK";
  store_id: number;
  data: TrafficTickData;
}

export interface ChatCompletionReq {
  store_id: number;
  session_id: string | null;
  query: string;
}

export interface ChatCompletionChunk {
  session_id: string;
  content: string;
  is_finish: boolean;
}

export interface ChatSessionsQuery {
  store_id: number;
  limit?: number;
}

export interface ChatSessionItem {
  session_id: string;
  title: string;
  session_time: string;
}

export type ChatSessionListData = PagedData<ChatSessionItem>;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  chat_time: string;
}

export interface ChatHistoryRes {
  session_id: string;
  store_id: number;
  messages: ChatMessage[];
}

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
  store_id: number;
  sales_date?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface InventoryQuery {
  store_id: number;
  keyword?: string;
  category_id?: number;
  low_stock?: boolean;
  page?: number;
  limit?: number;
}

export interface TransfersQuery {
  store_id?: number;
  status?: TransferStatus;
  start_date?: string;
  end_date?: string;
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

export interface SKUCategory {
  category_id: number;
  category_name: string;
}

export interface User {
  user_id: number;
  store_id: number;
  role_id: number;
  role_name: RoleName;
  user_name: string;
  account_name: string;
}

export interface StoreCreateReq {
  store_code: string;
  store_name: string;
  store_location: string;
  store_area: number;
  store_status: "active" | "inactive";
}

export interface StoreUpdateReq {
  store_name?: string;
  store_location?: string;
  store_area?: number;
  store_status?: "active" | "inactive";
}

export interface SKUCreateReq {
  sku_code: string;
  sku_name: string;
  category_id: number;
  std_cost: number;
  sug_price: number;
  force?: boolean;
  sku_status: "sale";
}

export interface SKUUpdateReq {
  sku_name?: string;
  category_id?: number;
  std_cost?: number;
  sug_price?: number;
  force?: boolean;
}

export interface UserCreateReq {
  store_id: number;
  role_id: number;
  user_name: string;
  account_name: string;
  password: string;
}

export interface UserUpdateReq {
  store_id?: number;
  role_id?: number;
  user_name?: string;
}

export interface PasswordChangeReq {
  old_password: string;
  new_password: string;
}

export interface SalesDaily {
  sales_id: number;
  store_id: number;
  sales_date: string;
  total_orders: number;
  total_income: number;
  total_profit: number;
}

export interface SalesDetail {
  detail_id: number;
  sales_id: number;
  sku_id: number;
  sku_name: string;
  sku_amount: number;
  sku_income: number;
  sku_profit: number;
}

export interface SalesDailyDetail extends SalesDaily {
  details: SalesDetail[];
}

export interface SalesDailyCreateReq {
  store_id: number;
  sales_date: string;
  total_orders: number;
  total_income: number;
  total_profit: number;
  force_overwrite: boolean;
  details: Array<{
    sku_id: number;
    sku_amount: number;
    sku_income: number;
    sku_profit: number;
  }>;
}

export type SalesDailyUpdateReq = SalesDailyCreateReq;

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

export interface InventoryAdjustReq {
  store_id: number;
  sku_id: number;
  actual_quantity: number;
  inventory_diagonsis_result_type: "Normal" | "Shortage" | "Unsale";
  inventory_root_cause: object;
  remark?: string;
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
  created_at: string;
  updated_at: string;
  details: TransferDetail[];
}

export interface TransferCreateReq {
  store_id: number;
  details: Array<{
    sku_id: number;
    suggested_qty: number;
    actual_qty: number;
    transfer_direction: "H2S" | "S2H";
  }>;
}

export interface AcknowledgeReq {
  details?: Array<{
    detail_id: number;
    actual_qty: number;
  }>;
}

export interface FeedbackReq {
  feedback: string;
}

export interface ConfirmReq {
  details?: Array<{
    detail_id: number;
    actual_qty: number;
  }>;
}
