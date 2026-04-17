import { NavLink, Outlet } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const navItems: Array<{ to: string; label: string }> = [
  { to: "/store", label: "门店信息" },
  { to: "/", label: "销售流水" },
  { to: "/chat", label: "AI 对话" },
  { to: "/traffic", label: "客流感知" },
  { to: "/inventory", label: "库存盘点" },
  { to: "/transfers", label: "调拨确认" },
];

export function AppShell() {
  const { me, signout } = useAuth();
  const navigate = useNavigate();

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
        <button
          className="change-password-btn"
          type="button"
          onClick={() => navigate("/account/password")}
        >
          修改密码
        </button>
      </aside>
      <main className="layout-content">
        <Outlet />
      </main>
    </div>
  );
}
