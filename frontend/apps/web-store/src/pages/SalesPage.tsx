import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { SKU, SalesDaily, SalesDailyDetail } from "@aegis/shared";
import { useAuth } from "../auth/AuthContext";
import {
  createSalesDaily,
  fetchSalesDaily,
  fetchSalesDailyDetail,
  fetchSkus,
  updateSalesDaily,
} from "../services/api";
import {
  DateField,
  ModalShell,
  PaginationBar,
  parseError,
  renderSalesDetail,
  renderSalesTable,
} from "./storeHelpers";

type SalesFormState = {
  sales_date: string;
  total_orders: string;
  total_income: string;
  total_profit: string;
  force_overwrite: boolean;
  sku_id: string;
  sku_amount: string;
  sku_income: string;
  sku_profit: string;
};

type SalesUpdateFormState = SalesFormState & {
  sales_id: string;
};

function formatCalculatedValue(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="sales-entry-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function confirmDetailed(title: string, details: Array<[string, string | number | null | undefined]>): boolean {
  const body = details.map(([label, value]) => `${label}：${value ?? "-"}`).join("\n");
  return window.confirm(`${title}\n\n${body}\n\n确认继续操作吗？`);
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
  const [createForm, setCreateForm] = useState<SalesFormState>({
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
  const [updateForm, setUpdateForm] = useState<SalesUpdateFormState>({
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

  function withCalculatedTotals<T extends SalesFormState>(form: T): T {
    const sku = skuOptions.find((item) => item.sku_id === Number(form.sku_id));
    const amount = Number(form.sku_amount);
    if (!sku || !Number.isFinite(amount) || amount <= 0) {
      return {
        ...form,
        total_orders: "",
        total_income: "",
        total_profit: "",
        sku_income: "",
        sku_profit: "",
      };
    }

    const income = amount * sku.sug_price;
    const profit = amount * (sku.sug_price - sku.std_cost);
    return {
      ...form,
      total_orders: formatCalculatedValue(amount),
      total_income: formatCalculatedValue(income),
      total_profit: formatCalculatedValue(profit),
      sku_income: formatCalculatedValue(income),
      sku_profit: formatCalculatedValue(profit),
    };
  }

  function updateCreateForm(patch: Partial<SalesFormState>) {
    setCreateForm((current) => withCalculatedTotals({ ...current, ...patch }));
  }

  function updateEditForm(patch: Partial<SalesUpdateFormState>) {
    setUpdateForm((current) => withCalculatedTotals({ ...current, ...patch }));
  }

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
    const payload = withCalculatedTotals(createForm);
    const sku = skuOptions.find((item) => item.sku_id === Number(payload.sku_id));
    if (
      !confirmDetailed("即将录入销售流水", [
        ["门店ID", me?.store_id ?? 1],
        ["销售日期", payload.sales_date],
        ["SKU", sku ? `${sku.sku_code} - ${sku.sku_name}` : payload.sku_id],
        ["销售数量", payload.sku_amount],
        ["总收入", payload.total_income],
        ["总利润", payload.total_profit],
        ["强制覆盖", payload.force_overwrite ? "是" : "否"],
      ])
    ) {
      return;
    }
    try {
      const res = await createSalesDaily({
        store_id: me?.store_id ?? 1,
        sales_date: payload.sales_date,
        total_orders: Number(payload.total_orders),
        total_income: Number(payload.total_income),
        total_profit: Number(payload.total_profit),
        force_overwrite: payload.force_overwrite,
        details: [
          {
            sku_id: Number(payload.sku_id),
            sku_amount: Number(payload.sku_amount),
            sku_income: Number(payload.sku_income),
            sku_profit: Number(payload.sku_profit),
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
    const payload = withCalculatedTotals(updateForm);
    const sku = skuOptions.find((item) => item.sku_id === Number(payload.sku_id));
    if (
      !confirmDetailed("即将修改销售流水", [
        ["销售单号", sales_id],
        ["门店ID", me?.store_id ?? 1],
        ["销售日期", payload.sales_date],
        ["SKU", sku ? `${sku.sku_code} - ${sku.sku_name}` : payload.sku_id],
        ["销售数量", payload.sku_amount],
        ["总收入", payload.total_income],
        ["总利润", payload.total_profit],
      ])
    ) {
      return;
    }
    try {
      const res = await updateSalesDaily(sales_id, {
        store_id: me?.store_id ?? 1,
        sales_date: payload.sales_date,
        total_orders: Number(payload.total_orders),
        total_income: Number(payload.total_income),
        total_profit: Number(payload.total_profit),
        force_overwrite: payload.force_overwrite,
        details: [
          {
            sku_id: Number(payload.sku_id),
            sku_amount: Number(payload.sku_amount),
            sku_income: Number(payload.sku_income),
            sku_profit: Number(payload.sku_profit),
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
              onChange={(value) => updateCreateForm({ sales_date: value })}
              hint="销售日期"
            />
            <div className="sales-flow-section">
              <h4>总流水（自动汇总）</h4>
              <div className="form-grid sales-summary-grid">
                <FieldLabel label="总销售数量">
                  <input value={createForm.total_orders} readOnly placeholder="由 SKU 数量汇总" />
                </FieldLabel>
                <FieldLabel label="总收入">
                  <input value={createForm.total_income} readOnly placeholder="自动计算" />
                </FieldLabel>
                <FieldLabel label="总利润">
                  <input value={createForm.total_profit} readOnly placeholder="自动计算" />
                </FieldLabel>
              </div>
            </div>
            <div className="sales-flow-section">
              <h4>单个 SKU 流水</h4>
              <div className="form-grid sales-sku-grid">
                <FieldLabel label="SKU">
                  <select
                    value={createForm.sku_id}
                    onChange={(e) => updateCreateForm({ sku_id: e.target.value })}
                  >
                    <option value="">请选择 SKU</option>
                    {skuOptions.map((sku) => (
                      <option key={sku.sku_id} value={String(sku.sku_id)}>
                        {sku.sku_code} - {sku.sku_name}
                      </option>
                    ))}
                  </select>
                </FieldLabel>
                <FieldLabel label="销售数量">
                  <input
                    type="number"
                    min="0"
                    placeholder="输入数量后自动算钱"
                    value={createForm.sku_amount}
                    onChange={(e) => updateCreateForm({ sku_amount: e.target.value })}
                  />
                </FieldLabel>
                <FieldLabel label="SKU销售收入">
                  <input value={createForm.sku_income} readOnly placeholder="数量 × 建议售价" />
                </FieldLabel>
                <FieldLabel label="SKU销售利润">
                  <input value={createForm.sku_profit} readOnly placeholder="数量 × 毛利" />
                </FieldLabel>
              </div>
            </div>
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
              onChange={(value) => updateEditForm({ sales_date: value })}
              disabled
            />
            <FieldLabel label="销售单号">
              <input
                placeholder="销售单号（自动填充，不可修改）"
                value={updateForm.sales_id}
                readOnly
              />
            </FieldLabel>
            <div className="sales-flow-section">
              <h4>总流水（自动汇总）</h4>
              <div className="form-grid sales-summary-grid">
                <FieldLabel label="总销售数量">
                  <input value={updateForm.total_orders} readOnly placeholder="由 SKU 数量汇总" />
                </FieldLabel>
                <FieldLabel label="总收入">
                  <input value={updateForm.total_income} readOnly placeholder="自动计算" />
                </FieldLabel>
                <FieldLabel label="总利润">
                  <input value={updateForm.total_profit} readOnly placeholder="自动计算" />
                </FieldLabel>
              </div>
            </div>
            <div className="sales-flow-section">
              <h4>单个 SKU 流水</h4>
              <div className="form-grid sales-sku-grid">
                <FieldLabel label="SKU">
                  <select
                    value={updateForm.sku_id}
                    onChange={(e) => updateEditForm({ sku_id: e.target.value })}
                  >
                    <option value="">请选择 SKU</option>
                    {skuOptions.map((sku) => (
                      <option key={sku.sku_id} value={String(sku.sku_id)}>
                        {sku.sku_code} - {sku.sku_name}
                      </option>
                    ))}
                  </select>
                </FieldLabel>
                <FieldLabel label="销售数量">
                  <input
                    type="number"
                    min="0"
                    placeholder="输入数量后自动算钱"
                    value={updateForm.sku_amount}
                    onChange={(e) => updateEditForm({ sku_amount: e.target.value })}
                  />
                </FieldLabel>
                <FieldLabel label="SKU销售收入">
                  <input value={updateForm.sku_income} readOnly placeholder="数量 × 建议售价" />
                </FieldLabel>
                <FieldLabel label="SKU销售利润">
                  <input value={updateForm.sku_profit} readOnly placeholder="数量 × 毛利" />
                </FieldLabel>
              </div>
            </div>
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
