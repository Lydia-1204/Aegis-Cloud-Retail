import {
  AegisHttpClient,
  AegisMockApi,
  DEFAULT_API_BASES,
  type LoginReq,
  type LoginRes,
  type PagedData,
  type SKU,
  type SkusQuery,
  type Store,
  type StoresQuery,
  type TransferOrder,
  type TransfersQuery,
  type User,
  type UserMe,
  type UsersQuery,
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

export async function fetchStores(query: StoresQuery): Promise<PagedData<Store>> {
  if (useMock) {
    return mockApi.getStores(query);
  }
  return anonHttp.getPaged<Store>("foundationData", "/stores", query);
}

export async function fetchSkus(query: SkusQuery): Promise<PagedData<SKU>> {
  if (useMock) {
    return mockApi.getSkus(query);
  }
  return anonHttp.getPaged<SKU>("foundationData", "/skus", query);
}

export async function fetchUsers(query: UsersQuery): Promise<PagedData<User>> {
  if (useMock) {
    return mockApi.getUsers(query);
  }
  return anonHttp.getPaged<User>("foundationData", "/users", query);
}

export async function fetchTransfers(query: TransfersQuery): Promise<PagedData<TransferOrder>> {
  if (useMock) {
    return mockApi.getTransfers(query);
  }
  return anonHttp.getPaged<TransferOrder>("storeOps", "/transfers", query);
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
