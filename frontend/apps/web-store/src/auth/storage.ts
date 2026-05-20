const AUTH_SESSION_TTL_MS = 30 * 60 * 1000;

export const AUTH_KEY = "aegis_store_auth";

interface StoredAuth {
  token?: string;
  expiresAt?: number;
}

export function readStoredAuthToken(): string | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed.token || !parsed.expiresAt || parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
    return parsed.token;
  } catch {
    localStorage.removeItem(AUTH_KEY);
    return null;
  }
}

export function writeStoredAuthToken(token: string) {
  localStorage.setItem(
    AUTH_KEY,
    JSON.stringify({
      token,
      expiresAt: Date.now() + AUTH_SESSION_TTL_MS,
    })
  );
}

export function clearStoredAuthToken() {
  localStorage.removeItem(AUTH_KEY);
}
