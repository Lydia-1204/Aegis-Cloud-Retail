import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const navItems: Array<{ to: string; label: string }> = [
  { to: "/", label: "总部总览" },
  { to: "/stores", label: "门店管理" },
  { to: "/skus", label: "SKU目录" },
  { to: "/users", label: "用户管理" },
  { to: "/transfers", label: "调拨审核" },
  { to: "/ai", label: "AI 助手" },
  { to: "/realtime", label: "实时推送" },
];

export function AppShell() {
  const { me, signout } = useAuth();

  return (
    <div className="layout-root">
      <aside className="layout-sidebar">
        <h1 className="layout-title">Aegis HQ</h1>
        <p className="layout-subtitle">总部运营台</p>
        <p className="layout-user">{me?.user_name ?? "-"}</p>
        <nav className="layout-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "layout-link active" : "layout-link"
              }
              end={item.to === "/"}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="logout-btn" type="button" onClick={signout}>
          退出登录
        </button>
      </aside>
      <main className="layout-content">
        <Outlet />
      </main>
    </div>
  );
}
