import {
  AegisHttpClient,
  HttpError,
  AegisMockApi,
  DEFAULT_API_BASES,
  type ApiResponse,
  type LoginReq,
  type LoginRes,
  type PagedData,
  type SKUCategory,
  type SKUCreateReq,
  type SKUUpdateReq,
  type SKU,
  type SkusQuery,
  type StoreCreateReq,
  type StoreUpdateReq,
  type Store,
  type StoresQuery,
  type TransferOrder,
  type TransfersQuery,
  type UserCreateReq,
  type UserUpdateReq,
  type User,
  type TransferCreateReq,
  type ConfirmReq,
  type UserMe,
  type UsersQuery,
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
    return unwrapMockEnvelope(res);
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
    return unwrapMockEnvelope(res);
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
