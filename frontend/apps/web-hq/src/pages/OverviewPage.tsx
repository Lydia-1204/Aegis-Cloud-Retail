import { useEffect, useMemo, useState } from "react";
import type { Store } from "@aegis/shared";
import { fetchStores, subscribeTrafficRealtime } from "../services/api";

type TrafficStatus = "connecting" | "connected" | "closed" | "error";

type StoreTrafficCard = {
  store: Store;
  currentPeopleCount: number | null;
  status: TrafficStatus;
  error: string;
  lastUpdate: string;
  history: Array<{ time: string; value: number }>;
};

const STATUS_TEXT: Record<TrafficStatus, string> = {
  connecting: "连接中",
  connected: "已连接",
  closed: "已断开",
  error: "异常",
};

function createInitialCard(store: Store): StoreTrafficCard {
  return {
    store,
    currentPeopleCount: null,
    status: "connecting",
    error: "",
    lastUpdate: "-",
    history: [],
  };
}

function isActiveBusinessStore(store: Store): boolean {
  const code = store.store_code.trim().toUpperCase();
  return store.store_status === "active" && store.store_id !== 0 && code !== "HQ" && !store.store_name.includes("总部");
}

export function OverviewPage() {
  const [cards, setCards] = useState<StoreTrafficCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    let active = true;
    let cleanups: Array<() => void> = [];

    void (async () => {
      setLoading(true);
      setPageError("");
      try {
        const res = await fetchStores({ page: 1, limit: 100 });
        if (!active) {
          return;
        }

        const businessStores = res.data.filter(isActiveBusinessStore);
        const nextCards = businessStores.map((store) => createInitialCard(store));
        setCards(nextCards);

        cleanups = businessStores.map((store) =>
          subscribeTrafficRealtime(store.store_id, {
            onOpen: () => {
              if (!active) {
                return;
              }
              setCards((prev) =>
                prev.map((item) =>
                  item.store.store_id === store.store_id
                    ? { ...item, status: "connected", error: "" }
                    : item
                )
              );
            },
            onTick: (payload) => {
              if (!active) {
                return;
              }
              const nextCount = payload.data.current_people_count;
              const nextTime = new Date().toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              });
              setCards((prev) =>
                prev.map((item) =>
                  item.store.store_id === store.store_id
                    ? {
                        ...item,
                        currentPeopleCount: nextCount,
                        lastUpdate: nextTime,
                        status: "connected",
                        history: [...item.history, { time: nextTime, value: nextCount }].slice(-24),
                      }
                    : item
                )
              );
            },
            onNoData: () => {
              if (!active) {
                return;
              }
              setCards((prev) =>
                prev.map((item) =>
                  item.store.store_id === store.store_id
                    ? {
                        ...item,
                        currentPeopleCount: null,
                        lastUpdate: "无数据",
                        status: "connected",
                        error: "",
                      }
                    : item
                )
              );
            },
            onError: (message) => {
              if (!active) {
                return;
              }
              setCards((prev) =>
                prev.map((item) =>
                  item.store.store_id === store.store_id
                    ? { ...item, status: "error", error: message }
                    : item
                )
              );
            },
            onClose: () => {
              if (!active) {
                return;
              }
              setCards((prev) =>
                prev.map((item) =>
                  item.store.store_id === store.store_id
                    ? { ...item, status: "closed" }
                    : item
                )
              );
            },
          })
        );
      } catch (err) {
        if (active) {
          setPageError(err instanceof Error ? err.message : "总部总览加载失败");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  const summary = useMemo(() => {
    const totalStores = cards.length;
    const onlineStores = cards.filter((card) => card.status === "connected").length;
    const cardsWithData = cards.filter((card) => card.currentPeopleCount !== null);
    const totalPeople = cardsWithData.reduce(
      (sum, card) => sum + (card.currentPeopleCount ?? 0),
      0
    );
    const avgPeople =
      cardsWithData.length > 0 ? Math.round(totalPeople / cardsWithData.length) : 0;
    const maxCard = cardsWithData.reduce<StoreTrafficCard | null>((best, card) => {
      if (!best || (card.currentPeopleCount ?? 0) > (best.currentPeopleCount ?? 0)) {
        return card;
      }
      return best;
    }, null);

    return {
      totalStores,
      onlineStores,
      totalPeople,
      avgPeople,
      topStoreName: maxCard?.store.store_name ?? "-",
      topStorePeople: maxCard?.currentPeopleCount ?? null,
    };
  }, [cards]);

  return (
    <section className="hq-overview-page">
      <header className="hq-overview-header">
        <div>
          <h2>全域实时客流监控</h2>
        </div>
        <div className="hq-overview-summary-pill">
          <span>门店 {summary.onlineStores}/{summary.totalStores}</span>
          <strong>在线</strong>
        </div>
      </header>

      <article className="hq-overview-featured-card">
        <div>
          <p className="hq-featured-label">当前最大客流门店</p>
          <h3>{summary.topStoreName}</h3>
          <p className="hq-featured-meta">
            当前客流 {summary.topStorePeople ?? "无数据"}
            {summary.topStorePeople === null ? "" : " 人"}
          </p>
        </div>
        <div className="hq-featured-value">
          <span>峰值焦点</span>
          <strong>{summary.topStorePeople ?? "-"}</strong>
        </div>
      </article>

      {pageError ? <p className="error-text">{pageError}</p> : null}
      {loading ? <p className="hint">正在拉取门店并建立实时订阅...</p> : null}

      <div className="hq-overview-stats">
        <article className="hq-stat-card">
          <span>总门店数</span>
          <strong>{summary.totalStores}</strong>
        </article>
        <article className="hq-stat-card">
          <span>在线门店数</span>
          <strong>{summary.onlineStores}</strong>
        </article>
        <article className="hq-stat-card">
          <span>实时总客流</span>
          <strong>{summary.totalPeople}</strong>
        </article>
        <article className="hq-stat-card">
          <span>平均客流</span>
          <strong>{summary.avgPeople}</strong>
        </article>
      </div>

      <div className="hq-overview-grid">
        {cards.map((card) => (
          <article key={card.store.store_id} className="hq-store-traffic-card">
            <div className="hq-store-traffic-top">
              <div>
                <p className="hq-store-name">{card.store.store_name}</p>
                <p className="hq-store-meta">
                  {card.store.store_code} · {card.store.store_location}
                </p>
              </div>
              <div className={`traffic-status-badge status-${card.status}`}>
                <span className="status-dot" />
                {STATUS_TEXT[card.status]}
              </div>
            </div>

            <div className="hq-store-traffic-number">
              <span>当前客流</span>
              <strong>{card.currentPeopleCount ?? "无数据"}</strong>
            </div>

            <div className="hq-store-traffic-mini">
              <span>最新更新时间</span>
              <strong>{card.lastUpdate}</strong>
            </div>

            <div className="hq-store-traffic-mini">
              <span>门店面积</span>
              <strong>{card.store.store_area} ㎡</strong>
            </div>

            <div className="hq-store-traffic-mini">
              <span>趋势窗口</span>
              <strong>{card.history.length}/24</strong>
            </div>

            {card.error ? <p className="error-text">{card.error}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
