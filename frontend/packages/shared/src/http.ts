import type { ApiResponse, ApiBases, PagedData } from "./types";

export class HttpError extends Error {
  public readonly status: number;

  public constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function withQuery(
  path: string,
  query?: object
): string {
  if (!query) {
    return path;
  }

  const url = new URL(path, "http://placeholder.local");
  for (const [key, value] of Object.entries(
    query as Record<string, string | number | boolean | undefined>
  )) {
    if (value === undefined) {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return `${url.pathname}${url.search}`;
}

async function parseResponse<T>(res: Response): Promise<ApiResponse<T>> {
  const raw = await res.text();
  let payload: ApiResponse<T>;
  try {
    payload = JSON.parse(raw) as ApiResponse<T>;
  } catch {
    const message = raw.trim() || `HTTP ${res.status}`;
    throw new HttpError(res.status, message);
  }
  if (!res.ok || payload.code !== 0) {
    throw new HttpError(res.status, payload.message || "请求失败");
  }
  return payload;
}

export class AegisHttpClient {
  private readonly token?: string;
  private readonly bases: ApiBases;

  public constructor(bases: ApiBases, token?: string) {
    this.bases = bases;
    this.token = token;
  }

  private headers(): HeadersInit {
    return {
      "Content-Type": "application/json",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }

  public async getPaged<T>(
    service: keyof ApiBases,
    path: string,
    query?: object
  ): Promise<PagedData<T>> {
    const res = await fetch(`${this.bases[service]}${withQuery(path, query)}`, {
      method: "GET",
      headers: this.headers(),
    });

    const payload = await parseResponse<PagedData<T>>(res);
    return payload.data;
  }

  public async getOne<T>(service: keyof ApiBases, path: string): Promise<T> {
    const res = await fetch(`${this.bases[service]}${path}`, {
      method: "GET",
      headers: this.headers(),
    });

    const payload = await parseResponse<T>(res);
    return payload.data;
  }

  public async postOne<TReq extends object, TRes>(
    service: keyof ApiBases,
    path: string,
    body: TReq
  ): Promise<TRes> {
    const res = await fetch(`${this.bases[service]}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    const payload = await parseResponse<TRes>(res);
    return payload.data;
  }
}
