import { useEffect, useState } from "react";
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
