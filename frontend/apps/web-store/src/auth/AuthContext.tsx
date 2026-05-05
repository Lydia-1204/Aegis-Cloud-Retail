import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { LoginReq, UserMe } from "@aegis/shared";
import { login, me } from "../services/api";

interface AuthState {
  token: string | null;
  me: UserMe | null;
  loading: boolean;
  signin: (payload: LoginReq) => Promise<void>;
  signout: () => void;
}

const AUTH_KEY = "aegis_store_auth";
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) {
      setLoading(false);
      return;
    }

    const parsed = JSON.parse(raw) as { token: string };
    setToken(parsed.token);
    void me(parsed.token)
      .then((res) => setProfile(res))
      .catch(() => {
        localStorage.removeItem(AUTH_KEY);
        setToken(null);
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function signin(payload: LoginReq) {
    const data = await login(payload);
    setToken(data.token);
    localStorage.setItem(AUTH_KEY, JSON.stringify({ token: data.token }));
    const profileRes = await me(data.token);
    setProfile(profileRes);
  }

  function signout() {
    localStorage.removeItem(AUTH_KEY);
    setToken(null);
    setProfile(null);
  }

  const value = useMemo<AuthState>(
    () => ({
      token,
      me: profile,
      loading,
      signin,
      signout,
    }),
    [token, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth 必须在 AuthProvider 内使用");
  }
  return ctx;
}
