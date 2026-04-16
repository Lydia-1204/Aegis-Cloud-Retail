import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import type {
  ChatMessage,
  ChatSessionItem,
  InventoryAdjustReq,
  InventoryItem,
  SKU,
  SKUCategory,
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
  fetchChatHistory,
  fetchChatSessions,
  fetchSkuCategories,
  fetchSkus,
  fetchTransfers,
  streamChatCompletions,
  subscribeTrafficRealtime,
  updateSalesDaily,
} from "../services/api";

type Row = Record<string, string | number | null>;

const SALES_FIELD_LABELS = {
  sales_id: "销售单号",
  sales_date: "销售日期",
  total_orders: "总单数",
  total_income: "总收入",
  total_profit: "总利润",
};

const SALES_DETAIL_FIELD_LABELS = {
  sku_id: "SKU",
  sku_name: "商品名称",
  sku_amount: "销售数量",
  sku_income: "销售收入",
  sku_profit: "销售利润",
};

const INVENTORY_FIELD_LABELS = {
  sku_code: "SKU 编码",
  sku_name: "商品名称",
  actual_quantity: "当前库存",
  is_locked: "锁定状态",
};

const TRANSFER_FIELD_LABELS = {
  order_id: "调拨单号",
  status: "状态",
  feedback: "门店异议",
  detail_count: "明细数量",
};

const TRANSFER_STATUS_LABELS: Record<TransferOrder["status"], string> = {
  ai_generated: "AI 生成",
  pending_approval: "待审核",
  issued_pending_confirmation: "已下发待确认",
  in_negotiation: "协商中",
  confirmed_executed: "已确认执行",
  cancelled: "已取消",
};

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

function renderSalesDetail(detail: SalesDailyDetail) {
  const summaryRows: Row[] = [
    {
      [SALES_FIELD_LABELS.sales_id]: detail.sales_id,
      [SALES_FIELD_LABELS.sales_date]: detail.sales_date,
      [SALES_FIELD_LABELS.total_orders]: detail.total_orders,
      [SALES_FIELD_LABELS.total_income]: detail.total_income,
      [SALES_FIELD_LABELS.total_profit]: detail.total_profit,
    },
  ];

  const detailRows: Row[] = detail.details.map((item) => ({
    [SALES_DETAIL_FIELD_LABELS.sku_id]: item.sku_id,
    [SALES_DETAIL_FIELD_LABELS.sku_name]: item.sku_name,
    [SALES_DETAIL_FIELD_LABELS.sku_amount]: item.sku_amount,
    [SALES_DETAIL_FIELD_LABELS.sku_income]: item.sku_income,
    [SALES_DETAIL_FIELD_LABELS.sku_profit]: item.sku_profit,
  }));

  return (
    <div className="detail-box">
      <strong>销售详情</strong>
      {renderTable(summaryRows)}
      <strong>销售明细</strong>
      {renderTable(detailRows)}
    </div>
  );
}

function renderSalesTable(
  rows: SalesDaily[],
  onViewDetail: (salesId: number) => void,
  onEdit: (salesId: number) => void
) {
  if (rows.length === 0) {
    return <p className="empty">暂无数据</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{SALES_FIELD_LABELS.sales_id}</th>
            <th>{SALES_FIELD_LABELS.sales_date}</th>
            <th>{SALES_FIELD_LABELS.total_orders}</th>
            <th>{SALES_FIELD_LABELS.total_income}</th>
            <th>{SALES_FIELD_LABELS.total_profit}</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.sales_id}>
              <td>{row.sales_id}</td>
              <td>{row.sales_date}</td>
              <td>{row.total_orders}</td>
              <td>{row.total_income}</td>
              <td>{row.total_profit}</td>
              <td>
                <button type="button" onClick={() => void onViewDetail(row.sales_id)}>
                  查看详情
                </button>
                <button type="button" onClick={() => void onEdit(row.sales_id)}>
                  修改
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <strong>{title}</strong>
          <button type="button" className="modal-close" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="date-field">
      <span>{label}</span>
      <div className="date-input-row">
        <input
          type="date"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        {hint ? <small className="date-hint">{hint}</small> : null}
      </div>
    </label>
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
  const [activeModal, setActiveModal] = useState<"detail" | "edit" | null>(null);
  const [skuOptions, setSkuOptions] = useState<SKU[]>([]);
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

  useEffect(() => {
    if (!me) {
      return;
    }
    fetchSkus({ page: 1, limit: 200 })
      .then((res) => setSkuOptions(res.data))
      .catch(() => setSkuOptions([]));
  }, [me]);

  async function onFetchDetail(sales_id: number) {
    setMessage("");
    setError("");
    try {
      const res = await fetchSalesDailyDetail(sales_id);
      setDetail(res);
      setActiveModal("detail");
      setMessage(`已加载销售单 ${sales_id} 详情`);
    } catch (err) {
      setError(parseError(err));
    }
  }

  async function onPrepareUpdate(sales_id: number) {
    setMessage("");
    setError("");
    try {
      const res = await fetchSalesDailyDetail(sales_id);
      const firstDetail = res.details[0];
      setDetail(res);
      setUpdateForm({
        sales_id: String(res.sales_id),
        sales_date: res.sales_date,
        total_orders: String(res.total_orders),
        total_income: String(res.total_income),
        total_profit: String(res.total_profit),
        force_overwrite: true,
        sku_id: firstDetail ? String(firstDetail.sku_id) : "",
        sku_amount: firstDetail ? String(firstDetail.sku_amount) : "",
        sku_income: firstDetail ? String(firstDetail.sku_income) : "",
        sku_profit: firstDetail ? String(firstDetail.sku_profit) : "",
      });
      setActiveModal("edit");
      setMessage(`已载入销售单 ${sales_id} 的修改内容`);
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
        <DateField
          label="销售日期"
          value={salesDate}
          onChange={(value) => {
            setPage(1);
            setSalesDate(value);
          }}
        />
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
        <div className="op-card op-card-full">
          <h3 className="sales-create-title">提交流水</h3>
          <div className="form-grid sales-form-grid">
            <DateField
              label="销售日期"
              value={createForm.sales_date}
              onChange={(value) => setCreateForm((s) => ({ ...s, sales_date: value }))}
              hint="销售日期"
            />
            <input
              placeholder="总单数"
              value={createForm.total_orders}
              onChange={(e) => setCreateForm((s) => ({ ...s, total_orders: e.target.value }))}
            />
            <input
              placeholder="总收入"
              value={createForm.total_income}
              onChange={(e) => setCreateForm((s) => ({ ...s, total_income: e.target.value }))}
            />
            <input
              placeholder="总利润"
              value={createForm.total_profit}
              onChange={(e) => setCreateForm((s) => ({ ...s, total_profit: e.target.value }))}
            />
            <select
              value={createForm.sku_id}
              onChange={(e) => setCreateForm((s) => ({ ...s, sku_id: e.target.value }))}
            >
              <option value="">请选择 SKU</option>
              {skuOptions.map((sku) => (
                <option key={sku.sku_id} value={String(sku.sku_id)}>
                  {sku.sku_code} - {sku.sku_name}
                </option>
              ))}
            </select>
            <input
              placeholder="销售数量"
              value={createForm.sku_amount}
              onChange={(e) => setCreateForm((s) => ({ ...s, sku_amount: e.target.value }))}
            />
            <input
              placeholder="销售收入"
              value={createForm.sku_income}
              onChange={(e) => setCreateForm((s) => ({ ...s, sku_income: e.target.value }))}
            />
            <input
              placeholder="销售利润"
              value={createForm.sku_profit}
              onChange={(e) => setCreateForm((s) => ({ ...s, sku_profit: e.target.value }))}
            />
          </div>
          <div className="sales-form-actions sales-create-actions">
            <label className="check-line">
              <input
                type="checkbox"
                checked={createForm.force_overwrite}
                onChange={(e) =>
                  setCreateForm((s) => ({ ...s, force_overwrite: e.target.checked }))
                }
              />
              强制覆盖
            </label>
            <button type="button" onClick={onCreateSales}>
              提交
            </button>
          </div>
        </div>
      </div>
      {renderSalesTable(rows, onFetchDetail, onPrepareUpdate)}
      <PaginationBar
        page={page}
        total={total}
        limit={limit}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />
      {activeModal === "detail" && detail ? (
        <ModalShell title="销售详情" onClose={() => setActiveModal(null)}>
          {renderSalesDetail(detail)}
        </ModalShell>
      ) : null}
      {activeModal === "edit" ? (
        <ModalShell title="修改流水" onClose={() => setActiveModal(null)}>
          <p className="hint">销售单号和销售日期已自动填充，不可修改。</p>
          <div className="form-grid sales-edit-grid">
            <DateField
              label="销售日期"
              value={updateForm.sales_date}
              onChange={(value) => setUpdateForm((s) => ({ ...s, sales_date: value }))}
              disabled
            />
            <input
              placeholder="销售单号（自动填充，不可修改）"
              value={updateForm.sales_id}
              readOnly
              onChange={(e) => setUpdateForm((s) => ({ ...s, sales_id: e.target.value }))}
            />
            <input
              placeholder="总单数"
              value={updateForm.total_orders}
              onChange={(e) => setUpdateForm((s) => ({ ...s, total_orders: e.target.value }))}
            />
            <input
              placeholder="总收入"
              value={updateForm.total_income}
              onChange={(e) => setUpdateForm((s) => ({ ...s, total_income: e.target.value }))}
            />
            <select
              value={updateForm.sku_id}
              onChange={(e) => setUpdateForm((s) => ({ ...s, sku_id: e.target.value }))}
            >
              <option value="">请选择 SKU</option>
              {skuOptions.map((sku) => (
                <option key={sku.sku_id} value={String(sku.sku_id)}>
                  {sku.sku_code} - {sku.sku_name}
                </option>
              ))}
            </select>
            <input
              placeholder="总利润"
              value={updateForm.total_profit}
              onChange={(e) => setUpdateForm((s) => ({ ...s, total_profit: e.target.value }))}
            />
            <input
              placeholder="销售数量"
              value={updateForm.sku_amount}
              onChange={(e) => setUpdateForm((s) => ({ ...s, sku_amount: e.target.value }))}
            />
            <input
              placeholder="销售收入"
              value={updateForm.sku_income}
              onChange={(e) => setUpdateForm((s) => ({ ...s, sku_income: e.target.value }))}
            />
            <input
              placeholder="销售利润"
              value={updateForm.sku_profit}
              onChange={(e) => setUpdateForm((s) => ({ ...s, sku_profit: e.target.value }))}
            />
          </div>
          <div className="sales-form-actions">
            <button type="button" onClick={onUpdateSales}>
              更新
            </button>
          </div>
        </ModalShell>
      ) : null}
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
  const [skuOptions, setSkuOptions] = useState<SKU[]>([]);
  const [categories, setCategories] = useState<SKUCategory[]>([]);
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
      low_stock: lowStock ? true : undefined,
    });
    setRows(res.data);
    setTotal(res.total);
  }

  useEffect(() => {
    void loadInventory();
  }, [page, limit, keyword, categoryId, lowStock, me]);

  useEffect(() => {
    if (!me) {
      return;
    }
    fetchSkus({ page: 1, limit: 200 })
      .then((res) => setSkuOptions(res.data))
      .catch(() => setSkuOptions([]));
    fetchSkuCategories()
      .then((res) => setCategories(res))
      .catch(() => setCategories([]));
  }, [me]);

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
        <select
          value={categoryId}
          onChange={(e) => {
            setPage(1);
            setCategoryId(e.target.value);
          }}
        >
          <option value="">全部分类</option>
          {categories.map((category) => (
            <option key={category.category_id} value={String(category.category_id)}>
              {category.category_name}
            </option>
          ))}
        </select>
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
            <select
              value={adjustForm.sku_id}
              onChange={(e) => setAdjustForm((s) => ({ ...s, sku_id: e.target.value }))}
            >
              <option value="">请选择 SKU</option>
              {skuOptions.map((sku) => (
                <option key={sku.sku_id} value={String(sku.sku_id)}>
                  {sku.sku_code} - {sku.sku_name}
                </option>
              ))}
            </select>
            <input
              placeholder="当前库存数量"
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
              placeholder='盘点原因 JSON'
              value={adjustForm.inventory_root_cause}
              onChange={(e) =>
                setAdjustForm((s) => ({ ...s, inventory_root_cause: e.target.value }))
              }
            />
            <input
              placeholder="备注（超 30% 必填）"
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
          [INVENTORY_FIELD_LABELS.sku_code]: x.sku_code,
          [INVENTORY_FIELD_LABELS.sku_name]: x.sku_name,
          [INVENTORY_FIELD_LABELS.actual_quantity]: x.actual_quantity,
          [INVENTORY_FIELD_LABELS.is_locked]: x.is_locked ? "是" : "否",
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

