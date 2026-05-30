import { useEffect, useState } from "react";
import type { InventoryAdjustReq, InventoryItem, SKUCategory } from "@aegis/shared";
import { useAuth } from "../auth/AuthContext";
import { adjustInventory, fetchInventory, fetchSkuCategories } from "../services/api";
import { INVENTORY_FIELD_LABELS, ModalShell, PaginationBar, parseError } from "./storeHelpers";

function confirmDetailed(title: string, details: Array<[string, string | number | null | undefined]>): boolean {
  const body = details.map(([label, value]) => `${label}：${value ?? "-"}`).join("\n");
  return window.confirm(`${title}\n\n${body}\n\n确认继续操作吗？`);
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
  const [categories, setCategories] = useState<SKUCategory[]>([]);
  const [activeItem, setActiveItem] = useState<InventoryItem | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    actual_quantity: "",
    inventory_diagonsis_result_type: "Normal" as InventoryAdjustReq["inventory_diagonsis_result_type"],
    inventory_root_cause: "",
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
    fetchSkuCategories()
      .then((res) => setCategories(res))
      .catch(() => setCategories([]));
  }, [me]);

  function onOpenAdjust(item: InventoryItem) {
    if (item.is_locked) {
      return;
    }
    setActiveItem(item);
    setAdjustForm({
      actual_quantity: String(item.actual_quantity),
      inventory_diagonsis_result_type: "Normal" as InventoryAdjustReq["inventory_diagonsis_result_type"],
      inventory_root_cause: "",
      remark: "",
    });
    setMessage("");
    setError("");
  }

  async function onAdjustInventory() {
    if (!activeItem) {
      return;
    }

    setMessage("");
    setError("");
    if (
      !confirmDetailed("即将修改库存", [
        ["门店ID", me?.store_id ?? 1],
        ["SKU编码", activeItem.sku_code],
        ["SKU名称", activeItem.sku_name],
        ["原库存", activeItem.actual_quantity],
        ["新库存", adjustForm.actual_quantity],
        ["诊断类型", adjustForm.inventory_diagonsis_result_type],
        ["盘点原因", adjustForm.inventory_root_cause],
        ["备注", adjustForm.remark],
      ])
    ) {
      return;
    }
    try {
      const rootCause = { reason: adjustForm.inventory_root_cause };
      await adjustInventory({
        store_id: me?.store_id ?? 1,
        sku_id: activeItem.sku_id,
        actual_quantity: Number(adjustForm.actual_quantity),
        inventory_diagonsis_result_type: adjustForm.inventory_diagonsis_result_type,
        inventory_root_cause: rootCause,
        remark: adjustForm.remark || undefined,
      });
      setMessage(`SKU ${activeItem.sku_code} 库存修正成功`);
      setActiveItem(null);
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

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{INVENTORY_FIELD_LABELS.sku_code}</th>
              <th>{INVENTORY_FIELD_LABELS.sku_name}</th>
              <th>{INVENTORY_FIELD_LABELS.actual_quantity}</th>
              <th>{INVENTORY_FIELD_LABELS.is_locked}</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty inventory-empty-cell">
                  暂无数据
                </td>
              </tr>
            ) : (
              rows.map((item) => (
                <tr key={item.inventory_id}>
                  <td>{item.sku_code}</td>
                  <td>{item.sku_name}</td>
                  <td>{item.actual_quantity}</td>
                  <td>{item.is_locked ? "是" : "否"}</td>
                  <td>
                    <button
                      type="button"
                      className="inventory-action-btn"
                      disabled={item.is_locked}
                      onClick={() => onOpenAdjust(item)}
                    >
                      修正库存
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

      {activeItem ? (
        <ModalShell title={`库存修正 - ${activeItem.sku_code}`} onClose={() => setActiveItem(null)}>
          <p className="hint">商品：{activeItem.sku_name}</p>
          <div className="form-grid inventory-adjust-grid">
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
              <option value="Normal">正常</option>
              <option value="Shortage">缺货</option>
              <option value="Unsale">滞销</option>
            </select>
            <input
              placeholder="盘点原因"
              value={adjustForm.inventory_root_cause}
              onChange={(e) => setAdjustForm((s) => ({ ...s, inventory_root_cause: e.target.value }))}
            />
            <input
              placeholder="备注（超 30% 必填）"
              value={adjustForm.remark}
              onChange={(e) => setAdjustForm((s) => ({ ...s, remark: e.target.value }))}
            />
          </div>
          <div className="sales-form-actions">
            <button type="button" onClick={onAdjustInventory}>
              提交修正
            </button>
          </div>
        </ModalShell>
      ) : null}
    </section>
  );
}
