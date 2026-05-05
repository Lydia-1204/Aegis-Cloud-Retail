import { useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatSessionItem } from "@aegis/shared";
import { useAuth } from "../auth/AuthContext";
import { fetchChatHistory, fetchChatSessions, streamChatCompletions } from "../services/api";
import { parseError } from "./storeHelpers";

export function ChatPage() {
  const { me } = useAuth();
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const stopStreamRef = useRef<(() => void) | null>(null);

  async function loadSessions() {
    if (!me?.store_id) {
      return;
    }
    const res = await fetchChatSessions({ store_id: me.store_id, limit: 20 });
    setSessions(res.data);
    if (!activeSessionId && res.data.length > 0) {
      setActiveSessionId(res.data[0].session_id);
    }
  }

  async function loadHistory(session_id: string) {
    const res = await fetchChatHistory(session_id);
    setMessages(res.messages);
  }

  useEffect(() => {
    void loadSessions().catch((err) => setError(parseError(err)));
  }, [me?.store_id]);

  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    void loadHistory(activeSessionId).catch((err) => setError(parseError(err)));
  }, [activeSessionId]);

  useEffect(() => {
    return () => {
      stopStreamRef.current?.();
    };
  }, []);

  function onSend() {
    const text = query.trim();
    if (!text) {
      setError("请输入对话内容");
      return;
    }
    if (!me?.store_id) {
      setError("未获取到门店编号");
      return;
    }

    stopStreamRef.current?.();
    setError("");
    setSending(true);
    setStreamingContent("");
    setQuery("");
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: text,
        chat_time: new Date().toISOString(),
      },
    ]);

    stopStreamRef.current = streamChatCompletions(
      {
        store_id: me.store_id,
        session_id: activeSessionId,
        query: text,
      },
      {
        onChunk: (chunk) => {
          if (!chunk.is_finish) {
            setStreamingContent((prev) => prev + chunk.content);
            return;
          }

          setSending(false);
          setStreamingContent("");
          setActiveSessionId(chunk.session_id);
          void loadSessions().catch((err) => setError(parseError(err)));
          void loadHistory(chunk.session_id).catch((err) => setError(parseError(err)));
        },
        onError: (message) => {
          setSending(false);
          setError(message);
        },
      }
    );
  }

  function onStartNewConversation() {
    stopStreamRef.current?.();
    setStreamingContent("");
    setSending(false);
    setActiveSessionId(null);
    setMessages([]);
    setError("");
  }

  const activeSession = sessions.find((item) => item.session_id === activeSessionId) ?? null;

  return (
    <section className="chat-page">
      <h2>AI 助手对话</h2>
      {error ? <p className="error-text">{error}</p> : null}

      <div className="chat-main-panel">
        <div className="chat-main-header">
          <div className="chat-main-header-top">
            <h3>对话</h3>
            <button type="button" className="chat-new-btn" onClick={onStartNewConversation}>
              发起新对话
            </button>
          </div>
          <p className="hint">
            当前会话：
            {activeSession
              ? `${activeSession.title}（${activeSession.session_time}）`
              : "新会话（未选择历史会话）"}
          </p>
        </div>

        <div className="chat-messages">
          {messages.length === 0 && !streamingContent ? (
            <p className="chat-empty">有什么我能帮你的吗？</p>
          ) : null}
          {messages.map((msg, idx) => (
            <article
              key={`${msg.chat_time}_${idx}`}
              className={`chat-message ${msg.role === "user" ? "from-user" : "from-assistant"}`}
            >
              <header>
                <strong>{msg.role === "user" ? "你" : "助手"}</strong>
                <span>{msg.chat_time}</span>
              </header>
              <p>{msg.content}</p>
            </article>
          ))}
          {streamingContent ? (
            <article className="chat-message from-assistant">
              <header>
                <strong>助手</strong>
                <span>streaming</span>
              </header>
              <p>{streamingContent}</p>
            </article>
          ) : null}
        </div>

        <div className="chat-composer">
          <input
            placeholder="输入 query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !sending) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <button type="button" disabled={sending} onClick={onSend}>
            {sending ? "发送中..." : "发送"}
          </button>
        </div>
      </div>

      <div className="op-card chat-session-panel">
        <h3>会话列表</h3>
        <div className="chat-session-list">
          {sessions.length === 0 ? <p className="empty">暂无历史会话</p> : null}
          {sessions.map((item) => (
            <button
              key={item.session_id}
              type="button"
              className={`chat-session-item ${activeSessionId === item.session_id ? "active" : ""}`}
              onClick={() => setActiveSessionId(item.session_id)}
            >
              <strong>{item.title}</strong>
              <span>{item.session_time}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
