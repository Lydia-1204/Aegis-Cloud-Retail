import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { signin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [accountName, setAccountName] = useState("head001");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await signin({ account_name: accountName, password });
      const target = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(target, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>总部登录</h1>
        <p className="hint">演示账号：head001 / 123456</p>
        <label>
          账号
          <input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            required
          />
        </label>
        <label>
          密码
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button disabled={pending} type="submit">
          {pending ? "登录中..." : "登录"}
        </button>
      </form>
    </main>
  );
}
