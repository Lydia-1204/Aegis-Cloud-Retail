import { useEffect, useMemo, useState } from "react";
import type { InventoryItem, SKUCategory, SalesDaily, SalesDailyDetail, Store } from "@aegis/shared";
import {
  fetchInventory,
  fetchSalesDaily,
  fetchSalesDailyDetail,
  fetchSkuCategories,
  fetchStores,
} from "../services/api";

type SalesRowWithStore = SalesDaily & { store_name: string };
type InventoryRowWithStore = InventoryItem & { store_name: string; store_code: string };

function isBusinessStore(store: Store): boolean {
  return store.store_id > 0;
}

function isBusinessStoreId(store_id: number): boolean {
  return store_id > 0;
}

function parseError(err: unknown): string {
  return err instanceof Error ? err.message : "请求失败";
}

function formatMoney(value: number): string {
  return value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function fetchAllSalesByStore(
  store_id: number,
  filters: { start_date?: string; end_date?: string }
): Promise<SalesDaily[]> {
  const limit = 100;
  let page = 1;
  let allRows: SalesDaily[] = [];

  while (true) {
    const res = await fetchSalesDaily({
      store_id,
      start_date: filters.start_date,
      end_date: filters.end_date,
      page,
      limit,
    });
    allRows = allRows.concat(res.data);
    if (allRows.length >= res.total || res.data.length === 0) {
      break;
    }
    page += 1;
  }

  return allRows;
}

async function fetchAllInventoryByStore(
  store_id: number,
  filters: { keyword?: string; category_id?: number; low_stock?: boolean }
): Promise<InventoryItem[]> {
  const limit = 100;
  let page = 1;
  let allRows: InventoryItem[] = [];

  while (true) {
    const res = await fetchInventory({
      store_id,
      keyword: filters.keyword,
      category_id: filters.category_id,
      low_stock: filters.low_stock,
      page,
      limit,
    });
    allRows = allRows.concat(res.data);
    if (allRows.length >= res.total || res.data.length === 0) {
      break;
    }
    page += 1;
  }

  return allRows;
}

export function GlobalAnalyticsPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<SKUCategory[]>([]);
  const [baseError, setBaseError] = useState("");

  const [salesStoreId, setSalesStoreId] = useState("");
  const [salesStartDate, setSalesStartDate] = useState("");
  const [salesEndDate, setSalesEndDate] = useState("");
  const [salesRows, setSalesRows] = useState<SalesRowWithStore[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState("");
  const [salesPage, setSalesPage] = useState(1);
  const [salesLimit] = useState(10);
  const [activeSalesDetail, setActiveSalesDetail] = useState<SalesDailyDetail | null>(null);

  const [inventoryStoreId, setInventoryStoreId] = useState("");
  const [inventoryKeyword, setInventoryKeyword] = useState("");
  const [inventoryCategoryId, setInventoryCategoryId] = useState("");
  const [inventoryLowStock, setInventoryLowStock] = useState(false);
  const [inventoryRows, setInventoryRows] = useState<InventoryRowWithStore[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryLimit] = useState(10);
  const [hasAutoQueried, setHasAutoQueried] = useState(false);

  useEffect(() => {
    void (async () => {
      setBaseError("");
      try {
        const [storeRes, categoryRes] = await Promise.all([
          fetchStores({ page: 1, limit: 200 }),
          fetchSkuCategories(),
        ]);
        setStores(storeRes.data.filter(isBusinessStore));
        setCategories(categoryRes);
      } catch (err) {
        setBaseError(parseError(err));
      }
    })();
  }, []);

  const storeNameMap = useMemo(() => {
    const map = new Map<number, { name: string; code: string }>();
    stores.forEach((store) => {
      map.set(store.store_id, { name: store.store_name, code: store.store_code });
    });
    return map;
  }, [stores]);

  const salesSummary = useMemo(() => {
    const totalOrders = salesRows.reduce((sum, row) => sum + row.total_orders, 0);
    const totalIncome = salesRows.reduce((sum, row) => sum + row.total_income, 0);
    const totalProfit = salesRows.reduce((sum, row) => sum + row.total_profit, 0);
    return {
      days: salesRows.length,
      totalOrders,
      totalIncome,
      totalProfit,
    };
  }, [salesRows]);

  const inventorySummary = useMemo(() => {
    const totalRows = inventoryRows.length;
    const lockedRows = inventoryRows.filter((row) => row.is_locked).length;
    const lowRows = inventoryRows.filter((row) => row.actual_quantity < 20).length;
    const totalQty = inventoryRows.reduce((sum, row) => sum + row.actual_quantity, 0);
    return {
      totalRows,
      lockedRows,
      lowRows,
      totalQty,
    };
  }, [inventoryRows]);

  const salesPageRows = useMemo(() => {
    const start = (salesPage - 1) * salesLimit;
    return salesRows.slice(start, start + salesLimit);
  }, [salesRows, salesPage, salesLimit]);

  const inventoryPageRows = useMemo(() => {
    const start = (inventoryPage - 1) * inventoryLimit;
    return inventoryRows.slice(start, start + inventoryLimit);
  }, [inventoryRows, inventoryPage, inventoryLimit]);

  async function onQuerySales() {
    setSalesLoading(true);
    setSalesError("");
    try {
      const targetStoreIds = salesStoreId
        ? [Number(salesStoreId)].filter(isBusinessStoreId)
        : stores.map((store) => store.store_id).filter(isBusinessStoreId);

      const chunks = await Promise.all(
        targetStoreIds.map((store_id) =>
          fetchAllSalesByStore(store_id, {
            start_date: salesStartDate || undefined,
            end_date: salesEndDate || undefined,
          })
        )
      );

      const uniqueRows = new Map<number, SalesRowWithStore>();
      chunks.flat().forEach((row) => {
        if (!isBusinessStoreId(row.store_id) || uniqueRows.has(row.sales_id)) {
          return;
        }
        const storeName = storeNameMap.get(row.store_id)?.name ?? `门店${row.store_id}`;
        uniqueRows.set(row.sales_id, {
          ...row,
          store_name: storeName,
        });
      });

      const merged = Array.from(uniqueRows.values());

      merged.sort((a, b) => {
        const t = b.sales_date.localeCompare(a.sales_date);
        if (t !== 0) {
          return t;
        }
        return a.store_id - b.store_id;
      });

      setSalesRows(merged);
      setSalesPage(1);
    } catch (err) {
      setSalesError(parseError(err));
    } finally {
      setSalesLoading(false);
    }
  }

  async function onOpenSalesDetail(sales_id: number) {
    setSalesError("");
    try {
      const detail = await fetchSalesDailyDetail(sales_id);
      setActiveSalesDetail(detail);
    } catch (err) {
      setSalesError(parseError(err));
    }
  }

  async function onQueryInventory() {
    setInventoryLoading(true);
    setInventoryError("");
    try {
      const targetStoreIds = inventoryStoreId
        ? [Number(inventoryStoreId)].filter(isBusinessStoreId)
        : stores.map((store) => store.store_id).filter(isBusinessStoreId);

      const chunks = await Promise.all(
        targetStoreIds.map((store_id) =>
          fetchAllInventoryByStore(store_id, {
            keyword: inventoryKeyword || undefined,
            category_id: inventoryCategoryId ? Number(inventoryCategoryId) : undefined,
            low_stock: inventoryLowStock ? true : undefined,
          })
        )
      );

      const merged = chunks.flatMap((rows, idx) => {
        const store_id = targetStoreIds[idx];
        const storeInfo = storeNameMap.get(store_id);
        return rows
          .filter((row) => isBusinessStoreId(row.store_id))
          .map((row) => ({
            ...row,
            store_name: storeInfo?.name ?? `门店${store_id}`,
            store_code: storeInfo?.code ?? "-",
          }));
      });

      merged.sort((a, b) => {
        if (a.store_id !== b.store_id) {
          return a.store_id - b.store_id;
        }
        return a.sku_id - b.sku_id;
      });

      setInventoryRows(merged);
      setInventoryPage(1);
    } catch (err) {
      setInventoryError(parseError(err));
    } finally {
      setInventoryLoading(false);
    }
  }

  useEffect(() => {
    if (stores.length === 0 || hasAutoQueried) {
      return;
    }
    setHasAutoQueried(true);
    void onQuerySales();
    void onQueryInventory();
  }, [stores, hasAutoQueried]);

  const salesMaxPage = Math.max(1, Math.ceil(salesRows.length / salesLimit));
  const inventoryMaxPage = Math.max(1, Math.ceil(inventoryRows.length / inventoryLimit));

  return (
    <section className="hq-analytics-page">
      <h2>全域经营与分析监控</h2>
      {baseError ? <p className="error-text">{baseError}</p> : null}

      <article className="op-card">
        <h3>全局销售看板</h3>
        <div className="query-bar hq-sales-query-bar">
          <select
            value={salesStoreId}
            onChange={(e) => {
              setSalesStoreId(e.target.value);
              setSalesPage(1);
            }}
          >
            <option value="">全部门店</option>
            {stores.map((store) => (
              <option key={store.store_id} value={String(store.store_id)}>
                {store.store_name}
              </option>
            ))}
          </select>
          <label className="hq-date-field">
            <span>开始日期</span>
            <input
              type="date"
              value={salesStartDate}
              onChange={(e) => {
                setSalesStartDate(e.target.value);
                setSalesPage(1);
              }}
            />
          </label>
          <label className="hq-date-field">
            <span>结束日期</span>
            <input
              type="date"
              value={salesEndDate}
              onChange={(e) => {
                setSalesEndDate(e.target.value);
                setSalesPage(1);
              }}
            />
          </label>
          <button type="button" onClick={() => void onQuerySales()} disabled={salesLoading || stores.length === 0}>
            {salesLoading ? "查询中..." : "查询销售"}
          </button>
        </div>

        <div className="hq-analytics-kpi-grid">
          <article className="hq-analytics-kpi-card">
            <span>记录天数</span>
            <strong>{salesSummary.days}</strong>
          </article>
          <article className="hq-analytics-kpi-card">
            <span>总单量</span>
            <strong>{salesSummary.totalOrders}</strong>
          </article>
          <article className="hq-analytics-kpi-card">
            <span>总收入</span>
            <strong>{formatMoney(salesSummary.totalIncome)}</strong>
          </article>
          <article className="hq-analytics-kpi-card">
            <span>总利润</span>
            <strong>{formatMoney(salesSummary.totalProfit)}</strong>
          </article>
        </div>

        {salesError ? <p className="error-text">{salesError}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>门店</th>
                <th>日期</th>
                <th>总单量</th>
                <th>总收入</th>
                <th>总利润</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {salesPageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    暂无数据
                  </td>
                </tr>
              ) : (
                salesPageRows.map((row) => (
                  <tr key={`${row.store_id}_${row.sales_id}`}>
                    <td>{row.store_name}</td>
                    <td>{row.sales_date}</td>
                    <td>{row.total_orders}</td>
                    <td>{formatMoney(row.total_income)}</td>
                    <td>{formatMoney(row.total_profit)}</td>
                    <td>
                      <button type="button" onClick={() => void onOpenSalesDetail(row.sales_id)}>
                        SKU明细
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <button type="button" disabled={salesPage <= 1} onClick={() => setSalesPage((p) => p - 1)}>
            上一页
          </button>
          <span>
            第 {salesPage} / {salesMaxPage} 页（共 {salesRows.length} 条）
          </span>
          <button
            type="button"
            disabled={salesPage >= salesMaxPage}
            onClick={() => setSalesPage((p) => p + 1)}
          >
            下一页
          </button>
        </div>
      </article>

      <article className="op-card">
        <h3>全局库存大盘</h3>
        <div className="query-bar hq-inventory-query-bar">
          <select
            value={inventoryStoreId}
            onChange={(e) => {
              setInventoryStoreId(e.target.value);
              setInventoryPage(1);
            }}
          >
            <option value="">全部门店</option>
            {stores.map((store) => (
              <option key={store.store_id} value={String(store.store_id)}>
                {store.store_name}
              </option>
            ))}
          </select>
          <input
            placeholder="搜索 SKU 名/编码"
            value={inventoryKeyword}
            onChange={(e) => {
              setInventoryKeyword(e.target.value);
              setInventoryPage(1);
            }}
          />
          <select
            value={inventoryCategoryId}
            onChange={(e) => {
              setInventoryCategoryId(e.target.value);
              setInventoryPage(1);
            }}
          >
            <option value="">全部分类</option>
            {categories.map((category) => (
              <option key={category.category_id} value={String(category.category_id)}>
                {category.category_name}
              </option>
            ))}
          </select>
          <label className="check-line">
            <input
              type="checkbox"
              checked={inventoryLowStock}
              onChange={(e) => {
                setInventoryLowStock(e.target.checked);
                setInventoryPage(1);
              }}
            />
            low_stock 低库存
          </label>
          <button
            type="button"
            onClick={() => void onQueryInventory()}
            disabled={inventoryLoading || stores.length === 0}
          >
            {inventoryLoading ? "查询中..." : "查询库存"}
          </button>
        </div>

        <div className="hq-analytics-kpi-grid">
          <article className="hq-analytics-kpi-card">
            <span>库存记录数</span>
            <strong>{inventorySummary.totalRows}</strong>
          </article>
          <article className="hq-analytics-kpi-card">
            <span>锁定记录数</span>
            <strong>{inventorySummary.lockedRows}</strong>
          </article>
          <article className="hq-analytics-kpi-card">
            <span>低库存记录数</span>
            <strong>{inventorySummary.lowRows}</strong>
          </article>
          <article className="hq-analytics-kpi-card">
            <span>总在库数量</span>
            <strong>{inventorySummary.totalQty}</strong>
          </article>
        </div>

        {inventoryError ? <p className="error-text">{inventoryError}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>门店</th>
                <th>SKU编码</th>
                <th>SKU名称</th>
                <th>实际库存</th>
                <th>锁定状态</th>
              </tr>
            </thead>
            <tbody>
              {inventoryPageRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    暂无数据
                  </td>
                </tr>
              ) : (
                inventoryPageRows.map((row) => (
                  <tr key={`${row.store_id}_${row.inventory_id}`}>
                    <td>{row.store_name}</td>
                    <td>{row.sku_code}</td>
                    <td>{row.sku_name}</td>
                    <td>{row.actual_quantity}</td>
                    <td>{row.is_locked ? "调拨中（锁定）" : "可用"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <button
            type="button"
            disabled={inventoryPage <= 1}
            onClick={() => setInventoryPage((p) => p - 1)}
          >
            上一页
          </button>
          <span>
            第 {inventoryPage} / {inventoryMaxPage} 页（共 {inventoryRows.length} 条）
          </span>
          <button
            type="button"
            disabled={inventoryPage >= inventoryMaxPage}
            onClick={() => setInventoryPage((p) => p + 1)}
          >
            下一页
          </button>
        </div>
      </article>

      {activeSalesDetail ? (
        <div className="hq-modal-overlay" role="dialog" aria-modal="true">
          <div className="hq-modal-dialog">
            <div className="hq-modal-header">
              <h3>SKU 销售明细（sales_id: {activeSalesDetail.sales_id}）</h3>
              <button type="button" onClick={() => setActiveSalesDetail(null)} className="hq-modal-close">
                关闭
              </button>
            </div>
            <div className="hq-modal-body">
              <p className="hint">
                门店ID：{activeSalesDetail.store_id}，销售日期：{activeSalesDetail.sales_date}
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>SKU ID</th>
                      <th>SKU名称</th>
                      <th>销量</th>
                      <th>销售额</th>
                      <th>利润</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSalesDetail.details.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="empty">
                          暂无明细
                        </td>
                      </tr>
                    ) : (
                      activeSalesDetail.details.map((detail) => (
                        <tr key={detail.detail_id}>
                          <td>{detail.sku_id}</td>
                          <td>{detail.sku_name}</td>
                          <td>{detail.sku_amount}</td>
                          <td>{formatMoney(detail.sku_income)}</td>
                          <td>{formatMoney(detail.sku_profit)}</td>
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
    </section>
  );
}
