import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { subscribeTrafficRealtime } from "../services/api";

export function TrafficPage() {
  const { me } = useAuth();
  const [currentPeopleCount, setCurrentPeopleCount] = useState<number>(0);
  const [status, setStatus] = useState<"connecting" | "connected" | "closed" | "error">(
    "connecting"
  );
  const [error, setError] = useState("");
  const [lastEvent, setLastEvent] = useState("-");

  useEffect(() => {
    if (!me?.store_id) {
      setStatus("error");
      setError("未获取到 store_id，无法订阅实时客流");
      return;
    }

    setStatus("connecting");
    setError("");
    const cleanup = subscribeTrafficRealtime(me.store_id, {
      onOpen: () => {
        setStatus("connected");
      },
      onTick: (payload) => {
        setCurrentPeopleCount(payload.data.current_people_count);
        setLastEvent(payload.event);
      },
      onError: (message) => {
        setStatus("error");
        setError(message);
      },
      onClose: () => {
        setStatus("closed");
      },
    });

    return () => {
      cleanup();
    };
  }, [me?.store_id]);

  return (
    <section>
      <h2>实时客流感知</h2>
      <p>
        订阅接口：<strong>WS /api/ai/traffic/realtime/:store_id?token=&lt;JWT&gt;</strong>
      </p>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="cards-grid">
        <article className="card">
          <h3>门店编号</h3>
          <p>{me?.store_id ?? "-"}</p>
        </article>
        <article className="card">
          <h3>事件类型</h3>
          <p>{lastEvent}</p>
        </article>
        <article className="card">
          <h3>当前客流人数</h3>
          <p>{currentPeopleCount}</p>
        </article>
        <article className="card">
          <h3>连接状态</h3>
          <p>{status}</p>
        </article>
      </div>
    </section>
  );
}
