import {
  AegisHttpClient,
  HttpError,
  AegisMockApi,
  mockWebSocketTraffic,
  DEFAULT_API_BASES,
  type ApiResponse,
  type AcknowledgeReq,
  type ChatCompletionChunk,
  type ChatCompletionReq,
  type ChatHistoryRes,
  type ChatSessionListData,
  type ChatSessionsQuery,
  type FeedbackReq,
  type InventoryAdjustReq,
  type InventoryItem,
  type InventoryQuery,
  type LoginReq,
  type LoginRes,
  type PagedData,
  type PasswordChangeReq,
  type SalesDaily,
  type SalesDailyCreateReq,
  type SalesDailyDetail,
  type SalesDailyUpdateReq,
  type SalesQuery,
  type Store,
  type SKU,
  type SKUCategory,
  type SkusQuery,
  type ChatSessionItem,
  type TransferOrder,
  type TransfersQuery,
  type UserMe,
  type WSTrafficUpdate,
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

function normalizeWsBase(): string {
  const base = DEFAULT_API_BASES.trafficSense;
  if (base.startsWith("https://")) {
    return `wss://${base.slice("https://".length)}`;
  }
  if (base.startsWith("http://")) {
    return `ws://${base.slice("http://".length)}`;
  }
  return base;
}

function isWSTrafficUpdate(payload: unknown, expectedStoreId: number): payload is WSTrafficUpdate {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const data = payload as Record<string, unknown>;
  if (data.event !== "TRAFFIC_TICK") {
    return false;
  }
  if (data.store_id !== expectedStoreId) {
    return false;
  }
  if (!data.data || typeof data.data !== "object") {
    return false;
  }
  const tickData = data.data as Record<string, unknown>;
  return typeof tickData.current_people_count === "number";
}

export interface TrafficRealtimeHandlers {
  onTick: (payload: WSTrafficUpdate) => void;
  onOpen?: () => void;
  onError?: (message: string) => void;
  onClose?: () => void;
}

export function subscribeTrafficRealtime(
  store_id: number,
  handlers: TrafficRealtimeHandlers
): () => void {
  if (useMock) {
    handlers.onOpen?.();
    return mockWebSocketTraffic(store_id, (count) => {
      handlers.onTick({
        event: "TRAFFIC_TICK",
        store_id,
        data: { current_people_count: count },
      });
    });
  }

  const token = readAuthToken();
  if (!token) {
    handlers.onError?.("缺少 JWT token，无法订阅实时客流");
    return () => {};
  }

  const ws = new WebSocket(
    `${normalizeWsBase()}/ai/traffic/realtime/${store_id}?token=${encodeURIComponent(token)}`
  );

  ws.onopen = () => {
    handlers.onOpen?.();
  };

  ws.onmessage = (evt) => {
    try {
      const payload = JSON.parse(evt.data as string) as unknown;
      if (!isWSTrafficUpdate(payload, store_id)) {
        handlers.onError?.("收到的客流推送字段不符合规范");
        return;
      }
      handlers.onTick(payload);
    } catch {
      handlers.onError?.("客流推送消息解析失败");
    }
  };

  ws.onerror = () => {
    handlers.onError?.("实时客流连接异常");
  };

  ws.onclose = () => {
    handlers.onClose?.();
  };

  return () => {
    ws.close();
  };
}

export interface ChatCompletionsHandlers {
  onChunk: (chunk: ChatCompletionChunk) => void;
  onError?: (message: string) => void;
}

export async function fetchChatSessions(query: ChatSessionsQuery): Promise<ChatSessionListData> {
  if (useMock) {
    const res = await mockApi.getChatSessions(query);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getPaged<ChatSessionItem>("aiAssistant", "/ai/chat/sessions", query);
}

export async function fetchChatHistory(session_id: string): Promise<ChatHistoryRes> {
  if (useMock) {
    const res = await mockApi.getChatHistory(session_id);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getOne<ChatHistoryRes>(
    "aiAssistant",
    `/ai/chat/history?session_id=${encodeURIComponent(session_id)}`
  );
}

export function streamChatCompletions(
  payload: ChatCompletionReq,
  handlers: ChatCompletionsHandlers
): () => void {
  if (useMock) {
    return mockApi.streamChatCompletions(payload, handlers.onChunk);
  }

  const token = readAuthToken();
  if (!token) {
    handlers.onError?.("缺少 JWT token，无法发起对话");
    return () => {};
  }

  const controller = new AbortController();
  void (async () => {
    try {
      const res = await fetch(`${DEFAULT_API_BASES.aiAssistant}/ai/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        handlers.onError?.("AI 对话连接失败");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) {
            continue;
          }
          const raw = trimmed.slice("data:".length).trim();
          if (!raw) {
            continue;
          }
          try {
            const chunk = JSON.parse(raw) as ChatCompletionChunk;
            handlers.onChunk(chunk);
          } catch {
            handlers.onError?.("AI 对话流消息解析失败");
            return;
          }
        }
      }
    } catch {
      if (!controller.signal.aborted) {
        handlers.onError?.("AI 对话流请求异常");
      }
    }
  })();

  return () => {
    controller.abort();
  };
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

export async function changePassword(payload: PasswordChangeReq): Promise<null> {
  if (useMock) {
    const token = readAuthToken();
    if (!token) {
      throw new HttpError(401, "缺少 JWT token，无法修改密码");
    }
    const res = await mockApi.changePassword(token, payload);
    return unwrapMockEnvelope(res);
  }

  const token = readAuthToken();
  if (!token) {
    throw new HttpError(401, "缺少 JWT token，无法修改密码");
  }

  const res = await fetch(`${DEFAULT_API_BASES.foundationData}/auth/password`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const payloadRes = (await res.json()) as ApiResponse<null>;
  if (!res.ok || payloadRes.code !== 0) {
    throw new HttpError(res.status, payloadRes.message || "请求失败");
  }
  return payloadRes.data;
}

export async function fetchSalesDaily(query: SalesQuery): Promise<PagedData<SalesDaily>> {
  if (useMock) {
    const res = await mockApi.getSales(query);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getPaged<SalesDaily>("storeOps", "/sales/daily", query);
}

export async function fetchSkus(query: SkusQuery): Promise<PagedData<SKU>> {
  if (useMock) {
    const res = await mockApi.getSkus(query);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getPaged<SKU>("foundationData", "/skus", query);
}

export async function fetchStoreById(store_id: number): Promise<Store> {
  if (useMock) {
    const res = await mockApi.getStoreById(store_id);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getOne<Store>("foundationData", `/stores/${store_id}`);
}

export async function fetchSkuCategories(): Promise<SKUCategory[]> {
  if (useMock) {
    const res = await mockApi.getSkuCategories();
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getOne<SKUCategory[]>("foundationData", "/sku-categories");
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

async function patchTransfer<TReq extends object, TRes>(
  order_id: number,
  action: "acknowledge" | "feedback",
  body?: TReq,
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
  return payloadRes.data as TRes;
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
