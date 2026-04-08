import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type {
  InventoryAdjustReq,
  InventoryItem,
  SalesDaily,
  SalesDailyDetail,
  TransferOrder,
} from "@aegis/shared";
import {
  acknowledgeTransfer,
  adjustInventory,
  createSalesDaily,
  feedbackTransfer,
  fetchInventory,
  fetchSalesDailyDetail,
  fetchSalesDaily,
  fetchTransfers,
  updateSalesDaily,
} from "../services/api";

type Row = Record<string, string | number | null>;

function renderTable(rows: Row[]) {
  if (rows.length === 0) {
    return <p className="empty">暂无数据</p>;
  }

  const headers = Object.keys(rows[0]);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              {headers.map((header) => (
                <td key={header}>{String(row[header])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaginationBar({
  page,
  total,
  limit,
  onPrev,
  onNext,
}: {
  page: number;
  total: number;
  limit: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const maxPage = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="pager">
      <button type="button" disabled={page <= 1} onClick={onPrev}>
        上一页
      </button>
      <span>
        第 {page} / {maxPage} 页（共 {total} 条）
      </span>
      <button type="button" disabled={page >= maxPage} onClick={onNext}>
        下一页
      </button>
    </div>
  );
}

function parseError(err: unknown): string {
  return err instanceof Error ? err.message : "请求失败";
}

function toNumberOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

export function SalesPage() {
  const { me } = useAuth();
  const [rows, setRows] = useState<SalesDaily[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [salesDate, setSalesDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [detail, setDetail] = useState<SalesDailyDetail | null>(null);
  const [detailId, setDetailId] = useState("");
  const [createForm, setCreateForm] = useState({
    sales_date: "",
    total_orders: "",
    total_income: "",
    total_profit: "",
    force_overwrite: false,
    sku_id: "",
    sku_amount: "",
    sku_income: "",
    sku_profit: "",
  });
  const [updateForm, setUpdateForm] = useState({
    sales_id: "",
    sales_date: "",
    total_orders: "",
    total_income: "",
    total_profit: "",
    force_overwrite: true,
    sku_id: "",
    sku_amount: "",
    sku_income: "",
    sku_profit: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSales(targetPage = page) {
    const res = await fetchSalesDaily({
      page: targetPage,
      limit,
      store_id: me?.store_id ?? 1,
      sales_date: salesDate || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    });
    setRows(res.data);
    setTotal(res.total);
  }

  useEffect(() => {
    void loadSales();
  }, [page, limit, salesDate, startDate, endDate, me]);

  async function onFetchDetail() {
    const sales_id = Number(detailId);
    if (!sales_id) {
      setError("请输入 sales_id");
      return;
    }
    setMessage("");
    setError("");
    try {
      const res = await fetchSalesDailyDetail(sales_id);
      setDetail(res);
      setMessage("销售详情加载成功");
    } catch (err) {
      setError(parseError(err));
    }
  }

  async function onCreateSales() {
    setMessage("");
    setError("");
    try {
      const res = await createSalesDaily({
        store_id: me?.store_id ?? 1,
        sales_date: createForm.sales_date,
        total_orders: Number(createForm.total_orders),
        total_income: Number(createForm.total_income),
        total_profit: Number(createForm.total_profit),
        force_overwrite: createForm.force_overwrite,
        details: [
          {
            sku_id: Number(createForm.sku_id),
            sku_amount: Number(createForm.sku_amount),
            sku_income: Number(createForm.sku_income),
            sku_profit: Number(createForm.sku_profit),
          },
        ],
      });
      setDetail(res);
      setMessage("销售流水提交成功");
      await loadSales(1);
      setPage(1);
    } catch (err) {
      setError(parseError(err));
    }
  }

  async function onUpdateSales() {
    const sales_id = Number(updateForm.sales_id);
    if (!sales_id) {
      setError("请输入 sales_id");
      return;
    }
    setMessage("");
    setError("");
    try {
      const res = await updateSalesDaily(sales_id, {
        store_id: me?.store_id ?? 1,
        sales_date: updateForm.sales_date,
        total_orders: Number(updateForm.total_orders),
        total_income: Number(updateForm.total_income),
        total_profit: Number(updateForm.total_profit),
        force_overwrite: updateForm.force_overwrite,
        details: [
          {
            sku_id: Number(updateForm.sku_id),
            sku_amount: Number(updateForm.sku_amount),
            sku_income: Number(updateForm.sku_income),
            sku_profit: Number(updateForm.sku_profit),
          },
        ],
      });
      setDetail(res);
      setMessage("销售流水更新成功");
      await loadSales();
    } catch (err) {
      setError(parseError(err));
    }
  }

  return (
    <section>
      <h2>销售流水</h2>
      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div className="query-bar">
        <input
          placeholder="sales_date: YYYY-MM-DD"
          value={salesDate}
          onChange={(e) => {
            setPage(1);
            setSalesDate(e.target.value);
          }}
        />
        <input
          placeholder="start_date"
          value={startDate}
          onChange={(e) => {
            setPage(1);
            setStartDate(e.target.value);
          }}
        />
        <input
          placeholder="end_date"
          value={endDate}
          onChange={(e) => {
            setPage(1);
            setEndDate(e.target.value);
          }}
        />
      </div>
      <div className="ops-grid">
        <div className="op-card">
          <h3>销售详情（GET /sales/daily/:sales_id）</h3>
          <div className="form-grid">
            <input
              placeholder="sales_id"
              value={detailId}
              onChange={(e) => setDetailId(e.target.value)}
            />
            <button type="button" onClick={onFetchDetail}>
              查询详情
            </button>
          </div>
        </div>
        <div className="op-card">
          <h3>提交流水（POST /sales/daily）</h3>
          <div className="form-grid">
            <input
              placeholder="sales_date"
              value={createForm.sales_date}
              onChange={(e) => setCreateForm((s) => ({ ...s, sales_date: e.target.value }))}
            />
            <input
              placeholder="total_orders"
              value={createForm.total_orders}
              onChange={(e) => setCreateForm((s) => ({ ...s, total_orders: e.target.value }))}
            />
            <input
              placeholder="total_income"
              value={createForm.total_income}
              onChange={(e) => setCreateForm((s) => ({ ...s, total_income: e.target.value }))}
            />
            <input
              placeholder="total_profit"
              value={createForm.total_profit}
              onChange={(e) => setCreateForm((s) => ({ ...s, total_profit: e.target.value }))}
            />
            <input
              placeholder="detail.sku_id"
              value={createForm.sku_id}
              onChange={(e) => setCreateForm((s) => ({ ...s, sku_id: e.target.value }))}
            />
            <input
              placeholder="detail.sku_amount"
              value={createForm.sku_amount}
              onChange={(e) => setCreateForm((s) => ({ ...s, sku_amount: e.target.value }))}
            />
            <input
              placeholder="detail.sku_income"
              value={createForm.sku_income}
              onChange={(e) => setCreateForm((s) => ({ ...s, sku_income: e.target.value }))}
            />
            <input
              placeholder="detail.sku_profit"
              value={createForm.sku_profit}
              onChange={(e) => setCreateForm((s) => ({ ...s, sku_profit: e.target.value }))}
            />
            <label className="check-line">
              <input
                type="checkbox"
                checked={createForm.force_overwrite}
                onChange={(e) =>
                  setCreateForm((s) => ({ ...s, force_overwrite: e.target.checked }))
                }
              />
              force_overwrite
            </label>
            <button type="button" onClick={onCreateSales}>
              提交
            </button>
          </div>
        </div>
        <div className="op-card">
          <h3>修改流水（PUT /sales/daily/:sales_id）</h3>
          <div className="form-grid">
            <input
              placeholder="sales_id"
              value={updateForm.sales_id}
              onChange={(e) => setUpdateForm((s) => ({ ...s, sales_id: e.target.value }))}
            />
            <input
              placeholder="sales_date"
              value={updateForm.sales_date}
              onChange={(e) => setUpdateForm((s) => ({ ...s, sales_date: e.target.value }))}
            />
            <input
              placeholder="total_orders"
              value={updateForm.total_orders}
              onChange={(e) => setUpdateForm((s) => ({ ...s, total_orders: e.target.value }))}
            />
            <input
              placeholder="total_income"
              value={updateForm.total_income}
              onChange={(e) => setUpdateForm((s) => ({ ...s, total_income: e.target.value }))}
            />
            <input
              placeholder="total_profit"
              value={updateForm.total_profit}
              onChange={(e) => setUpdateForm((s) => ({ ...s, total_profit: e.target.value }))}
            />
            <input
              placeholder="detail.sku_id"
              value={updateForm.sku_id}
              onChange={(e) => setUpdateForm((s) => ({ ...s, sku_id: e.target.value }))}
            />
            <input
              placeholder="detail.sku_amount"
              value={updateForm.sku_amount}
              onChange={(e) => setUpdateForm((s) => ({ ...s, sku_amount: e.target.value }))}
            />
            <input
              placeholder="detail.sku_income"
              value={updateForm.sku_income}
              onChange={(e) => setUpdateForm((s) => ({ ...s, sku_income: e.target.value }))}
            />
            <input
              placeholder="detail.sku_profit"
              value={updateForm.sku_profit}
              onChange={(e) => setUpdateForm((s) => ({ ...s, sku_profit: e.target.value }))}
            />
            <button type="button" onClick={onUpdateSales}>
              更新
            </button>
          </div>
        </div>
      </div>
      {detail ? (
        <div className="detail-box">
          <strong>当前销售详情</strong>
          <pre>{JSON.stringify(detail, null, 2)}</pre>
        </div>
      ) : null}
      {renderTable(
        rows.map((x) => ({
          sales_id: x.sales_id,
          sales_date: x.sales_date,
          total_orders: x.total_orders,
          total_income: x.total_income,
          total_profit: x.total_profit,
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

export function InventoryPage() {
  const { me } = useAuth();
  const [rows, setRows] = useState<InventoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    sku_id: "",
    actual_quantity: "",
    inventory_diagonsis_result_type: "Normal" as InventoryAdjustReq["inventory_diagonsis_result_type"],
    inventory_root_cause: '{"reason":""}',
    remark: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadInventory(targetPage = page) {
    const res = await fetchInventory({
      page: targetPage,
      limit,
      store_id: me?.store_id ?? 1,
      keyword: keyword || undefined,
      category_id: categoryId ? Number(categoryId) : undefined,
      low_stock: lowStock,
    });
    setRows(res.data);
    setTotal(res.total);
  }

  useEffect(() => {
    void loadInventory();
  }, [page, limit, keyword, categoryId, lowStock, me]);

  async function onAdjustInventory() {
    setMessage("");
    setError("");
    try {
      const rootCause = JSON.parse(adjustForm.inventory_root_cause) as object;
      await adjustInventory({
        store_id: me?.store_id ?? 1,
        sku_id: Number(adjustForm.sku_id),
        actual_quantity: Number(adjustForm.actual_quantity),
        inventory_diagonsis_result_type: adjustForm.inventory_diagonsis_result_type,
        inventory_root_cause: rootCause,
        remark: adjustForm.remark || undefined,
      });
      setMessage("库存修正成功");
      await loadInventory();
    } catch (err) {
      setError(parseError(err));
    }
  }

  return (
    <section>
      <h2>库存盘点</h2>
      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div className="query-bar">
        <input
          placeholder="搜索 SKU 名/编码"
          value={keyword}
          onChange={(e) => {
            setPage(1);
            setKeyword(e.target.value);
          }}
        />
        <input
          placeholder="分类ID"
          value={categoryId}
          onChange={(e) => {
            setPage(1);
            setCategoryId(e.target.value);
          }}
        />
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(e) => {
              setPage(1);
              setLowStock(e.target.checked);
            }}
          />
          仅低库存
        </label>
      </div>
      <div className="ops-grid">
        <div className="op-card">
          <h3>库存修正（POST /inventory/adjust）</h3>
          <div className="form-grid">
            <input
              placeholder="sku_id"
              value={adjustForm.sku_id}
              onChange={(e) => setAdjustForm((s) => ({ ...s, sku_id: e.target.value }))}
            />
            <input
              placeholder="actual_quantity"
              value={adjustForm.actual_quantity}
              onChange={(e) => setAdjustForm((s) => ({ ...s, actual_quantity: e.target.value }))}
            />
            <select
              value={adjustForm.inventory_diagonsis_result_type}
              onChange={(e) =>
                setAdjustForm((s) => ({
                  ...s,
                  inventory_diagonsis_result_type:
                    e.target.value as InventoryAdjustReq["inventory_diagonsis_result_type"],
                }))
              }
            >
              <option value="Normal">Normal</option>
              <option value="Shortage">Shortage</option>
              <option value="Unsale">Unsale</option>
            </select>
            <input
              placeholder='inventory_root_cause(JSON)'
              value={adjustForm.inventory_root_cause}
              onChange={(e) =>
                setAdjustForm((s) => ({ ...s, inventory_root_cause: e.target.value }))
              }
            />
            <input
              placeholder="remark(>30%必填)"
              value={adjustForm.remark}
              onChange={(e) => setAdjustForm((s) => ({ ...s, remark: e.target.value }))}
            />
            <button type="button" onClick={onAdjustInventory}>
              提交修正
            </button>
          </div>
        </div>
      </div>
      {renderTable(
        rows.map((x) => ({
          sku_code: x.sku_code,
          sku_name: x.sku_name,
          actual_quantity: x.actual_quantity,
          is_locked: x.is_locked ? "yes" : "no",
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

export function TransfersPage() {
  const { me } = useAuth();
  const [rows, setRows] = useState<TransferOrder[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"" | TransferOrder["status"]>("");
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
        <input
          placeholder="状态"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as "" | TransferOrder["status"]);
          }}
        />
        <input
          placeholder="start_date"
          value={startDate}
          onChange={(e) => {
            setPage(1);
            setStartDate(e.target.value);
          }}
        />
        <input
          placeholder="end_date"
          value={endDate}
          onChange={(e) => {
            setPage(1);
            setEndDate(e.target.value);
          }}
        />
      </div>
      <div className="ops-grid">
        <div className="op-card">
          <h3>门店确认（PATCH /transfers/:order_id/acknowledge）</h3>
          <div className="form-grid">
            <input
              placeholder="order_id"
              value={ackForm.order_id}
              onChange={(e) => setAckForm((s) => ({ ...s, order_id: e.target.value }))}
            />
            <input
              placeholder="detail_id(可选)"
              value={ackForm.detail_id}
              onChange={(e) => setAckForm((s) => ({ ...s, detail_id: e.target.value }))}
            />
            <input
              placeholder="actual_qty(可选)"
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
              placeholder="order_id"
              value={feedbackForm.order_id}
              onChange={(e) => setFeedbackForm((s) => ({ ...s, order_id: e.target.value }))}
            />
            <input
              placeholder="feedback"
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
          order_id: x.order_id,
          status: x.status,
          feedback: x.feedback ?? "-",
          detail_count: x.details.length,
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

