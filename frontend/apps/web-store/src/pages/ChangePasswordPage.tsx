import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { changePassword } from "../services/api";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { signout } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(evt: FormEvent<HTMLFormElement>) {
    evt.preventDefault();
    setError("");
    setMessage("");

    if (!oldPassword.trim() || !newPassword.trim()) {
      setError("请填写旧密码和新密码");
      return;
    }
    if (newPassword.length < 6) {
      setError("新密码长度至少 6 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }
    if (oldPassword === newPassword) {
      setError("新密码不能与旧密码相同");
      return;
    }

    setLoading(true);
    try {
      await changePassword({ old_password: oldPassword, new_password: newPassword });
      setMessage("密码修改成功，请重新登录");
      signout();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "密码修改失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page password-page">
      <form className="auth-card password-card" onSubmit={onSubmit}>
        <h2>修改密码</h2>
        <p className="hint">仅修改当前登录账户的密码，成功后会自动退出。</p>

        <label>
          旧密码
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        <label>
          新密码
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>

        <label>
          确认新密码
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>

        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="success-text">{message}</p> : null}

        <button type="submit" disabled={loading}>
          {loading ? "提交中..." : "确认修改"}
        </button>
      </form>
    </div>
  );
}