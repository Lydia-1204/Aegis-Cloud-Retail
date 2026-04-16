import { useEffect, useState } from "react";
import type { TransferOrder } from "@aegis/shared";
import { useAuth } from "../auth/AuthContext";
import { acknowledgeTransfer, feedbackTransfer, fetchTransfers } from "../services/api";
import {
  DateField,
  PaginationBar,
  TRANSFER_FIELD_LABELS,
  TRANSFER_STATUS_LABELS,
  parseError,
  renderTable,
  toNumberOrUndefined,
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
  const [ackForm, setAckForm] = useState({ order_id: "", detail_id: "", actual_qty: "" });
  const [feedbackForm, setFeedbackForm] = useState({ order_id: "", feedback: "" });
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

  async function onAcknowledge() {
    const order_id = Number(ackForm.order_id);
    if (!order_id) {
      setError("请输入 order_id");
      return;
    }
    setMessage("");
    setError("");
    try {
      await acknowledgeTransfer(order_id, {
        details:
          toNumberOrUndefined(ackForm.detail_id) !== undefined &&
          toNumberOrUndefined(ackForm.actual_qty) !== undefined
            ? [
                {
                  detail_id: Number(ackForm.detail_id),
                  actual_qty: Number(ackForm.actual_qty),
                },
              ]
            : undefined,
      });
      setMessage("调拨单确认成功");
      await loadTransfers();
    } catch (err) {
      setError(parseError(err));
    }
  }

  async function onFeedback() {
    const order_id = Number(feedbackForm.order_id);
    if (!order_id) {
      setError("请输入 order_id");
      return;
    }
    setMessage("");
    setError("");
    try {
      await feedbackTransfer(order_id, { feedback: feedbackForm.feedback.trim() });
      setMessage("异议提交成功");
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
      <div className="ops-grid">
        <div className="op-card">
          <h3>门店确认（PATCH /transfers/:order_id/acknowledge）</h3>
          <div className="form-grid">
            <input
              placeholder="调拨单号"
              value={ackForm.order_id}
              onChange={(e) => setAckForm((s) => ({ ...s, order_id: e.target.value }))}
            />
            <input
              placeholder="明细单号（可选）"
              value={ackForm.detail_id}
              onChange={(e) => setAckForm((s) => ({ ...s, detail_id: e.target.value }))}
            />
            <input
              placeholder="实际数量（可选）"
              value={ackForm.actual_qty}
              onChange={(e) => setAckForm((s) => ({ ...s, actual_qty: e.target.value }))}
            />
            <button type="button" onClick={onAcknowledge}>
              确认接单
            </button>
          </div>
        </div>
        <div className="op-card">
          <h3>门店异议（PATCH /transfers/:order_id/feedback）</h3>
          <div className="form-grid">
            <input
              placeholder="调拨单号"
              value={feedbackForm.order_id}
              onChange={(e) => setFeedbackForm((s) => ({ ...s, order_id: e.target.value }))}
            />
            <input
              placeholder="异议内容"
              value={feedbackForm.feedback}
              onChange={(e) => setFeedbackForm((s) => ({ ...s, feedback: e.target.value }))}
            />
            <button type="button" onClick={onFeedback}>
              提交异议
            </button>
          </div>
        </div>
      </div>
      {renderTable(
        rows.map((x) => ({
          [TRANSFER_FIELD_LABELS.order_id]: x.order_id,
          [TRANSFER_FIELD_LABELS.status]: TRANSFER_STATUS_LABELS[x.status],
          [TRANSFER_FIELD_LABELS.feedback]: x.feedback ?? "-",
          [TRANSFER_FIELD_LABELS.detail_count]: x.details.length,
        }))
      )}
      <PaginationBar
        page={page}
        total={total}
        limit={limit}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />
    </section>
  );
}
