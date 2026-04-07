import {
  AegisHttpClient,
  AegisMockApi,
  DEFAULT_API_BASES,
  type InventoryItem,
  type InventoryQuery,
  type LoginReq,
  type LoginRes,
  type PagedData,
  type SalesDaily,
  type SalesQuery,
  type StoreDashboard,
  type TrafficLog,
  type TrafficLogsQuery,
  type TransferOrder,
  type TransfersQuery,
  type UserMe,
} from "@aegis/shared";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const mockApi = new AegisMockApi();
const anonHttp = new AegisHttpClient(DEFAULT_API_BASES);

function httpWithToken(token?: string) {
  return new AegisHttpClient(DEFAULT_API_BASES, token);
}

export async function login(payload: LoginReq): Promise<LoginRes> {
  if (useMock) {
    return mockApi.login(payload);
  }
  return anonHttp.postOne<LoginReq, LoginRes>("foundationData", "/auth/login", payload);
}

export async function me(token: string): Promise<UserMe> {
  if (useMock) {
    return mockApi.me(token);
  }
  return httpWithToken(token).getOne<UserMe>("foundationData", "/auth/me");
}

export async function fetchStoreDashboard(storeId: number): Promise<StoreDashboard> {
  if (useMock) {
    return mockApi.getStoreDashboard(storeId);
  }
  return anonHttp.getOne<StoreDashboard>("storeOps", `/dashboard/store/${storeId}`);
}

export async function fetchSalesDaily(query: SalesQuery): Promise<PagedData<SalesDaily>> {
  if (useMock) {
    return mockApi.getSales(query);
  }
  return anonHttp.getPaged<SalesDaily>("storeOps", "/sales/daily", query);
}

export async function fetchInventory(query: InventoryQuery): Promise<PagedData<InventoryItem>> {
  if (useMock) {
    return mockApi.getInventory(query);
  }
  return anonHttp.getPaged<InventoryItem>("storeOps", "/inventory", query);
}

export async function fetchTransfers(query: TransfersQuery): Promise<PagedData<TransferOrder>> {
  if (useMock) {
    return mockApi.getTransfers(query);
  }
  return anonHttp.getPaged<TransferOrder>("storeOps", "/transfers", query);
}

export async function fetchTrafficLogs(query: TrafficLogsQuery): Promise<PagedData<TrafficLog>> {
  if (useMock) {
    return mockApi.getTrafficLogs(query);
  }
  return anonHttp.getPaged<TrafficLog>("trafficSense", "/traffic/logs", query);
}

export async function queryAI(
  token: string,
  payload: { query: string; context_store_id?: number }
): Promise<Response> {
  return fetch(`${DEFAULT_API_BASES.aiAssistant}/ai/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}
