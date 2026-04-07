import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const navItems: Array<{ to: string; label: string }> = [
  { to: "/", label: "门店看板" },
  { to: "/sales", label: "销售流水" },
  { to: "/inventory", label: "库存盘点" },
  { to: "/transfers", label: "调拨确认" },
  { to: "/traffic", label: "客流日志" },
  { to: "/ai", label: "AI 助手" },
  { to: "/realtime", label: "实时推送" },
];

export function AppShell() {
  const { me, signout } = useAuth();

  return (
    <div className="layout-root">
      <aside className="layout-sidebar">
        <h1 className="layout-title">Aegis Store</h1>
        <p className="layout-subtitle">门店经营台</p>
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
