import { useEffect, useMemo, useState } from "react";
import type { SKU, SKUCategory, Store, TransferOrder, User } from "@aegis/shared";
import {
  cancelTransfer,
  confirmTransfer,
  createTransfer,
  createSku,
  createStore,
  createUser,
  deactivateSku,
  deactivateStore,
  fetchSkuById,
  fetchSkuCategories,
  fetchSkus,
  fetchStoreById,
  fetchStores,
  fetchTransfers,
  issueTransfer,
  fetchUsers,
  updateSku,
  updateStore,
  updateUser,
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

export function StoresPage() {
  const [rows, setRows] = useState<Store[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<"" | "active" | "inactive">("");
  const [detailStore, setDetailStore] = useState<Store | null>(null);
  const [createForm, setCreateForm] = useState({
    store_code: "",
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
      keyword: keyword || undefined,
      store_status: status || undefined,
    });
    setRows(res.data);
    setTotal(res.total);
  }

  useEffect(() => {
    void loadStores();
  }, [page, limit, keyword, status]);

  async function onCreateStore() {
    setMessage("");
    setError("");
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

    try {
      const updated = await updateStore(store_id, payload);
      setDetailStore(updated);
      setMessage("门店更新成功");
      await loadStores();
    } catch (err) {
      setError(parseError(err));
    }
  }

  async function onDeactivateStore(store_id: number) {
    setMessage("");
    setError("");
    try {
      await deactivateStore(store_id);
      setMessage(`门店 ${store_id} 已停用`);
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
          onChange={(e) => {
            setPage(1);
            setKeyword(e.target.value);
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as "" | "active" | "inactive");
          }}
        >
          <option value="">全部状态</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
      </div>
      <div className="ops-grid">
        <div className="op-card">
          <h3>新增门店（POST /stores）</h3>
          <div className="form-grid">
            <input
              placeholder="store_code"
              value={createForm.store_code}
              onChange={(e) => setCreateForm((s) => ({ ...s, store_code: e.target.value }))}
            />
            <input
              placeholder="store_name"
              value={createForm.store_name}
              onChange={(e) => setCreateForm((s) => ({ ...s, store_name: e.target.value }))}
            />
            <input
              placeholder="store_location"
              value={createForm.store_location}
              onChange={(e) => setCreateForm((s) => ({ ...s, store_location: e.target.value }))}
            />
            <input
              placeholder="store_area"
              value={createForm.store_area}
              onChange={(e) => setCreateForm((s) => ({ ...s, store_area: e.target.value }))}
            />
            <select
              value={createForm.store_status}
              onChange={(e) =>
                setCreateForm((s) => ({ ...s, store_status: e.target.value as "active" | "inactive" }))
              }
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
            <button type="button" onClick={onCreateStore}>
              创建
            </button>
          </div>
        </div>
        <div className="op-card">
          <h3>编辑门店（PUT /stores/:store_id）</h3>
          <div className="form-grid">
            <input
              placeholder="store_id"
              value={editForm.store_id}
              onChange={(e) => setEditForm((s) => ({ ...s, store_id: e.target.value }))}
            />
            <input
              placeholder="store_name?"
              value={editForm.store_name}
              onChange={(e) => setEditForm((s) => ({ ...s, store_name: e.target.value }))}
            />
            <input
              placeholder="store_location?"
              value={editForm.store_location}
              onChange={(e) => setEditForm((s) => ({ ...s, store_location: e.target.value }))}
            />
            <input
              placeholder="store_area?"
              value={editForm.store_area}
              onChange={(e) => setEditForm((s) => ({ ...s, store_area: e.target.value }))}
            />
            <select
              value={editForm.store_status}
              onChange={(e) =>
                setEditForm((s) => ({ ...s, store_status: e.target.value as "" | "active" | "inactive" }))
              }
            >
              <option value="">store_status(可选)</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
            <button type="button" onClick={onUpdateStore}>
              更新
            </button>
          </div>
        </div>
      </div>
      {detailStore ? (
        <div className="detail-box">
          <strong>门店详情（GET /stores/:store_id）</strong>
          <pre>{JSON.stringify(detailStore, null, 2)}</pre>
        </div>
      ) : null}
      {renderTable(
        rows.map((x) => ({
          store_id: x.store_id,
          store_code: x.store_code,
          store_name: x.store_name,
          store_status: x.store_status,
          store_area: x.store_area,
        }))
      )}
      <div className="table-actions">
        {rows.map((x) => (
          <div key={x.store_id} className="row-action">
            <span>store_id={x.store_id}</span>
            <button type="button" onClick={() => void onFetchStoreDetail(x.store_id)}>
              详情
            </button>
            <button type="button" onClick={() => fillEditForm(x)}>
              填充编辑
            </button>
            <button type="button" onClick={() => void onDeactivateStore(x.store_id)}>
              停用
            </button>
          </div>
        ))}
      </div>
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
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<SKUCategory[]>([]);
  const [detailSku, setDetailSku] = useState<SKU | null>(null);
  const [createForm, setCreateForm] = useState({
    sku_code: "",
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
      keyword: keyword || undefined,
      category_id: categoryId ? Number(categoryId) : undefined,
    });
    setRows(res.data);
    setTotal(res.total);
  }

  useEffect(() => {
    void loadSkus();
  }, [page, limit, keyword, categoryId]);

  useEffect(() => {
    fetchSkuCategories()
      .then((res) => setCategories(res))
      .catch(() => setCategories([]));
  }, []);

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
  }

  async function onFetchSkuDetail(sku_id: number) {
    setMessage("");
    setError("");
    try {
      const detail = await fetchSkuById(sku_id);
      setDetailSku(detail);
      setMessage(`已加载 SKU ${sku_id} 详情`);
    } catch (err) {
      setError(parseError(err));
    }
  }

  async function onCreateSku() {
    setMessage("");
    setError("");
    try {
      const created = await createSku({
        sku_code: createForm.sku_code.trim(),
        sku_name: createForm.sku_name.trim(),
        category_id: Number(createForm.category_id),
        std_cost: Number(createForm.std_cost),
        sug_price: Number(createForm.sug_price),
        force: createForm.force,
        sku_status: "sale",
      });
      setDetailSku(created);
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
      setError("请先输入或选择 sku_id");
      return;
    }
    try {
      const updated = await updateSku(sku_id, {
        sku_name: editForm.sku_name.trim() || undefined,
        category_id: toNumberOrUndefined(editForm.category_id),
        std_cost: toNumberOrUndefined(editForm.std_cost),
        sug_price: toNumberOrUndefined(editForm.sug_price),
        force: editForm.force,
      });
      setDetailSku(updated);
      setMessage("SKU 更新成功");
      await loadSkus();
    } catch (err) {
      setError(parseError(err));
    }
  }

  async function onDeactivateSku(sku_id: number) {
    setMessage("");
    setError("");
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
          {categoryOptions.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
      </div>
      <div className="ops-grid">
        <div className="op-card">
          <h3>新增 SKU（POST /skus）</h3>
          <div className="form-grid">
            <input
              placeholder="sku_code"
              value={createForm.sku_code}
              onChange={(e) => setCreateForm((s) => ({ ...s, sku_code: e.target.value }))}
            />
            <input
              placeholder="sku_name"
              value={createForm.sku_name}
              onChange={(e) => setCreateForm((s) => ({ ...s, sku_name: e.target.value }))}
            />
            <select
              value={createForm.category_id}
              onChange={(e) => setCreateForm((s) => ({ ...s, category_id: e.target.value }))}
            >
              <option value="">category_id</option>
              {categoryOptions.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <input
              placeholder="std_cost"
              value={createForm.std_cost}
              onChange={(e) => setCreateForm((s) => ({ ...s, std_cost: e.target.value }))}
            />
            <input
              placeholder="sug_price"
              value={createForm.sug_price}
              onChange={(e) => setCreateForm((s) => ({ ...s, sug_price: e.target.value }))}
            />
            <label className="check-line">
              <input
                type="checkbox"
                checked={createForm.force}
                onChange={(e) => setCreateForm((s) => ({ ...s, force: e.target.checked }))}
              />
              force
            </label>
            <button type="button" onClick={onCreateSku}>
              创建
            </button>
          </div>
        </div>
        <div className="op-card">
          <h3>编辑 SKU（PUT /skus/:sku_id）</h3>
          <div className="form-grid">
            <input
              placeholder="sku_id"
              value={editForm.sku_id}
              onChange={(e) => setEditForm((s) => ({ ...s, sku_id: e.target.value }))}
            />
            <input
              placeholder="sku_name?"
              value={editForm.sku_name}
              onChange={(e) => setEditForm((s) => ({ ...s, sku_name: e.target.value }))}
            />
            <select
              value={editForm.category_id}
              onChange={(e) => setEditForm((s) => ({ ...s, category_id: e.target.value }))}
            >
              <option value="">category_id(可选)</option>
              {categoryOptions.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <input
              placeholder="std_cost?"
              value={editForm.std_cost}
              onChange={(e) => setEditForm((s) => ({ ...s, std_cost: e.target.value }))}
            />
            <input
              placeholder="sug_price?"
              value={editForm.sug_price}
              onChange={(e) => setEditForm((s) => ({ ...s, sug_price: e.target.value }))}
            />
            <label className="check-line">
              <input
                type="checkbox"
                checked={editForm.force}
                onChange={(e) => setEditForm((s) => ({ ...s, force: e.target.checked }))}
              />
              force
            </label>
            <button type="button" onClick={onUpdateSku}>
              更新
            </button>
          </div>
        </div>
      </div>
      {detailSku ? (
        <div className="detail-box">
          <strong>SKU 详情（GET /skus/:sku_id）</strong>
          <pre>{JSON.stringify(detailSku, null, 2)}</pre>
        </div>
      ) : null}
      {renderTable(
        rows.map((x) => ({
          sku_id: x.sku_id,
          sku_code: x.sku_code,
          sku_name: x.sku_name,
          category_name: x.category_name,
          std_cost: x.std_cost,
          sug_price: x.sug_price,
          sku_status: x.sku_status,
        }))
      )}
      <div className="table-actions">
        {rows.map((x) => (
          <div key={x.sku_id} className="row-action">
            <span>sku_id={x.sku_id}</span>
            <button type="button" onClick={() => void onFetchSkuDetail(x.sku_id)}>
              详情
            </button>
            <button type="button" onClick={() => fillEditSku(x)}>
              填充编辑
            </button>
            <button type="button" onClick={() => void onDeactivateSku(x.sku_id)}>
              停用
            </button>
          </div>
        ))}
      </div>
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

export function UsersPage() {
  const [rows, setRows] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [storeId, setStoreId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [createForm, setCreateForm] = useState({
    store_id: "",
    role_id: "",
    user_name: "",
    account_name: "",
    password: "",
  });
  const [editForm, setEditForm] = useState({
    user_id: "",
    store_id: "",
    role_id: "",
    user_name: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadUsers(targetPage = page) {
    const res = await fetchUsers({
      page: targetPage,
      limit,
      store_id: storeId ? Number(storeId) : undefined,
      role_id: roleId ? Number(roleId) : undefined,
    });
    setRows(res.data);
    setTotal(res.total);
  }

  useEffect(() => {
    void loadUsers();
  }, [page, limit, storeId, roleId]);

  function fillEditUser(row: User) {
    setEditForm({
      user_id: String(row.user_id),
      store_id: String(row.store_id),
      role_id: String(row.role_id),
      user_name: row.user_name,
    });
  }

  async function onCreateUser() {
    setMessage("");
    setError("");
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
      setError("请先输入或选择 user_id");
      return;
    }
    try {
      await updateUser(user_id, {
        store_id: toNumberOrUndefined(editForm.store_id),
        role_id: toNumberOrUndefined(editForm.role_id),
        user_name: editForm.user_name.trim() || undefined,
      });
      setMessage("用户更新成功");
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
          onChange={(e) => {
            setPage(1);
            setStoreId(e.target.value);
          }}
        />
        <input
          placeholder="角色ID"
          value={roleId}
          onChange={(e) => {
            setPage(1);
            setRoleId(e.target.value);
          }}
        />
      </div>
      <div className="ops-grid">
        <div className="op-card">
          <h3>新增用户（POST /users）</h3>
          <div className="form-grid">
            <input
              placeholder="store_id"
              value={createForm.store_id}
              onChange={(e) => setCreateForm((s) => ({ ...s, store_id: e.target.value }))}
            />
            <input
              placeholder="role_id"
              value={createForm.role_id}
              onChange={(e) => setCreateForm((s) => ({ ...s, role_id: e.target.value }))}
            />
            <input
              placeholder="user_name"
              value={createForm.user_name}
              onChange={(e) => setCreateForm((s) => ({ ...s, user_name: e.target.value }))}
            />
            <input
              placeholder="account_name"
              value={createForm.account_name}
              onChange={(e) => setCreateForm((s) => ({ ...s, account_name: e.target.value }))}
            />
            <input
              placeholder="password"
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm((s) => ({ ...s, password: e.target.value }))}
            />
            <button type="button" onClick={onCreateUser}>
              创建
            </button>
          </div>
        </div>
        <div className="op-card">
          <h3>编辑用户（PUT /users/:user_id）</h3>
          <div className="form-grid">
            <input
              placeholder="user_id"
              value={editForm.user_id}
              onChange={(e) => setEditForm((s) => ({ ...s, user_id: e.target.value }))}
            />
            <input
              placeholder="store_id?"
              value={editForm.store_id}
              onChange={(e) => setEditForm((s) => ({ ...s, store_id: e.target.value }))}
            />
            <input
              placeholder="role_id?"
              value={editForm.role_id}
              onChange={(e) => setEditForm((s) => ({ ...s, role_id: e.target.value }))}
            />
            <input
              placeholder="user_name?"
              value={editForm.user_name}
              onChange={(e) => setEditForm((s) => ({ ...s, user_name: e.target.value }))}
            />
            <button type="button" onClick={onUpdateUser}>
              更新
            </button>
          </div>
        </div>
      </div>
      {renderTable(
        rows.map((x) => ({
          user_id: x.user_id,
          user_name: x.user_name,
          account_name: x.account_name,
          role_name: x.role_name,
          store_id: x.store_id,
        }))
      )}
      <div className="table-actions">
        {rows.map((x) => (
          <div key={x.user_id} className="row-action">
            <span>user_id={x.user_id}</span>
            <button type="button" onClick={() => fillEditUser(x)}>
              填充编辑
            </button>
          </div>
        ))}
      </div>
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
    suggested_qty: "",
    actual_qty: "",
    transfer_direction: "H2S" as "H2S" | "S2H",
  });
  const [confirmForm, setConfirmForm] = useState({ order_id: "", detail_id: "", actual_qty: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  async function onCreateTransfer() {
    setMessage("");
    setError("");
    try {
      await createTransfer({
        store_id: Number(createForm.store_id),
        details: [
          {
            sku_id: Number(createForm.sku_id),
            suggested_qty: Number(createForm.suggested_qty),
            actual_qty: Number(createForm.actual_qty),
            transfer_direction: createForm.transfer_direction,
          },
        ],
      });
      setMessage("调拨单创建成功");
      await loadTransfers(1);
      setPage(1);
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

  async function onConfirmTransfer() {
    const order_id = Number(confirmForm.order_id);
    if (!order_id) {
      setError("请输入 order_id");
      return;
    }
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
      setMessage(`调拨单 ${order_id} 已重下发`);
      await loadTransfers();
    } catch (err) {
      setError(parseError(err));
    }
  }

  async function onCancelTransfer(order_id: number) {
    setMessage("");
    setError("");
    try {
      await cancelTransfer(order_id);
      setMessage(`调拨单 ${order_id} 已作废`);
      await loadTransfers();
    } catch (err) {
      setError(parseError(err));
    }
  }

  return (
    <section>
      <h2>调拨审核</h2>
      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div className="query-bar">
        <input
          placeholder="门店ID"
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
              {item}
            </option>
          ))}
        </select>
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
          <h3>新建调拨（POST /transfers）</h3>
          <div className="form-grid">
            <input
              placeholder="store_id"
              value={createForm.store_id}
              onChange={(e) => setCreateForm((s) => ({ ...s, store_id: e.target.value }))}
            />
            <input
              placeholder="sku_id"
              value={createForm.sku_id}
              onChange={(e) => setCreateForm((s) => ({ ...s, sku_id: e.target.value }))}
            />
            <input
              placeholder="suggested_qty"
              value={createForm.suggested_qty}
              onChange={(e) => setCreateForm((s) => ({ ...s, suggested_qty: e.target.value }))}
            />
            <input
              placeholder="actual_qty"
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
              <option value="H2S">H2S</option>
              <option value="S2H">S2H</option>
            </select>
            <button type="button" onClick={onCreateTransfer}>
              创建
            </button>
          </div>
        </div>
        <div className="op-card">
          <h3>协商确认（PATCH /transfers/:order_id/confirm）</h3>
          <div className="form-grid">
            <input
              placeholder="order_id"
              value={confirmForm.order_id}
              onChange={(e) => setConfirmForm((s) => ({ ...s, order_id: e.target.value }))}
            />
            <input
              placeholder="detail_id(可选)"
              value={confirmForm.detail_id}
              onChange={(e) => setConfirmForm((s) => ({ ...s, detail_id: e.target.value }))}
            />
            <input
              placeholder="actual_qty(可选)"
              value={confirmForm.actual_qty}
              onChange={(e) => setConfirmForm((s) => ({ ...s, actual_qty: e.target.value }))}
            />
            <button type="button" onClick={onConfirmTransfer}>
              协商后重下发
            </button>
          </div>
        </div>
      </div>
      {renderTable(
        rows.map((x) => ({
          order_id: x.order_id,
          store_name: x.store_name,
          status: x.status,
          feedback: x.feedback ?? "-",
          detail_count: x.details.length,
        }))
      )}
      <div className="table-actions">
        {rows.map((x) => (
          <div key={x.order_id} className="row-action">
            <span>order_id={x.order_id}</span>
            <button type="button" onClick={() => void onIssueTransfer(x.order_id)}>
              下发
            </button>
            <button type="button" onClick={() => void onCancelTransfer(x.order_id)}>
              作废
            </button>
          </div>
        ))}
      </div>
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
