import {
  AegisHttpClient,
  HttpError,
  AegisMockApi,
  mockWebSocketTraffic,
  DEFAULT_API_BASES,
  type ApiResponse,
  type ChatCompletionChunk,
  type ChatCompletionReq,
  type ChatHistoryRes,
  type ChatSessionListData,
  type ChatSessionsQuery,
  type ChatSessionItem,
  type LoginReq,
  type LoginRes,
  type PagedData,
  type InventoryItem,
  type InventoryQuery,
  type PasswordChangeReq,
  type SKUCategory,
  type SKUCreateReq,
  type SKUUpdateReq,
  type SKU,
  type SkusQuery,
  type StoreCreateReq,
  type StoreUpdateReq,
  type Store,
  type StoresQuery,
  type SalesDaily,
  type SalesDailyDetail,
  type SalesQuery,
  type TransferOrder,
  type TransfersQuery,
  type UserCreateReq,
  type UserUpdateReq,
  type User,
  type TransferCreateReq,
  type ConfirmReq,
  type UserMe,
  type UsersQuery,
  type WSTrafficNoDataUpdate,
  type WSTrafficTickUpdate,
  type WSTrafficUpdate,
} from "@aegis/shared";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const mockApi = new AegisMockApi();
const anonHttp = new AegisHttpClient(DEFAULT_API_BASES);
const AUTH_KEY = "aegis_hq_auth";

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

function unwrapMockEnvelopeNullable<T>(payload: ApiResponse<T>): T {
  if (payload.code !== 0) {
    throw new HttpError(statusFromCode(payload.code), payload.message || "请求失败");
  }
  return payload.data;
}

function authedHttp(): AegisHttpClient {
  return httpWithToken(readAuthToken());
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

      function handleSseLine(line: string): boolean {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) {
          return true;
        }
        const raw = trimmed.slice("data:".length).trim();
        if (!raw) {
          return true;
        }
        try {
          const chunk = JSON.parse(raw) as ChatCompletionChunk;
          handlers.onChunk(chunk);
          return true;
        } catch {
          handlers.onError?.("AI 对话流消息解析失败");
          return false;
        }
      }

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!handleSseLine(line)) {
            return;
          }
        }
      }

      if (buffer.trim() && !handleSseLine(buffer)) {
        return;
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
  if (data.store_id !== expectedStoreId) {
    return false;
  }
  if (data.event === "TRAFFIC_NO_DATA") {
    return data.data === null;
  }
  if (data.event !== "TRAFFIC_TICK") {
    return false;
  }
  if (!data.data || typeof data.data !== "object") {
    return false;
  }
  const tickData = data.data as Record<string, unknown>;
  return typeof tickData.current_people_count === "number";
}

export interface TrafficRealtimeHandlers {
  onTick: (payload: WSTrafficTickUpdate) => void;
  onNoData?: (payload: WSTrafficNoDataUpdate) => void;
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
      if (payload.event === "TRAFFIC_NO_DATA") {
        handlers.onNoData?.(payload);
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
    return unwrapMockEnvelopeNullable(res);
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

export async function fetchStores(query: StoresQuery): Promise<PagedData<Store>> {
  if (useMock) {
    const res = await mockApi.getStores(query);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getPaged<Store>("foundationData", "/stores", query);
}

export async function fetchSkus(query: SkusQuery): Promise<PagedData<SKU>> {
  if (useMock) {
    const res = await mockApi.getSkus(query);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getPaged<SKU>("foundationData", "/skus", query);
}

export async function fetchUsers(query: UsersQuery): Promise<PagedData<User>> {
  if (useMock) {
    const res = await mockApi.getUsers(query);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getPaged<User>("foundationData", "/users", query);
}

export async function fetchStoreById(store_id: number): Promise<Store> {
  if (useMock) {
    const res = await mockApi.getStoreById(store_id);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getOne<Store>("foundationData", `/stores/${store_id}`);
}

export async function createStore(payload: StoreCreateReq): Promise<Store> {
  if (useMock) {
    const res = await mockApi.createStore(payload);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().postOne<StoreCreateReq, Store>("foundationData", "/stores", payload);
}

export async function updateStore(store_id: number, payload: StoreUpdateReq): Promise<Store> {
  if (useMock) {
    const res = await mockApi.updateStore(store_id, payload);
    return unwrapMockEnvelope(res);
  }
  const res = await fetch(`${DEFAULT_API_BASES.foundationData}/stores/${store_id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(readAuthToken() ? { Authorization: `Bearer ${readAuthToken()}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const payloadRes = (await res.json()) as ApiResponse<Store | null>;
  if (!res.ok || payloadRes.code !== 0 || payloadRes.data === null) {
    throw new HttpError(res.status, payloadRes.message || "请求失败");
  }
  return payloadRes.data;
}

export async function deactivateStore(store_id: number): Promise<null> {
  if (useMock) {
    const res = await mockApi.deactivateStore(store_id);
    return unwrapMockEnvelopeNullable(res);
  }
  const res = await fetch(`${DEFAULT_API_BASES.foundationData}/stores/${store_id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(readAuthToken() ? { Authorization: `Bearer ${readAuthToken()}` } : {}),
    },
  });
  const payloadRes = (await res.json()) as ApiResponse<null>;
  if (!res.ok || payloadRes.code !== 0) {
    throw new HttpError(res.status, payloadRes.message || "请求失败");
  }
  return payloadRes.data;
}

export async function fetchSkuById(sku_id: number): Promise<SKU> {
  if (useMock) {
    const res = await mockApi.getSkuById(sku_id);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getOne<SKU>("foundationData", `/skus/${sku_id}`);
}

export async function createSku(payload: SKUCreateReq): Promise<SKU> {
  if (useMock) {
    const res = await mockApi.createSku(payload);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().postOne<SKUCreateReq, SKU>("foundationData", "/skus", payload);
}

export async function updateSku(sku_id: number, payload: SKUUpdateReq): Promise<SKU> {
  if (useMock) {
    const res = await mockApi.updateSku(sku_id, payload);
    return unwrapMockEnvelope(res);
  }
  const res = await fetch(`${DEFAULT_API_BASES.foundationData}/skus/${sku_id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(readAuthToken() ? { Authorization: `Bearer ${readAuthToken()}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const payloadRes = (await res.json()) as ApiResponse<SKU | null>;
  if (!res.ok || payloadRes.code !== 0 || payloadRes.data === null) {
    throw new HttpError(res.status, payloadRes.message || "请求失败");
  }
  return payloadRes.data;
}

export async function deactivateSku(sku_id: number): Promise<null> {
  if (useMock) {
    const res = await mockApi.deactivateSku(sku_id);
    return unwrapMockEnvelopeNullable(res);
  }
  const res = await fetch(`${DEFAULT_API_BASES.foundationData}/skus/${sku_id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(readAuthToken() ? { Authorization: `Bearer ${readAuthToken()}` } : {}),
    },
  });
  const payloadRes = (await res.json()) as ApiResponse<null>;
  if (!res.ok || payloadRes.code !== 0) {
    throw new HttpError(res.status, payloadRes.message || "请求失败");
  }
  return payloadRes.data;
}

export async function fetchSkuCategories(): Promise<SKUCategory[]> {
  if (useMock) {
    const res = await mockApi.getSkuCategories();
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getOne<SKUCategory[]>("foundationData", "/sku-categories");
}

export async function createUser(payload: UserCreateReq): Promise<User> {
  if (useMock) {
    const res = await mockApi.createUser(payload);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().postOne<UserCreateReq, User>("foundationData", "/users", payload);
}

export async function updateUser(user_id: number, payload: UserUpdateReq): Promise<User> {
  if (useMock) {
    const res = await mockApi.updateUser(user_id, payload);
    return unwrapMockEnvelope(res);
  }
  const res = await fetch(`${DEFAULT_API_BASES.foundationData}/users/${user_id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(readAuthToken() ? { Authorization: `Bearer ${readAuthToken()}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const payloadRes = (await res.json()) as ApiResponse<User | null>;
  if (!res.ok || payloadRes.code !== 0 || payloadRes.data === null) {
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

export async function fetchSalesDailyDetail(sales_id: number): Promise<SalesDailyDetail> {
  if (useMock) {
    const res = await mockApi.getSalesById(sales_id);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getOne<SalesDailyDetail>("storeOps", `/sales/daily/${sales_id}`);
}

export async function fetchInventory(query: InventoryQuery): Promise<PagedData<InventoryItem>> {
  if (useMock) {
    const res = await mockApi.getInventory(query);
    return unwrapMockEnvelope(res);
  }
  return authedHttp().getPaged<InventoryItem>("storeOps", "/inventory", query);
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
  action: "issue" | "confirm" | "cancel",
  body?: TReq,
  allowNullData = false
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
  if (!res.ok || payloadRes.code !== 0 || (!allowNullData && payloadRes.data === null)) {
    throw new HttpError(res.status, payloadRes.message || "请求失败");
  }
  return payloadRes.data as TRes;
}

export async function issueTransfer(order_id: number): Promise<TransferOrder> {
  if (useMock) {
    const res = await mockApi.issueTransfer(order_id);
    return unwrapMockEnvelope(res);
  }
  return patchTransfer<{}, TransferOrder>(order_id, "issue");
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
    return unwrapMockEnvelopeNullable(res);
  }
  return patchTransfer<{}, null>(order_id, "cancel", undefined, true);
}
