import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

const wsUrl = import.meta.env.VITE_WS_URL ?? "ws://localhost:8080/ws/dashboard";

export function RealtimePage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);

  function connect() {
    if (!token) {
      return;
    }

    const ws = new WebSocket(`${wsUrl}?token=${token}`);
    ws.onopen = () => {
      setConnected(true);
      setLogs((prev) => ["[open] websocket connected", ...prev]);
    };
    ws.onmessage = (event) => {
      setLogs((prev) => [event.data, ...prev].slice(0, 30));
    };
    ws.onerror = () => {
      setLogs((prev) => ["[error] websocket error", ...prev]);
    };
    ws.onclose = () => {
      setConnected(false);
      setLogs((prev) => ["[close] websocket closed", ...prev]);
    };
  }

  return (
    <section>
      <h2>实时推送（WebSocket）</h2>
      <div className="query-bar">
        <button type="button" onClick={connect} disabled={connected}>
          {connected ? "已连接" : "连接 WebSocket"}
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>最近消息</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((x, idx) => (
              <tr key={`${idx}-${x}`}>
                <td>{x}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
