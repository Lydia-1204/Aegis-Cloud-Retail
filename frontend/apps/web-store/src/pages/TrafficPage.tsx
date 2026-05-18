import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { subscribeTrafficRealtime } from "../services/api";

type TrafficStatus = "connecting" | "connected" | "closed" | "error";

const STATUS_TEXT: Record<TrafficStatus, string> = {
  connecting: "连接中",
  connected: "已连接",
  closed: "已断开",
  error: "异常",
};

export function TrafficPage() {
  const { me } = useAuth();
  const [currentPeopleCount, setCurrentPeopleCount] = useState<number | null>(null);
  const [status, setStatus] = useState<TrafficStatus>("connecting");
  const [error, setError] = useState("");
  const [lastEvent, setLastEvent] = useState("-");
  const [history, setHistory] = useState<Array<{ time: string; value: number }>>([]);

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
        const nextCount = payload.data.current_people_count;
        const nextTime = new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        setCurrentPeopleCount(nextCount);
        setLastEvent(payload.event);
        setHistory((prev) => [...prev, { time: nextTime, value: nextCount }].slice(-24));
      },
      onNoData: (payload) => {
        setStatus("connected");
        setError("");
        setCurrentPeopleCount(null);
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

  const chartValues = history.map((item) => item.value);
  const minValue = chartValues.length > 0 ? Math.min(...chartValues) : 0;
  const maxValue = chartValues.length > 0 ? Math.max(...chartValues) : 0;
  const avgValue =
    chartValues.length > 0
      ? Math.round(chartValues.reduce((sum, value) => sum + value, 0) / chartValues.length)
      : 0;
  const range = Math.max(1, maxValue - minValue);

  const viewWidth = 680;
  const viewHeight = 220;
  const pad = 20;
  const count = Math.max(1, history.length - 1);
  const linePoints = history
    .map((item, index) => {
      const x = pad + ((viewWidth - pad * 2) * index) / count;
      const y = viewHeight - pad - ((item.value - minValue) / range) * (viewHeight - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const baselineY = viewHeight - pad;
  const areaPath =
    history.length > 1
      ? `M ${linePoints.split(" ")[0]} L ${linePoints} L ${viewWidth - pad},${baselineY} L ${pad},${baselineY} Z`
      : "";

  return (
    <section className="traffic-page">
      <header className="traffic-header">
        <div>
          <h2>实时客流感知</h2>
        </div>
        <div className={`traffic-status-badge status-${status}`}>
          <span className="status-dot" />
          {STATUS_TEXT[status]}
        </div>
      </header>
      {error ? <p className="error-text">{error}</p> : null}

      <div className="traffic-layout">
        <article className="traffic-panel traffic-main-panel">
          <div className="traffic-main-top">
            <div>
              <p className="traffic-label">当前客流人数</p>
              <p className="traffic-big-number">{currentPeopleCount ?? "无数据"}</p>
            </div>
            <div className="traffic-meta">
              <span>近 24 次采样</span>
              <strong>{history.length || "-"}</strong>
            </div>
          </div>

          <div className="traffic-chart-wrap">
            {history.length > 1 ? (
              <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="traffic-chart" role="img" aria-label="客流趋势图">
                <line x1={pad} y1={baselineY} x2={viewWidth - pad} y2={baselineY} className="traffic-axis" />
                <line x1={pad} y1={pad} x2={pad} y2={baselineY} className="traffic-axis" />
                <path d={areaPath} className="traffic-area" />
                <polyline points={linePoints} className="traffic-line" />
              </svg>
            ) : (
              <p className="empty">暂无足够数据绘制趋势图</p>
            )}
          </div>

          <div className="traffic-summary-row">
            <p>最小值：{minValue}</p>
            <p>最大值：{maxValue}</p>
            <p>均值：{avgValue}</p>
            <p>最新时间：{history.length > 0 ? history[history.length - 1].time : "-"}</p>
          </div>
        </article>

        <article className="traffic-panel traffic-side-panel">
          <div className="traffic-kpi-grid">
            <div className="traffic-kpi-card">
              <h3>门店编号</h3>
              <p>{me?.store_id ?? "-"}</p>
            </div>
            <div className="traffic-kpi-card">
              <h3>事件类型</h3>
              <p>{lastEvent}</p>
            </div>
            <div className="traffic-kpi-card">
              <h3>连接状态</h3>
              <p>{STATUS_TEXT[status]}</p>
            </div>
            <div className="traffic-kpi-card">
              <h3>采样窗口</h3>
              <p>24 点</p>
            </div>
          </div>
        </article>
      </div>

      <div className="cards-grid">
        <article className="card traffic-mini-card">
          <h3>状态说明</h3>
          <p>连接中: 等待握手</p>
          <p>已连接: 正常接收事件</p>
          <p>异常/断开: 请检查网络或 token</p>
        </article>
        <article className="card traffic-mini-card">
          <h3>展示口径</h3>
          <p>人数为服务端实时推送值</p>
          <p>趋势图只展示最近窗口内数据</p>
        </article>
      </div>
    </section>
  );
}
