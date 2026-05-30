import { useEffect, useMemo, useState } from "react";
import { formatBeijingDateTime } from "@aegis/shared";
import type { SKU, SKUCategory, Store, TransferOrder, User } from "@aegis/shared";
import {
  approveTransfer,
  confirmTransfer,
  createTransfer,
  createSku,
  createStore,
  createUser,
  deactivateSku,
  fetchSkuCategories,
  fetchSkus,
  fetchStoreById,
  fetchStores,
  fetchTransferForecast,
  fetchTransfers,
  issueTransfer,
  fetchUsers,
  updateSku,
  updateStore,
  updateUser,
  deactivateUser,
} from "../services/api";

type Row = Record<string, string | number | null>;

const STORE_FIELD_LABELS = {
  store_id: "门店ID",
  store_code: "门店编码",
  store_name: "门店名称",
  store_location: "门店位置",
  store_area: "门店面积",
  store_status: "门店状态",
};

const STORE_STATUS_LABELS: Record<"active" | "inactive", string> = {
  active: "营业中",
  inactive: "已停用",
};

const SKU_FIELD_LABELS = {
  sku_id: "SKU ID",
  sku_code: "SKU编码",
  sku_name: "SKU名称",
  category_name: "分类",
  category_id: "分类ID",
  std_cost: "标准成本",
  sug_price: "建议售价",
  sku_status: "SKU状态",
};

const SKU_STATUS_LABELS: Record<string, string> = {
  sale: "在售",
  unsale: "已停用",
};

const USER_FIELD_LABELS = {
  user_id: "用户ID",
  user_name: "用户姓名",
  account_name: "账号",
  role_name: "角色",
  role_id: "角色ID",
  store_id: "门店ID",
};

const TRANSFER_FIELD_LABELS = {
  order_id: "调拨单号",
  store_name: "门店名称",
  status: "状态",
  feedback: "异议反馈",
  detail_count: "明细数量",
};

const TRANSFER_STATUS_LABELS: Record<TransferOrder["status"], string> = {
  ai_generated: "AI生成",
  pending_approval: "待审核",
  issued_pending_confirmation: "已下发待确认",
  in_negotiation: "协商中",
  confirmed_executed: "已确认执行",
  cancelled: "已作废",
};

const TRANSFER_DIRECTION_LABELS: Record<"H2S" | "S2H", string> = {
  H2S: "总部到门店",
  S2H: "门店到总部",
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

function toNumberOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : undefined;
}

function parseError(err: unknown): string {
  return err instanceof Error ? err.message : "请求失败";
}

function confirmDetailed(title: string, details: Array<[string, string | number | null | undefined]>): boolean {
  const body = details.map(([label, value]) => `${label}：${value ?? "-"}`).join("\n");
  return window.confirm(`${title}\n\n${body}\n\n确认继续操作吗？`);
}

function isBusinessStore(store: Store): boolean {
  const code = store.store_code.trim().toUpperCase();
  return store.store_id !== 0 && code !== "HQ" && !store.store_name.includes("总部");
}

function nextSequentialCode(items: Array<{ code: string }>, prefix: string, width = 3): string {
  const max = items.reduce((best, item) => {
    const match = item.code.trim().match(new RegExp(`^${prefix}(\\d+)$`, "i"));
    return match ? Math.max(best, Number(match[1])) : best;
  }, 0);
  return `${prefix}${String(max + 1).padStart(width, "0")}`;
}

export function StoresPage() {
  const [rows, setRows] = useState<Store[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [status, setStatus] = useState<"" | "active" | "inactive">("");
  const [appliedStatus, setAppliedStatus] = useState<"" | "active" | "inactive">("");
  const [detailStore, setDetailStore] = useState<Store | null>(null);
  const [activeStoreModal, setActiveStoreModal] = useState<"detail" | "edit" | null>(null);
  const [createForm, setCreateForm] = useState({
    store_code: "S001",
    store_name: "",
    store_location: "",
    store_area: "",
    store_status: "active" as "active" | "inactive",
  });
  const [editForm, setEditForm] = useState({
    store_id: "",
    store_name: "",
    store_location: "",
    store_area: "",
    store_status: "" as "" | "active" | "inactive",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadStores(targetPage = page) {
    const res = await fetchStores({
      page: targetPage,
      limit,
      keyword: appliedKeyword || undefined,
      store_status: appliedStatus || undefined,
    });
    setRows(res.data.filter(isBusinessStore));
    setTotal(res.total);
  }

  useEffect(() => {
    void loadStores();
  }, [page, limit, appliedKeyword, appliedStatus]);

  useEffect(() => {
    fetchStores({ page: 1, limit: 1000 })
      .then((res) => {
        const code = nextSequentialCode(
          res.data.filter(isBusinessStore).map((store) => ({ code: store.store_code })),
          "S"
        );
        setCreateForm((s) => ({ ...s, store_code: code }));
      })
      .catch(() => undefined);
  }, [rows]);

  function onSearchStores() {
    setAppliedKeyword(keyword);
    setAppliedStatus(status);
    setPage(1);
  }

  async function onCreateStore() {
    setMessage("");
    setError("");
    if (
      !confirmDetailed("即将创建门店", [
        ["门店编码", createForm.store_code],
        ["门店名称", createForm.store_name],
        ["门店位置", createForm.store_location],
        ["门店面积", createForm.store_area],
        ["门店状态", STORE_STATUS_LABELS[createForm.store_status]],
      ])
    ) {
      return;
    }
    try {
      const created = await createStore({
        store_code: createForm.store_code.trim(),
        store_name: createForm.store_name.trim(),
        store_location: createForm.store_location.trim(),
        store_area: Number(createForm.store_area),
        store_status: createForm.store_status,
      });
      setDetailStore(created);
      setCreateForm({
        store_code: "",
        store_name: "",
        store_location: "",
        store_area: "",
        store_status: "active",
      });
      setMessage("门店创建成功");
      await loadStores(1);
      setPage(1);
    } catch (err) {
      setError(parseError(err));
    }
  }

  async function onFetchStoreDetail(store_id: number) {
    setMessage("");
    setError("");
    try {
      const detail = await fetchStoreById(store_id);
      setDetailStore(detail);
      setActiveStoreModal("detail");
      setMessage(`已加载门店 ${store_id} 详情`);
    } catch (err) {
      setError(parseError(err));
    }
  }

  function fillEditForm(row: Store) {
    setEditForm({
      store_id: String(row.store_id),
      store_name: row.store_name,
      store_location: row.store_location,
      store_area: String(row.store_area),
      store_status: row.store_status,
    });
    setActiveStoreModal("edit");
  }

  async function onUpdateStore() {
    setMessage("");
    setError("");
    const store_id = Number(editForm.store_id);
    if (!store_id) {
      setError("请先输入或选择门店ID");
      return;
    }

    const payload = {
      store_name: editForm.store_name.trim() || undefined,
      store_location: editForm.store_location.trim() || undefined,
      store_area: toNumberOrUndefined(editForm.store_area),
      store_status: editForm.store_status || undefined,
    };

    if (
      payload.store_status === "inactive" &&
      !confirmDetailed("即将停用门店", [
        ["门店ID", store_id],
        ["门店名称", editForm.store_name],
        ["门店位置", editForm.store_location],
        ["门店面积", editForm.store_area],
      ])
    ) {
      return;
    }

    try {
      const updated = await updateStore(store_id, payload);
      setDetailStore(updated);
      setActiveStoreModal(null);
      setMessage("门店更新成功");
      await loadStores();
    } catch (err) {
      setError(parseError(err));
    }
  }

  return (
    <section>
      <h2>门店管理</h2>
      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div className="query-bar">
        <input
          placeholder="搜索门店名/编码"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | "active" | "inactive")}
        >
          <option value="">全部状态</option>
          <option value="active">{STORE_STATUS_LABELS.active}</option>
          <option value="inactive">{STORE_STATUS_LABELS.inactive}</option>
        </select>
        <button type="button" onClick={onSearchStores}>
          搜索
        </button>
      </div>
      <div className="ops-grid">
        <div className="op-card">
          <h3>新增门店</h3>
          <div className="form-grid">
            <input
              placeholder="门店编码（自动分配）"
              value={createForm.store_code}
              readOnly
            />
            <input
              placeholder="门店名称"
              value={createForm.store_name}
              onChange={(e) => setCreateForm((s) => ({ ...s, store_name: e.target.value }))}
            />
            <input
              placeholder="门店位置"
              value={createForm.store_location}
              onChange={(e) => setCreateForm((s) => ({ ...s, store_location: e.target.value }))}
            />
            <input
              placeholder="门店面积"
              value={createForm.store_area}
              onChange={(e) => setCreateForm((s) => ({ ...s, store_area: e.target.value }))}
            />
            <select
              value={createForm.store_status}
              onChange={(e) =>
                setCreateForm((s) => ({ ...s, store_status: e.target.value as "active" | "inactive" }))
              }
            >
              <option value="active">{STORE_STATUS_LABELS.active}</option>
              <option value="inactive">{STORE_STATUS_LABELS.inactive}</option>
            </select>
            <button type="button" onClick={onCreateStore}>
              创建
            </button>
          </div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{STORE_FIELD_LABELS.store_id}</th>
              <th>{STORE_FIELD_LABELS.store_code}</th>
              <th>{STORE_FIELD_LABELS.store_name}</th>
              <th>{STORE_FIELD_LABELS.store_status}</th>
              <th>{STORE_FIELD_LABELS.store_area}</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty">
                  暂无数据
                </td>
              </tr>
            ) : (
              rows.map((x) => (
                <tr key={x.store_id}>
                  <td>{x.store_id}</td>
                  <td>{x.store_code}</td>
                  <td>{x.store_name}</td>
                  <td>{STORE_STATUS_LABELS[x.store_status]}</td>
                  <td>{x.store_area}</td>
                  <td>
                    <div className="row-action">
                      <button type="button" onClick={() => void onFetchStoreDetail(x.store_id)}>
                        详情
                      </button>
                      <button type="button" onClick={() => fillEditForm(x)}>
                        编辑
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {activeStoreModal === "detail" && detailStore ? (
        <div className="hq-modal-overlay" role="dialog" aria-modal="true">
          <div className="hq-modal-dialog">
            <div className="hq-modal-header">
              <h3>门店详情（GET /stores/:store_id）</h3>
              <button type="button" onClick={() => setActiveStoreModal(null)} className="hq-modal-close">
                关闭
              </button>
            </div>
            <div className="hq-modal-body">
              {renderTable([
                {
                  [STORE_FIELD_LABELS.store_id]: detailStore.store_id,
                  [STORE_FIELD_LABELS.store_code]: detailStore.store_code,
                  [STORE_FIELD_LABELS.store_name]: detailStore.store_name,
                  [STORE_FIELD_LABELS.store_location]: detailStore.store_location,
                  [STORE_FIELD_LABELS.store_area]: detailStore.store_area,
                  [STORE_FIELD_LABELS.store_status]: STORE_STATUS_LABELS[detailStore.store_status],
                },
              ])}
            </div>
          </div>
        </div>
      ) : null}

      {activeStoreModal === "edit" ? (
        <div className="hq-modal-overlay" role="dialog" aria-modal="true">
          <div className="hq-modal-dialog">
            <div className="hq-modal-header">
              <h3>编辑门店</h3>
              <button type="button" onClick={() => setActiveStoreModal(null)} className="hq-modal-close">
                关闭
              </button>
            </div>
            <div className="hq-modal-body">
              <div className="form-grid">
                <label className="hq-form-field">
                  <span>门店ID（系统编号）</span>
                  <input value={editForm.store_id} readOnly />
                </label>
                <label className="hq-form-field">
                  <span>门店名称（可选）</span>
                  <input
                    value={editForm.store_name}
                    onChange={(e) => setEditForm((s) => ({ ...s, store_name: e.target.value }))}
                  />
                </label>
                <label className="hq-form-field">
                  <span>门店位置（可选）</span>
                  <input
                    value={editForm.store_location}
                    onChange={(e) => setEditForm((s) => ({ ...s, store_location: e.target.value }))}
                  />
                </label>
                <label className="hq-form-field">
                  <span>门店面积（可选）</span>
                  <input
                    value={editForm.store_area}
                    onChange={(e) => setEditForm((s) => ({ ...s, store_area: e.target.value }))}
                  />
                </label>
                <label className="hq-form-field">
                  <span>门店状态（可选）</span>
                  <select
                    value={editForm.store_status}
                    onChange={(e) =>
                      setEditForm((s) => ({ ...s, store_status: e.target.value as "" | "active" | "inactive" }))
                    }
                  >
                    <option value="">门店状态（可选）</option>
                    <option value="active">{STORE_STATUS_LABELS.active}</option>
                    <option value="inactive">{STORE_STATUS_LABELS.inactive}</option>
                  </select>
                </label>
              </div>
              <div className="hq-modal-actions">
                <button type="button" onClick={onUpdateStore}>
                  更新
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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

export function SkusPage() {
  const [rows, setRows] = useState<SKU[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [appliedCategoryId, setAppliedCategoryId] = useState("");
  const [categories, setCategories] = useState<SKUCategory[]>([]);
  const [activeSkuModal, setActiveSkuModal] = useState<"edit" | null>(null);
  const [createForm, setCreateForm] = useState({
    sku_code: "SKU001",
    sku_name: "",
    category_id: "",
    std_cost: "",
    sug_price: "",
    force: false,
  });
  const [editForm, setEditForm] = useState({
    sku_id: "",
    sku_name: "",
    category_id: "",
    std_cost: "",
    sug_price: "",
    force: false,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSkus(targetPage = page) {
    const res = await fetchSkus({
      page: targetPage,
      limit,
      keyword: appliedKeyword || undefined,
      category_id: appliedCategoryId ? Number(appliedCategoryId) : undefined,
    });
    setRows(res.data);
    setTotal(res.total);
  }

  useEffect(() => {
    void loadSkus();
  }, [page, limit, appliedKeyword, appliedCategoryId]);

  useEffect(() => {
    fetchSkuCategories()
      .then((res) => setCategories(res))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    fetchSkus({ page: 1, limit: 1000 })
      .then((res) => {
        const code = nextSequentialCode(
          res.data.map((sku) => ({ code: sku.sku_code })),
          "SKU"
        );
        setCreateForm((s) => ({ ...s, sku_code: code }));
      })
      .catch(() => undefined);
  }, [rows]);

  const categoryOptions = useMemo(
    () => categories.map((x) => ({ value: String(x.category_id), label: x.category_name })),
    [categories]
  );

  function fillEditSku(row: SKU) {
    setEditForm({
      sku_id: String(row.sku_id),
      sku_name: row.sku_name,
      category_id: String(row.category_id),
      std_cost: String(row.std_cost),
      sug_price: String(row.sug_price),
      force: false,
    });
    setActiveSkuModal("edit");
  }

  function onSearchSkus() {
    setAppliedKeyword(keyword);
    setAppliedCategoryId(categoryId);
    setPage(1);
  }

  async function onCreateSku() {
    setMessage("");
    setError("");
    const categoryLabel = categoryOptions.find((x) => x.value === createForm.category_id)?.label ?? createForm.category_id;
    if (
      !confirmDetailed("即将创建 SKU", [
        ["SKU编码", createForm.sku_code],
        ["SKU名称", createForm.sku_name],
        ["分类", categoryLabel],
        ["标准成本", createForm.std_cost],
        ["建议售价", createForm.sug_price],
        ["强制覆盖", createForm.force ? "是" : "否"],
      ])
    ) {
      return;
    }
    try {
      await createSku({
        sku_code: createForm.sku_code.trim(),
        sku_name: createForm.sku_name.trim(),
        category_id: Number(createForm.category_id),
        std_cost: Number(createForm.std_cost),
        sug_price: Number(createForm.sug_price),
        force: createForm.force,
        sku_status: "sale",
      });
      setMessage("SKU 创建成功");
      setCreateForm({
        sku_code: "",
        sku_name: "",
        category_id: "",
        std_cost: "",
        sug_price: "",
        force: false,
      });
      await loadSkus(1);
      setPage(1);
    } catch (err) {
      setError(parseError(err));
    }
  }

  async function onUpdateSku() {
    setMessage("");
    setError("");
    const sku_id = Number(editForm.sku_id);
    if (!sku_id) {
      setError("请先输入或选择 SKU ID");
      return;
    }
    try {
      await updateSku(sku_id, {
        sku_name: editForm.sku_name.trim() || undefined,
        category_id: toNumberOrUndefined(editForm.category_id),
        std_cost: toNumberOrUndefined(editForm.std_cost),
        sug_price: toNumberOrUndefined(editForm.sug_price),
        force: editForm.force,
      });
      setActiveSkuModal(null);
      setMessage("SKU 更新成功");
      await loadSkus();
    } catch (err) {
      setError(parseError(err));
    }
  }

  async function onDeactivateSku(sku_id: number) {
    setMessage("");
    setError("");
    const sku = rows.find((item) => item.sku_id === sku_id);
    if (
      !confirmDetailed("即将停用 SKU", [
        ["SKU ID", sku_id],
        ["SKU编码", sku?.sku_code],
        ["SKU名称", sku?.sku_name],
        ["分类", sku?.category_name],
      ])
    ) {
      return;
    }
    try {
      await deactivateSku(sku_id);
      setMessage(`SKU ${sku_id} 已停用`);
      await loadSkus();
    } catch (err) {
      setError(parseError(err));
    }
  }

  return (
    <section>
      <h2>SKU 目录</h2>
      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div className="query-bar">
        <input
          placeholder="搜索 SKU 名/编码"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">全部分类</option>
          {categoryOptions.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={onSearchSkus}>
          搜索
        </button>
      </div>
      <div className="ops-grid">
        <div className="op-card">
          <h3>新增 SKU</h3>
          <div className="form-grid">
            <input
              placeholder="SKU编码（自动分配）"
              value={createForm.sku_code}
              readOnly
            />
            <input
              placeholder="SKU名称"
              value={createForm.sku_name}
              onChange={(e) => setCreateForm((s) => ({ ...s, sku_name: e.target.value }))}
            />
            <select
              value={createForm.category_id}
              onChange={(e) => setCreateForm((s) => ({ ...s, category_id: e.target.value }))}
            >
              <option value="">分类</option>
              {categoryOptions.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <input
              placeholder="标准成本"
              value={createForm.std_cost}
              onChange={(e) => setCreateForm((s) => ({ ...s, std_cost: e.target.value }))}
            />
            <input
              placeholder="建议售价"
              value={createForm.sug_price}
              onChange={(e) => setCreateForm((s) => ({ ...s, sug_price: e.target.value }))}
            />
            <label className="check-line">
              <input
                type="checkbox"
                checked={createForm.force}
                onChange={(e) => setCreateForm((s) => ({ ...s, force: e.target.checked }))}
              />
              强制覆盖
            </label>
            <button type="button" onClick={onCreateSku}>
              创建
            </button>
          </div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{SKU_FIELD_LABELS.sku_id}</th>
              <th>{SKU_FIELD_LABELS.sku_code}</th>
              <th>{SKU_FIELD_LABELS.sku_name}</th>
              <th>{SKU_FIELD_LABELS.category_name}</th>
              <th>{SKU_FIELD_LABELS.std_cost}</th>
              <th>{SKU_FIELD_LABELS.sug_price}</th>
              <th>{SKU_FIELD_LABELS.sku_status}</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty">
                  暂无数据
                </td>
              </tr>
            ) : (
              rows.map((x) => (
                <tr key={x.sku_id}>
                  <td>{x.sku_id}</td>
                  <td>{x.sku_code}</td>
                  <td>{x.sku_name}</td>
                  <td>{x.category_name}</td>
                  <td>{x.std_cost}</td>
                  <td>{x.sug_price}</td>
                  <td>{SKU_STATUS_LABELS[x.sku_status] ?? x.sku_status}</td>
                  <td>
                    <div className="row-action">
                      <button type="button" onClick={() => fillEditSku(x)}>
                        编辑
                      </button>
                      <button type="button" onClick={() => void onDeactivateSku(x.sku_id)}>
                        停用
                      </button>
                    </div>
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
      {activeSkuModal === "edit" ? (
        <div className="hq-modal-overlay" role="dialog" aria-modal="true">
          <div className="hq-modal-dialog">
            <div className="hq-modal-header">
              <h3>编辑 SKU</h3>
              <button type="button" onClick={() => setActiveSkuModal(null)} className="hq-modal-close">
                关闭
              </button>
            </div>
            <div className="hq-modal-body">
              <div className="form-grid hq-sku-edit-grid">
                <label className="hq-form-field">
                  <span>SKU ID（系统编号）</span>
                  <input value={editForm.sku_id} readOnly />
                </label>
                <label className="hq-form-field">
                  <span>SKU 名称（商品名）</span>
                  <input
                    value={editForm.sku_name}
                    onChange={(e) => setEditForm((s) => ({ ...s, sku_name: e.target.value }))}
                  />
                </label>
                <label className="hq-form-field">
                  <span>分类</span>
                  <select
                    value={editForm.category_id}
                    onChange={(e) => setEditForm((s) => ({ ...s, category_id: e.target.value }))}
                  >
                    <option value="">分类（可选）</option>
                    {categoryOptions.map((x) => (
                      <option key={x.value} value={x.value}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="hq-form-field">
                  <span>标准成本（元/件）</span>
                  <input
                    value={editForm.std_cost}
                    onChange={(e) => setEditForm((s) => ({ ...s, std_cost: e.target.value }))}
                  />
                </label>
                <label className="hq-form-field">
                  <span>建议售价（元/件）</span>
                  <input
                    value={editForm.sug_price}
                    onChange={(e) => setEditForm((s) => ({ ...s, sug_price: e.target.value }))}
                  />
                </label>
                <label className="check-line hq-sku-edit-check">
                  <input
                    type="checkbox"
                    checked={editForm.force}
                    onChange={(e) => setEditForm((s) => ({ ...s, force: e.target.checked }))}
                  />
                  强制覆盖
                </label>
              </div>
              <div className="hq-modal-actions">
                <button type="button" className="hq-sku-edit-submit" onClick={onUpdateSku}>
                  更新
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function UsersPage() {
  const [rows, setRows] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [storeId, setStoreId] = useState("");
  const [appliedStoreId, setAppliedStoreId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [appliedRoleId, setAppliedRoleId] = useState("");
  const [createForm, setCreateForm] = useState({
    store_id: "",
    role_id: "",
    user_name: "",
    account_name: "user001",
    password: "",
  });
  const [editForm, setEditForm] = useState({
    user_id: "",
    store_id: "",
    role_id: "",
    user_name: "",
  });
  const [activeUserModal, setActiveUserModal] = useState<"edit" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadUsers(targetPage = page) {
    const res = await fetchUsers({
      page: targetPage,
      limit,
      store_id: appliedStoreId ? Number(appliedStoreId) : undefined,
      role_id: appliedRoleId ? Number(appliedRoleId) : undefined,
    });
    setRows(res.data);
    setTotal(res.total);
  }

  useEffect(() => {
    void loadUsers();
  }, [page, limit, appliedStoreId, appliedRoleId]);

  useEffect(() => {
    fetchUsers({ page: 1, limit: 1000 })
      .then((res) => {
        const code = nextSequentialCode(
          res.data.map((user) => ({ code: user.account_name })),
          "user"
        );
        setCreateForm((s) => ({ ...s, account_name: code }));
      })
      .catch(() => undefined);
  }, [rows]);

  function onSearchUsers() {
    setAppliedStoreId(storeId);
    setAppliedRoleId(roleId);
    setPage(1);
  }

  function fillEditUser(row: User) {
    setEditForm({
      user_id: String(row.user_id),
      store_id: String(row.store_id),
      role_id: String(row.role_id),
      user_name: row.user_name,
    });
    setActiveUserModal("edit");
  }

  async function onCreateUser() {
    setMessage("");
    setError("");
    if (
      !confirmDetailed("即将创建用户", [
        ["账号", createForm.account_name],
        ["用户姓名", createForm.user_name],
        ["门店ID", createForm.store_id],
        ["角色ID", createForm.role_id],
      ])
    ) {
      return;
    }
    try {
      await createUser({
        store_id: Number(createForm.store_id),
        role_id: Number(createForm.role_id),
        user_name: createForm.user_name.trim(),
        account_name: createForm.account_name.trim(),
        password: createForm.password,
      });
      setMessage("用户创建成功");
      setCreateForm({
        store_id: "",
        role_id: "",
        user_name: "",
        account_name: "",
        password: "",
      });
      await loadUsers(1);
      setPage(1);
    } catch (err) {
      setError(parseError(err));
    }
  }

  async function onUpdateUser() {
    setMessage("");
    setError("");
    const user_id = Number(editForm.user_id);
    if (!user_id) {
      setError("请先输入或选择用户ID");
      return;
    }
    try {
      await updateUser(user_id, {
        store_id: toNumberOrUndefined(editForm.store_id),
        role_id: toNumberOrUndefined(editForm.role_id),
        user_name: editForm.user_name.trim() || undefined,
      });
      setActiveUserModal(null);
      setMessage("用户更新成功");
      await loadUsers();
    } catch (err) {
      setError(parseError(err));
    }
  }

  async function onDeactivateUser(row: User) {
    setMessage("");
    setError("");
    if (
      !confirmDetailed("即将软删除用户", [
        ["用户ID", row.user_id],
        ["账号", row.account_name],
        ["用户姓名", row.user_name],
        ["角色", row.role_name],
        ["门店ID", row.store_id],
      ])
    ) {
      return;
    }
    try {
      await deactivateUser(row.user_id);
      setMessage(`用户 ${row.user_id} 已软删除`);
      await loadUsers();
    } catch (err) {
      setError(parseError(err));
    }
  }

  return (
    <section>
      <h2>用户管理</h2>
      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div className="query-bar">
        <input
          placeholder="门店ID"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
        />
        <input
          placeholder="角色ID"
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
        />
        <button type="button" onClick={onSearchUsers}>
          搜索
        </button>
      </div>
      <div className="ops-grid">
        <div className="op-card">
          <h3>新增用户</h3>
          <div className="form-grid">
            <input
              placeholder="门店ID"
              value={createForm.store_id}
              onChange={(e) => setCreateForm((s) => ({ ...s, store_id: e.target.value }))}
            />
            <input
              placeholder="角色ID"
              value={createForm.role_id}
              onChange={(e) => setCreateForm((s) => ({ ...s, role_id: e.target.value }))}
            />
            <input
              placeholder="用户姓名"
              value={createForm.user_name}
              onChange={(e) => setCreateForm((s) => ({ ...s, user_name: e.target.value }))}
            />
            <input
              placeholder="账号（自动分配）"
              value={createForm.account_name}
              readOnly
            />
            <input
              placeholder="密码"
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm((s) => ({ ...s, password: e.target.value }))}
            />
            <button type="button" onClick={onCreateUser}>
              创建
            </button>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{USER_FIELD_LABELS.user_id}</th>
              <th>{USER_FIELD_LABELS.user_name}</th>
              <th>{USER_FIELD_LABELS.account_name}</th>
              <th>{USER_FIELD_LABELS.role_name}</th>
              <th>{USER_FIELD_LABELS.store_id}</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty">
                  暂无数据
                </td>
              </tr>
            ) : (
              rows.map((x) => (
                <tr key={x.user_id}>
                  <td>{x.user_id}</td>
                  <td>{x.user_name}</td>
                  <td>{x.account_name}</td>
                  <td>{x.role_name}</td>
                  <td>{x.store_id}</td>
                  <td>
                    <div className="row-action">
                      <button type="button" onClick={() => fillEditUser(x)}>
                        编辑
                      </button>
                      <button type="button" onClick={() => void onDeactivateUser(x)}>
                        软删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {activeUserModal === "edit" ? (
        <div className="hq-modal-overlay" role="dialog" aria-modal="true">
          <div className="hq-modal-dialog">
            <div className="hq-modal-header">
              <h3>编辑用户</h3>
              <button type="button" onClick={() => setActiveUserModal(null)} className="hq-modal-close">
                关闭
              </button>
            </div>
            <div className="hq-modal-body">
              <div className="form-grid">
                <label className="hq-form-field">
                  <span>用户ID（系统编号）</span>
                  <input value={editForm.user_id} readOnly />
                </label>
                <label className="hq-form-field">
                  <span>门店ID（可选）</span>
                  <input
                    value={editForm.store_id}
                    onChange={(e) => setEditForm((s) => ({ ...s, store_id: e.target.value }))}
                  />
                </label>
                <label className="hq-form-field">
                  <span>角色ID（可选）</span>
                  <input
                    value={editForm.role_id}
                    onChange={(e) => setEditForm((s) => ({ ...s, role_id: e.target.value }))}
                  />
                </label>
                <label className="hq-form-field">
                  <span>用户姓名（可选）</span>
                  <input
                    value={editForm.user_name}
                    onChange={(e) => setEditForm((s) => ({ ...s, user_name: e.target.value }))}
                  />
                </label>
              </div>
              <div className="hq-modal-actions">
                <button type="button" onClick={onUpdateUser}>
                  更新
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
  const [rows, setRows] = useState<TransferOrder[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [storeId, setStoreId] = useState("");
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
  const [createForm, setCreateForm] = useState({
    store_id: "",
    sku_id: "",
    actual_qty: "",
    transfer_direction: "H2S" as "H2S" | "S2H",
  });
  const [activeDetailOrder, setActiveDetailOrder] = useState<TransferOrder | null>(null);
  const [activeConfirmOrder, setActiveConfirmOrder] = useState<TransferOrder | null>(null);
  const [confirmForm, setConfirmForm] = useState({ detail_id: "", actual_qty: "" });
  const [forecastSales, setForecastSales] = useState<number | null>(null);
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [suggestedTransferQty, setSuggestedTransferQty] = useState<number | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [createOptionsLoading, setCreateOptionsLoading] = useState(false);
  const [createStoreOptions, setCreateStoreOptions] = useState<Store[]>([]);
  const [createSkuOptions, setCreateSkuOptions] = useState<SKU[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function isTransferTargetStore(store: Store) {
    const code = store.store_code.trim().toUpperCase();
    const name = store.store_name.trim();
    if (store.store_id === 0) {
      return false;
    }
    if (code === "HQ") {
      return false;
    }
    if (name.includes("总部")) {
      return false;
    }
    return store.store_status === "active";
  }

  async function loadTransfers(targetPage = page) {
    const res = await fetchTransfers({
      page: targetPage,
      limit,
      store_id: storeId ? Number(storeId) : undefined,
      status: status || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    });
    setRows(res.data);
    setTotal(res.total);
  }

  useEffect(() => {
    void loadTransfers();
  }, [page, limit, storeId, status, startDate, endDate]);

  useEffect(() => {
    let active = true;
    async function loadCreateOptions() {
      setCreateOptionsLoading(true);
      try {
        const storeLimit = 200;
        const firstStorePage = await fetchStores({ page: 1, limit: storeLimit, store_status: "active" });
        const allStores = [...firstStorePage.data];
        const totalStorePages =
          firstStorePage.limit > 0 ? Math.max(1, Math.ceil(firstStorePage.total / firstStorePage.limit)) : 1;
        if (totalStorePages > 1) {
          const restStorePages = await Promise.all(
            Array.from({ length: totalStorePages - 1 }, (_, idx) =>
              fetchStores({ page: idx + 2, limit: storeLimit, store_status: "active" })
            )
          );
          for (const pageData of restStorePages) {
            allStores.push(...pageData.data);
          }
        }

        const skusRes = await fetchSkus({ page: 1, limit: 100 });
        if (!active) {
          return;
        }
        const uniqueStoreMap = new Map<number, Store>();
        for (const store of allStores) {
          if (!uniqueStoreMap.has(store.store_id)) {
            uniqueStoreMap.set(store.store_id, store);
          }
        }
        setCreateStoreOptions(
          Array.from(uniqueStoreMap.values())
            .filter(isTransferTargetStore)
            .sort((a, b) => a.store_id - b.store_id)
        );
        setCreateSkuOptions(skusRes.data.filter((x) => x.sku_status === "sale"));
      } catch (err) {
        if (active) {
          setError(parseError(err));
        }
      } finally {
        if (active) {
          setCreateOptionsLoading(false);
        }
      }
    }
    void loadCreateOptions();
    return () => {
      active = false;
    };
  }, []);

  async function onCreateTransfer() {
    setMessage("");
    setError("");
    const store_id = Number(createForm.store_id);
    const sku_id = Number(createForm.sku_id);
    const actualRaw = createForm.actual_qty.trim();
    const actual_qty = Number(actualRaw);
    if (forecastSales == null || suggestedTransferQty == null || !Number.isInteger(suggestedTransferQty) || suggestedTransferQty < 0) {
      setError("请先点击预测，生成 AI 建议调拨量后再创建调拨单");
      return;
    }
    if (!Number.isInteger(store_id) || store_id <= 0 || !Number.isInteger(sku_id) || sku_id <= 0) {
      setError("请填写有效的门店ID和 SKU ID");
      return;
    }
    if (!actualRaw) {
      setError("请填写实际数量");
      return;
    }
    if (!Number.isInteger(actual_qty) || actual_qty < 0) {
      setError("实际数量必须是大于等于 0 的整数");
      return;
    }
    const storeLabel =
      createStoreOptions.find((store) => store.store_id === store_id)?.store_name ?? String(store_id);
    const sku = createSkuOptions.find((item) => item.sku_id === sku_id);
    if (
      !confirmDetailed("即将创建调拨单", [
        ["门店", `${store_id} - ${storeLabel}`],
        ["SKU", sku ? `${sku.sku_code} - ${sku.sku_name}` : sku_id],
        ["AI建议调拨量", suggestedTransferQty],
        ["实际调拨量", actual_qty],
        ["调拨方向", TRANSFER_DIRECTION_LABELS[createForm.transfer_direction]],
      ])
    ) {
      return;
    }
    try {
      await createTransfer({
        store_id,
        details: [
          {
            sku_id,
            suggested_qty: suggestedTransferQty,
            actual_qty,
            transfer_direction: createForm.transfer_direction,
          },
        ],
      });
      setMessage("调拨单创建成功");
      setCreateForm({
        store_id: "",
        sku_id: "",
        actual_qty: "",
        transfer_direction: "H2S",
      });
      setForecastSales(null);
      setCurrentStock(null);
      setSuggestedTransferQty(null);
      await loadTransfers(1);
      setPage(1);
    } catch (err) {
      setError(parseError(err));
    }
  }

  async function onFetchTransferForecast() {
    setMessage("");
    setError("");
    setForecastSales(null);
    setCurrentStock(null);
    setSuggestedTransferQty(null);

    const store_id = Number(createForm.store_id);
    const sku_id = Number(createForm.sku_id);
    if (!Number.isInteger(store_id) || store_id <= 0 || !Number.isInteger(sku_id) || sku_id <= 0) {
      setError("请先填写有效的门店ID和 SKU ID");
      return;
    }

    setForecastLoading(true);
    try {
      const forecast = await fetchTransferForecast(store_id, sku_id);
      if (!forecast) {
        setError("暂无可用预测数据");
        return;
      }
      const predictedSales = Number(forecast.predicted_sales);
      const stock = Number(forecast.current_stock);
      const suggestedQty = Number(forecast.suggested_qty);
      if (
        !Number.isInteger(predictedSales) ||
        predictedSales < 0 ||
        !Number.isInteger(stock) ||
        stock < 0 ||
        !Number.isInteger(suggestedQty) ||
        suggestedQty < 0
      ) {
        setError("预测接口返回数据不完整，请确认后端已返回 predicted_sales、current_stock 和 suggested_qty");
        return;
      }
      setForecastSales(predictedSales);
      setCurrentStock(stock);
      setSuggestedTransferQty(suggestedQty);
      setCreateForm((s) => ({
        ...s,
        actual_qty: s.actual_qty.trim() ? s.actual_qty : String(suggestedQty),
      }));
    } catch (err) {
      setError(parseError(err));
    } finally {
      setForecastLoading(false);
    }
  }

  async function onApproveTransfer(order_id: number) {
    setMessage("");
    setError("");
    try {
      await approveTransfer(order_id);
      setMessage(`调拨单 ${order_id} 已审核，等待下发`);
      await loadTransfers();
    } catch (err) {
      setError(parseError(err));
    }
  }

  async function onIssueTransfer(order_id: number) {
    setMessage("");
    setError("");
    try {
      await issueTransfer(order_id);
      setMessage(`调拨单 ${order_id} 已下发`);
      await loadTransfers();
    } catch (err) {
      setError(parseError(err));
    }
  }

  function openConfirmModal(order: TransferOrder) {
    const firstDetail = order.details[0];
    setActiveConfirmOrder(order);
    setConfirmForm({
      detail_id: firstDetail ? String(firstDetail.detail_id) : "",
      actual_qty: firstDetail ? String(firstDetail.actual_qty) : "",
    });
  }

  async function onConfirmTransfer(order_id: number) {
    setMessage("");
    setError("");
    try {
      await confirmTransfer(order_id, {
        details:
          toNumberOrUndefined(confirmForm.detail_id) !== undefined &&
          toNumberOrUndefined(confirmForm.actual_qty) !== undefined
            ? [
                {
                  detail_id: Number(confirmForm.detail_id),
                  actual_qty: Number(confirmForm.actual_qty),
                },
              ]
            : undefined,
      });
      setActiveConfirmOrder(null);
      try {
        await issueTransfer(order_id);
        setMessage(`调拨单 ${order_id} 已协商并重新下发`);
      } catch (issueErr) {
        setError(parseError(issueErr));
        setMessage(`调拨单 ${order_id} 已完成协商修改，待手动下发`);
      }
      await loadTransfers();
    } catch (err) {
      setError(parseError(err));
    }
  }

  function renderTransferActions(order: TransferOrder) {
    return (
      <div className="row-action">
        <button type="button" onClick={() => setActiveDetailOrder(order)}>
          详情
        </button>
        {order.status === "ai_generated" ? (
          <button type="button" onClick={() => void onApproveTransfer(order.order_id)}>
            审核
          </button>
        ) : null}
        {order.status === "pending_approval" ? (
          <button type="button" onClick={() => void onIssueTransfer(order.order_id)}>
            下发
          </button>
        ) : null}
        {order.status === "in_negotiation" ? (
          <button type="button" onClick={() => openConfirmModal(order)}>
            协商后下发
          </button>
        ) : null}
        {order.status === "confirmed_executed" || order.status === "cancelled" ? <span>无需操作</span> : null}
        {order.status === "issued_pending_confirmation" ? <span>等待门店确认</span> : null}
      </div>
    );
  }

  return (
    <section>
      <h2>调拨审核</h2>
      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div className="query-bar">
        <input
          placeholder="筛选门店ID（可选）"
          value={storeId}
          onChange={(e) => {
            setPage(1);
            setStoreId(e.target.value);
          }}
        />
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
        <label className="transfer-date-filter">
          <span>创建开始日期</span>
          <input
            type="date"
            aria-label="按创建日期筛选-开始日期"
            title="按创建日期筛选-开始日期"
            value={startDate}
            onChange={(e) => {
              setPage(1);
              setStartDate(e.target.value);
            }}
          />
        </label>
        <label className="transfer-date-filter">
          <span>创建结束日期</span>
          <input
            type="date"
            aria-label="按创建日期筛选-结束日期"
            title="按创建日期筛选-结束日期"
            value={endDate}
            onChange={(e) => {
              setPage(1);
              setEndDate(e.target.value);
            }}
          />
        </label>
      </div>
      <div className="ops-grid">
        <div className="op-card">
          <h3>新建调拨</h3>
          <div className="form-grid">
            <select
              value={createForm.store_id}
              onChange={(e) => {
                setForecastSales(null);
                setCurrentStock(null);
                setSuggestedTransferQty(null);
                setCreateForm((s) => ({ ...s, store_id: e.target.value, actual_qty: "" }));
              }}
            >
              <option value="">{createOptionsLoading ? "加载门店中..." : "选择门店"}</option>
              {createStoreOptions.map((x) => (
                <option key={x.store_id} value={String(x.store_id)}>
                  {x.store_id} - {x.store_name}
                </option>
              ))}
            </select>
            <select
              value={createForm.sku_id}
              onChange={(e) => {
                setForecastSales(null);
                setCurrentStock(null);
                setSuggestedTransferQty(null);
                setCreateForm((s) => ({ ...s, sku_id: e.target.value, actual_qty: "" }));
              }}
            >
              <option value="">{createOptionsLoading ? "加载SKU中..." : "选择SKU"}</option>
              {createSkuOptions.map((x) => (
                <option key={x.sku_id} value={String(x.sku_id)}>
                  {x.sku_id} - {x.sku_name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={forecastLoading || !createForm.store_id || !createForm.sku_id}
              onClick={() => void onFetchTransferForecast()}
            >
              {forecastLoading ? "预测中" : "预测"}
            </button>
            {forecastSales !== null ? (
              <p className="hint transfer-forecast-value">
                预测销售额：{forecastSales}；当前库存：{currentStock ?? 0}；AI建议调拨量：
                {suggestedTransferQty ?? 0}
              </p>
            ) : null}
            <input
              placeholder="实际数量"
              value={createForm.actual_qty}
              onChange={(e) => setCreateForm((s) => ({ ...s, actual_qty: e.target.value }))}
            />
            <select
              value={createForm.transfer_direction}
              onChange={(e) =>
                setCreateForm((s) => ({
                  ...s,
                  transfer_direction: e.target.value as "H2S" | "S2H",
                }))
              }
            >
              <option value="H2S">{TRANSFER_DIRECTION_LABELS.H2S}</option>
              <option value="S2H">{TRANSFER_DIRECTION_LABELS.S2H}</option>
            </select>
            <button
              type="button"
              disabled={!createForm.store_id || !createForm.sku_id || suggestedTransferQty === null || !createForm.actual_qty.trim()}
              onClick={onCreateTransfer}
            >
              创建
            </button>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{TRANSFER_FIELD_LABELS.order_id}</th>
              <th>{TRANSFER_FIELD_LABELS.store_name}</th>
              <th>{TRANSFER_FIELD_LABELS.status}</th>
              <th>创建日期</th>
              <th>更新日期</th>
              <th>{TRANSFER_FIELD_LABELS.detail_count}</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty">
                  暂无数据
                </td>
              </tr>
            ) : (
              rows.map((x) => (
                <tr key={x.order_id}>
                  <td>{x.order_id}</td>
                  <td>{x.store_name}</td>
                  <td>{TRANSFER_STATUS_LABELS[x.status]}</td>
                  <td>{formatBeijingDateTime(x.created_at)}</td>
                  <td>{formatBeijingDateTime(x.updated_at)}</td>
                  <td>{x.details.length}</td>
                  <td>
                    {renderTransferActions(x)}
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

      {activeDetailOrder ? (
        <div className="hq-modal-overlay" role="dialog" aria-modal="true">
          <div className="hq-modal-dialog">
            <div className="hq-modal-header">
              <h3>调拨单详情</h3>
              <button type="button" onClick={() => setActiveDetailOrder(null)} className="hq-modal-close">
                关闭
              </button>
            </div>
            <div className="hq-modal-body">
              <p className="hint">调拨单号：{activeDetailOrder.order_id}</p>
              <p className="hint">门店：{activeDetailOrder.store_name}</p>
              <p className="hint">状态：{TRANSFER_STATUS_LABELS[activeDetailOrder.status]}</p>
              <p className="hint">门店异议：{activeDetailOrder.feedback ?? "-"}</p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>明细ID</th>
                      <th>商品</th>
                      <th>预测建议调拨量</th>
                      <th>实际调拨量</th>
                      <th>方向</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeDetailOrder.details.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="empty">
                          暂无明细
                        </td>
                      </tr>
                    ) : (
                      activeDetailOrder.details.map((detail) => (
                        <tr key={detail.detail_id}>
                          <td>{detail.detail_id}</td>
                          <td>{detail.sku_name}</td>
                          <td>{detail.suggested_qty}</td>
                          <td>{detail.actual_qty}</td>
                          <td>{TRANSFER_DIRECTION_LABELS[detail.transfer_direction]}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeConfirmOrder ? (
        <div className="hq-modal-overlay" role="dialog" aria-modal="true">
          <div className="hq-modal-dialog">
            <div className="hq-modal-header">
              <h3>重新修改调拨数量</h3>
              <button type="button" onClick={() => setActiveConfirmOrder(null)} className="hq-modal-close">
                关闭
              </button>
            </div>
            <div className="hq-modal-body">
              <p className="hint">调拨单号：{activeConfirmOrder.order_id}</p>
              <p className="hint">协商反馈：{activeConfirmOrder.feedback ?? "-"}</p>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>明细ID</th>
                      <th>SKU名称</th>
                      <th>建议数量</th>
                      <th>实际数量</th>
                      <th>调拨方向</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeConfirmOrder.details.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="empty">
                          暂无明细
                        </td>
                      </tr>
                    ) : (
                      activeConfirmOrder.details.map((detail) => (
                        <tr key={detail.detail_id}>
                          <td>{detail.detail_id}</td>
                          <td>{detail.sku_name}</td>
                          <td>{detail.suggested_qty}</td>
                          <td>{detail.actual_qty}</td>
                          <td>{TRANSFER_DIRECTION_LABELS[detail.transfer_direction]}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="form-grid" style={{ marginTop: 12 }}>
                <label className="hq-form-field">
                  <span>调拨单号（系统只读）</span>
                  <input value={String(activeConfirmOrder.order_id)} readOnly />
                </label>
                <label className="hq-form-field">
                  <span>明细ID（可选，指定要修改哪一行明细）</span>
                  <input
                    placeholder="例如 501"
                    value={confirmForm.detail_id}
                    onChange={(e) => setConfirmForm((s) => ({ ...s, detail_id: e.target.value }))}
                  />
                </label>
                <label className="hq-form-field">
                  <span>实际数量（可选，协商后的数量）</span>
                  <input
                    placeholder="例如 30"
                    value={confirmForm.actual_qty}
                    onChange={(e) => setConfirmForm((s) => ({ ...s, actual_qty: e.target.value }))}
                  />
                </label>
              </div>

              <div className="hq-modal-actions">
                <button type="button" onClick={() => void onConfirmTransfer(activeConfirmOrder.order_id)}>
                  协商后下发
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
