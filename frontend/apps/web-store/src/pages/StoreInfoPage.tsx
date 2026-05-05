import { useEffect, useState } from "react";
import type { Store } from "@aegis/shared";
import { useAuth } from "../auth/AuthContext";
import { fetchStoreById } from "../services/api";
import { parseError } from "./storeHelpers";

export function StoreInfoPage() {
  const { me } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!me?.store_id) {
      setError("未获取到门店编号");
      setStore(null);
      return;
    }

    setLoading(true);
    setError("");
    fetchStoreById(me.store_id)
      .then((res) => setStore(res))
      .catch((err) => setError(parseError(err)))
      .finally(() => setLoading(false));
  }, [me?.store_id]);

  const statusText = store?.store_status === "active" ? "营业中" : "已停用";

  return (
    <section>
      <h2>当前门店信息</h2>
      {loading ? <p className="hint">正在加载门店信息...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <div className="cards-grid">
        <article className="card">
          <h3>门店编号</h3>
          <p>{store?.store_id ?? "-"}</p>
        </article>
        <article className="card">
          <h3>门店编码</h3>
          <p>{store?.store_code ?? "-"}</p>
        </article>
        <article className="card">
          <h3>门店名称</h3>
          <p>{store?.store_name ?? "-"}</p>
        </article>
      </div>

      <div className="cards-grid">
        <article className="card">
          <h3>门店地址</h3>
          <p>{store?.store_location ?? "-"}</p>
        </article>
        <article className="card">
          <h3>门店面积</h3>
          <p>{store ? `${store.store_area} m²` : "-"}</p>
        </article>
        <article className="card">
          <h3>门店状态</h3>
          <p>{store ? statusText : "-"}</p>
        </article>
      </div>
    </section>
  );
}
