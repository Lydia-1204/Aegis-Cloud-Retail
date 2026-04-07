import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type {
  InventoryItem,
  SalesDaily,
  StoreDashboard,
  TrafficLog,
  TransferOrder,
} from "@aegis/shared";
import {
  fetchInventory,
  fetchSalesDaily,
  fetchStoreDashboard,
  fetchTrafficLogs,
  fetchTransfers,
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

export function DashboardPage() {
  const { me } = useAuth();
  const [dashboard, setDashboard] = useState<StoreDashboard | null>(null);

  useEffect(() => {
    fetchStoreDashboard(me?.store_id ?? 1).then(setDashboard);
  }, [me]);

  if (!dashboard) {
    return <p className="empty">加载中...</p>;
  }

  return (
    <section>
      <h2>{dashboard.store_name} 实时快照</h2>
      <div className="cards-grid">
        <article className="card">
          <h3>客流总计</h3>
          <p>{dashboard.traffic_summary.total_in_count}</p>
        </article>
        <article className="card">
          <h3>当前在店</h3>
          <p>{dashboard.traffic_summary.current_in_store}</p>
        </article>
        <article className="card">
          <h3>订单量</h3>
          <p>{dashboard.sales_summary.total_orders}</p>
        </article>
        <article className="card">
          <h3>转化率</h3>
          <p>{(dashboard.sales_summary.conversion_rate * 100).toFixed(2)}%</p>
        </article>
      </div>
    </section>
  );
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

  useEffect(() => {
    fetchSalesDaily({
      page,
      limit,
      store_id: me?.store_id ?? 1,
      sales_date: salesDate || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    }).then((res) => {
      setRows(res.data);
      setTotal(res.total);
    });
  }, [page, limit, salesDate, startDate, endDate, me]);

  return (
    <section>
      <h2>销售流水</h2>
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

  useEffect(() => {
    fetchInventory({
      page,
      limit,
      store_id: me?.store_id ?? 1,
      keyword: keyword || undefined,
      category_id: categoryId ? Number(categoryId) : undefined,
      low_stock: lowStock,
    }).then((res) => {
      setRows(res.data);
      setTotal(res.total);
    });
  }, [page, limit, keyword, categoryId, lowStock, me]);

  return (
    <section>
      <h2>库存盘点</h2>
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

  useEffect(() => {
    fetchTransfers({
      page,
      limit,
      store_id: me?.store_id ?? 1,
      status: status || undefined,
    }).then((res) => {
      setRows(res.data);
      setTotal(res.total);
    });
  }, [page, limit, status, me]);

  return (
    <section>
      <h2>调拨确认</h2>
      <div className="query-bar">
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

export function TrafficPage() {
  const { me } = useAuth();
  const [rows, setRows] = useState<TrafficLog[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [total, setTotal] = useState(0);
  const [date, setDate] = useState("");

  useEffect(() => {
    fetchTrafficLogs({
      page,
      limit,
      store_id: me?.store_id ?? 1,
      date: date || undefined,
    }).then((res) => {
      setRows(res.data);
      setTotal(res.total);
    });
  }, [page, limit, date, me]);

  return (
    <section>
      <h2>客流日志</h2>
      <div className="query-bar">
        <input
          placeholder="date: YYYY-MM-DD"
          value={date}
          onChange={(e) => {
            setPage(1);
            setDate(e.target.value);
          }}
        />
      </div>
      {renderTable(
        rows.map((x) => ({
          customer_log_id: x.customer_log_id,
          record_timestamp: x.record_timestamp,
          in_count: x.in_count,
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
