import {
  AegisHttpClient,
  HttpError,
  AegisMockApi,
  DEFAULT_API_BASES,
  type ApiResponse,
  type AcknowledgeReq,
  type ConfirmReq,
  type FeedbackReq,
  type InventoryAdjustReq,
  type InventoryItem,
  type InventoryQuery,
  type LoginReq,
  type LoginRes,
  type PagedData,
  type SalesDaily,
  type SalesDailyCreateReq,
  type SalesDailyDetail,
  type SalesDailyUpdateReq,
  type SalesQuery,
  type TransferCreateReq,
  type TransferOrder,
  type TransfersQuery,
  type UserMe,
} from "@aegis/shared";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const mockApi = new AegisMockApi();
const anonHttp = new AegisHttpClient(DEFAULT_API_BASES);
const AUTH_KEY = "aegis_store_auth";

function httpWithToken(token?: string) {
  return new AegisHttpClient(DEFAULT_API_BASES, token);
}

function readAuthToken(): string | undefined {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token;
  } catch {
    return undefined;
  }
}

function statusFromCode(code: number): number {
  if (code === 2001) {
    return 401;
  }
  if (code === 2002) {
    return 403;
  }
  if (code === 1003) {
    return 409;
  }
  return 400;
}

function unwrapMockEnvelope<T>(payload: ApiResponse<T | null>): T {
  if (payload.code !== 0 || payload.data === null) {
    throw new HttpError(statusFromCode(payload.code), payload.message || "请求失败");
  }
  return payload.data;
}

function authedHttp(): AegisHttpClient {
  return httpWithToken(readAuthToken());
}

export async function login(payload: LoginReq): Promise<LoginRes> {
  if (useMock) {
    const res = await mockApi.login(payload);
    return unwrapMockEnvelope(res);
  }
  return anonHttp.postOne<LoginReq, LoginRes>("foundationData", "/auth/login", payload);
}

export async function me(token: string): Promise<UserMe> {
  if (useMock) {
    const res = await mockApi.me(token);
    return unwrapMockEnvelope(res);
  }
  return httpWithToken(token).getOne<UserMe>("foundationData", "/auth/me");
}

export async function fetchSalesDaily(query: SalesQuery): Promise<PagedData<SalesDaily>> {
  if (useMock) {
    const res = await mockApi.getSales(query);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getPaged<SalesDaily>("storeOps", "/sales/daily", query);
}

export async function fetchSalesDailyDetail(sales_id: number): Promise<SalesDailyDetail> {
  if (useMock) {
    const res = await mockApi.getSalesById(sales_id);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getOne<SalesDailyDetail>("storeOps", `/sales/daily/${sales_id}`);
}

export async function createSalesDaily(payload: SalesDailyCreateReq): Promise<SalesDailyDetail> {
  if (useMock) {
    const res = await mockApi.createSalesDaily(payload);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().postOne<SalesDailyCreateReq, SalesDailyDetail>(
    "storeOps",
    "/sales/daily",
    payload
  );
}

export async function updateSalesDaily(
  sales_id: number,
  payload: SalesDailyUpdateReq
): Promise<SalesDailyDetail> {
  if (useMock) {
    const res = await mockApi.updateSalesDaily(sales_id, payload);
    return unwrapMockEnvelope(res);
  }
  const res = await fetch(`${DEFAULT_API_BASES.storeOps}/sales/daily/${sales_id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(readAuthToken() ? { Authorization: `Bearer ${readAuthToken()}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const payloadRes = (await res.json()) as ApiResponse<SalesDailyDetail | null>;
  if (!res.ok || payloadRes.code !== 0 || payloadRes.data === null) {
    throw new HttpError(res.status, payloadRes.message || "请求失败");
  }
  return payloadRes.data;
}

export async function fetchInventory(query: InventoryQuery): Promise<PagedData<InventoryItem>> {
  if (useMock) {
    const res = await mockApi.getInventory(query);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getPaged<InventoryItem>("storeOps", "/inventory", query);
}

export async function adjustInventory(payload: InventoryAdjustReq): Promise<InventoryItem> {
  if (useMock) {
    const res = await mockApi.adjustInventory(payload);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().postOne<InventoryAdjustReq, InventoryItem>(
    "storeOps",
    "/inventory/adjust",
    payload
  );
}

export async function fetchTransfers(query: TransfersQuery): Promise<PagedData<TransferOrder>> {
  if (useMock) {
    const res = await mockApi.getTransfers(query);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getPaged<TransferOrder>("storeOps", "/transfers", query);
}

export async function createTransfer(payload: TransferCreateReq): Promise<TransferOrder> {
  if (useMock) {
    const res = await mockApi.createTransfer(payload);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().postOne<TransferCreateReq, TransferOrder>("storeOps", "/transfers", payload);
}

async function patchTransfer<TReq extends object, TRes>(
  order_id: number,
  action: "issue" | "acknowledge" | "feedback" | "confirm" | "cancel",
  body?: TReq
): Promise<TRes> {
  const res = await fetch(`${DEFAULT_API_BASES.storeOps}/transfers/${order_id}/${action}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(readAuthToken() ? { Authorization: `Bearer ${readAuthToken()}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payloadRes = (await res.json()) as ApiResponse<TRes | null>;
  if (!res.ok || payloadRes.code !== 0 || payloadRes.data === null) {
    throw new HttpError(res.status, payloadRes.message || "请求失败");
  }
  return payloadRes.data;
}

export async function issueTransfer(order_id: number): Promise<TransferOrder> {
  if (useMock) {
    const res = await mockApi.issueTransfer(order_id);
    return unwrapMockEnvelope(res);
  }
  return patchTransfer<{}, TransferOrder>(order_id, "issue");
}

export async function acknowledgeTransfer(
  order_id: number,
  payload: AcknowledgeReq
): Promise<TransferOrder> {
  if (useMock) {
    const res = await mockApi.acknowledgeTransfer(order_id, payload);
    return unwrapMockEnvelope(res);
  }
  return patchTransfer<AcknowledgeReq, TransferOrder>(order_id, "acknowledge", payload);
}

export async function feedbackTransfer(order_id: number, payload: FeedbackReq): Promise<TransferOrder> {
  if (useMock) {
    const res = await mockApi.feedbackTransfer(order_id, payload);
    return unwrapMockEnvelope(res);
  }
  return patchTransfer<FeedbackReq, TransferOrder>(order_id, "feedback", payload);
}

export async function confirmTransfer(order_id: number, payload: ConfirmReq): Promise<TransferOrder> {
  if (useMock) {
    const res = await mockApi.confirmTransfer(order_id, payload);
    return unwrapMockEnvelope(res);
  }
  return patchTransfer<ConfirmReq, TransferOrder>(order_id, "confirm", payload);
}

export async function cancelTransfer(order_id: number): Promise<null> {
  if (useMock) {
    const res = await mockApi.cancelTransfer(order_id);
    return unwrapMockEnvelope(res);
  }
  return patchTransfer<{}, null>(order_id, "cancel");
}
