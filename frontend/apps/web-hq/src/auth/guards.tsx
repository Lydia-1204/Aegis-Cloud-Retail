import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { RoleName } from "@aegis/shared";
import { useAuth } from "./AuthContext";

export function RequireAuth() {
  const { token, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="empty">认证加载中...</p>;
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function RequireRole({ role }: { role: RoleName }) {
  const { me } = useAuth();
  if (!me || me.role_name !== role) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
