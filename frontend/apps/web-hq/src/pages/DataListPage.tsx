import { useEffect, useState } from "react";
import type { SKU, Store, TransferOrder, User } from "@aegis/shared";
import { fetchSkus, fetchStores, fetchTransfers, fetchUsers } from "../services/api";

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

export function StoresPage() {
  const [rows, setRows] = useState<Store[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<"" | "active" | "inactive">("");

  useEffect(() => {
    fetchStores({
      page,
      limit,
      keyword: keyword || undefined,
      store_status: status || undefined,
    }).then((res) => {
      setRows(res.data);
      setTotal(res.total);
    });
  }, [page, limit, keyword, status]);

  return (
    <section>
      <h2>门店管理</h2>
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
      {renderTable(
        rows.map((x) => ({
          store_id: x.store_id,
          store_code: x.store_code,
          store_name: x.store_name,
          store_status: x.store_status,
          store_area: x.store_area,
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

export function SkusPage() {
  const [rows, setRows] = useState<SKU[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    fetchSkus({
      page,
      limit,
      keyword: keyword || undefined,
      category_id: categoryId ? Number(categoryId) : undefined,
    }).then((res) => {
      setRows(res.data);
      setTotal(res.total);
    });
  }, [page, limit, keyword, categoryId]);

  return (
    <section>
      <h2>SKU 目录</h2>
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
      </div>
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

  useEffect(() => {
    fetchUsers({
      page,
      limit,
      store_id: storeId ? Number(storeId) : undefined,
      role_id: roleId ? Number(roleId) : undefined,
    }).then((res) => {
      setRows(res.data);
      setTotal(res.total);
    });
  }, [page, limit, storeId, roleId]);

  return (
    <section>
      <h2>用户管理</h2>
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
      {renderTable(
        rows.map((x) => ({
          user_id: x.user_id,
          user_name: x.user_name,
          account_name: x.account_name,
          role_name: x.role_name,
          store_id: x.store_id,
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
  const [rows, setRows] = useState<TransferOrder[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [storeId, setStoreId] = useState("");
  const [status, setStatus] = useState<"" | TransferOrder["status"]>("");

  useEffect(() => {
    fetchTransfers({
      page,
      limit,
      store_id: storeId ? Number(storeId) : undefined,
      status: status || undefined,
    }).then((res) => {
      setRows(res.data);
      setTotal(res.total);
    });
  }, [page, limit, storeId, status]);

  return (
    <section>
      <h2>调拨审核</h2>
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
          placeholder="状态"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as "" | TransferOrder["status"]);
          }}
        />
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
