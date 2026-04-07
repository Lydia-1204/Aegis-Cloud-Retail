import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { queryAI } from "../services/api";

interface SourceItem {
  table: string;
  detail: string;
}

interface ActionItem {
  label: string;
  route: string;
}

export function AIPage() {
  const { token, me } = useAuth();
  const [query, setQuery] = useState("昨天葵涌店转化率多少？");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const defaultStoreId = useMemo(() => (me?.role_name === "Store" ? me.store_id : 1), [me]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) {
      return;
    }

    setPending(true);
    setError("");
    setAnswer("");
    setSources([]);
    setActions([]);

    try {
      const res = await queryAI(token, {
        query,
        context_store_id: defaultStoreId,
      });

      if (!res.body) {
        throw new Error("SSE 连接失败");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        const text = decoder.decode(chunk.value ?? new Uint8Array(), { stream: true });
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) {
            continue;
          }
          const evt = JSON.parse(line.slice(6)) as {
            type: string;
            content?: string;
            sources?: SourceItem[];
            actions?: ActionItem[];
            message?: string;
          };
          if (evt.type === "delta") {
            setAnswer((prev) => prev + (evt.content ?? ""));
          }
          if (evt.type === "source") {
            setSources(evt.sources ?? []);
          }
          if (evt.type === "action") {
            setActions(evt.actions ?? []);
          }
          if (evt.type === "error") {
            setError(evt.message ?? "AI 查询失败");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 查询失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h2>AI 督导对话（SSE）</h2>
      <form className="query-bar" onSubmit={onSubmit}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} required />
        <button type="submit" disabled={pending}>
          {pending ? "分析中..." : "发起分析"}
        </button>
      </form>
      {error ? <p className="error-text">{error}</p> : null}
      <article className="card">
        <h3>回答</h3>
        <p>{answer || "等待回答..."}</p>
      </article>
      <article className="card">
        <h3>数据来源</h3>
        <ul>
          {sources.map((x) => (
            <li key={`${x.table}-${x.detail}`}>{x.table}: {x.detail}</li>
          ))}
        </ul>
      </article>
      <article className="card">
        <h3>快捷动作</h3>
        <ul>
          {actions.map((x) => (
            <li key={`${x.label}-${x.route}`}>{x.label} ({x.route})</li>
          ))}
        </ul>
      </article>
    </section>
  );
}
