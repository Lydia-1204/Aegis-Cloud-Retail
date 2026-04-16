import { useEffect, useState } from "react";
import type { InventoryAdjustReq, InventoryItem, SKU, SKUCategory } from "@aegis/shared";
import { useAuth } from "../auth/AuthContext";
import { adjustInventory, fetchInventory, fetchSkuCategories, fetchSkus } from "../services/api";
import {
  INVENTORY_FIELD_LABELS,
  PaginationBar,
  parseError,
  renderTable,
} from "./storeHelpers";

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
