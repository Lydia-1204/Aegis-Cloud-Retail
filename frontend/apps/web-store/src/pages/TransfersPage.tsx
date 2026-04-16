import { useEffect, useState } from "react";
import type { TransferOrder } from "@aegis/shared";
import { useAuth } from "../auth/AuthContext";
import { acknowledgeTransfer, feedbackTransfer, fetchTransfers } from "../services/api";
import {
  DateField,
  ModalShell,
  PaginationBar,
  TRANSFER_FIELD_LABELS,
  TRANSFER_STATUS_LABELS,
  parseError,
} from "./storeHelpers";

export function TransfersPage() {
  const { me } = useAuth();
  const [rows, setRows] = useState<TransferOrder[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"" | TransferOrder["status"]>("");
  const transferStatusOptions: TransferOrder["status"][] = [
    "ai_generated",
    "pending_approval",
    "issued_pending_confirmation",
    "in_negotiation",
    "confirmed_executed",
    "cancelled",
  ];
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [feedbackOrderId, setFeedbackOrderId] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadTransfers(targetPage = page) {
    const res = await fetchTransfers({
      page: targetPage,
      limit,
      store_id: me?.store_id ?? 1,
      status: status || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    });
    setRows(res.data);
    setTotal(res.total);
  }

  useEffect(() => {
    void loadTransfers();
  }, [page, limit, status, startDate, endDate, me]);

  async function onAcknowledge(order_id: number) {
    setMessage("");
    setError("");
    try {
      await acknowledgeTransfer(order_id, { details: undefined });
      setMessage("调拨单确认成功");
      await loadTransfers();
    } catch (err) {
      setError(parseError(err));
    }
  }

  async function onSubmitFeedback() {
    if (!feedbackOrderId) return;
    if (!feedbackText.trim()) {
      setError("请输入异议内容");
      return;
    }
    setMessage("");
    setError("");
    try {
      await feedbackTransfer(feedbackOrderId, { feedback: feedbackText.trim() });
      setMessage("异议提交成功");
      setFeedbackOrderId(null);
      setFeedbackText("");
      await loadTransfers();
    } catch (err) {
      setError(parseError(err));
    }
  }

  return (
    <section>
      <h2>调拨确认</h2>
      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div className="query-bar">
        <label className="date-field">
          <span>状态</span>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as "" | TransferOrder["status"]);
            }}
          >
            <option value="">全部状态</option>
            {transferStatusOptions.map((item) => (
              <option key={item} value={item}>
                {TRANSFER_STATUS_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <DateField
          label="开始日期"
          value={startDate}
          onChange={(value) => {
            setPage(1);
            setStartDate(value);
          }}
        />
        <DateField
          label="结束日期"
          value={endDate}
          onChange={(value) => {
            setPage(1);
            setEndDate(value);
          }}
        />
      </div>
      <div className="table-container transfers-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>{TRANSFER_FIELD_LABELS.order_id}</th>
              <th>{TRANSFER_FIELD_LABELS.status}</th>
              <th>{TRANSFER_FIELD_LABELS.feedback}</th>
              <th>{TRANSFER_FIELD_LABELS.detail_count}</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="inventory-empty-cell">
                  暂无数据
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.order_id}>
                  <td>{row.order_id}</td>
                  <td>{TRANSFER_STATUS_LABELS[row.status]}</td>
                  <td>{row.feedback ?? "-"}</td>
                  <td>{row.details.length}</td>
                  <td>
                    <button
                      type="button"
                      className="inventory-action-btn"
                      onClick={() => onAcknowledge(row.order_id)}
                    >
                      确认接单
                    </button>
                    <button
                      type="button"
                      className="inventory-action-btn"
                      onClick={() => {
                        setFeedbackOrderId(row.order_id);
                        setFeedbackText("");
                      }}
                    >
                      发起异议
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <PaginationBar
        page={page}
        total={total}
        limit={limit}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />
      {feedbackOrderId ? (
        <ModalShell title={`异议 - 调拨单号 ${feedbackOrderId}`} onClose={() => setFeedbackOrderId(null)}>
          <div className="form-grid">
            <textarea
              placeholder="请输入异议内容"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              style={{ gridColumn: "1 / -1", minHeight: "100px" }}
            />
          </div>
          <div className="sales-form-actions">
            <button type="button" onClick={onSubmitFeedback}>
              提交异议
            </button>
          </div>
        </ModalShell>
      ) : null}
    </section>
  );
}
