import type { ReactNode } from "react";
import type { SalesDaily, SalesDailyDetail, TransferOrder } from "@aegis/shared";

export type Row = Record<string, string | number | null>;

export const SALES_FIELD_LABELS = {
  sales_id: "销售单号",
  sales_date: "销售日期",
  total_orders: "总单数",
  total_income: "总收入",
  total_profit: "总利润",
};

export const SALES_DETAIL_FIELD_LABELS = {
  sku_id: "SKU",
  sku_name: "商品名称",
  sku_amount: "销售数量",
  sku_income: "销售收入",
  sku_profit: "销售利润",
};

export const INVENTORY_FIELD_LABELS = {
  sku_code: "SKU 编码",
  sku_name: "商品名称",
  actual_quantity: "当前库存",
  is_locked: "锁定状态",
};

export const TRANSFER_FIELD_LABELS = {
  order_id: "调拨单号",
  status: "状态",
  feedback: "门店异议",
  detail_count: "明细数量",
};

export const TRANSFER_STATUS_LABELS: Record<TransferOrder["status"], string> = {
  ai_generated: "AI 生成",
  pending_approval: "待审核",
  issued_pending_confirmation: "已下发待确认",
  in_negotiation: "协商中",
  confirmed_executed: "已确认执行",
  cancelled: "已取消",
};

export function renderTable(rows: Row[]) {
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

export function renderSalesDetail(detail: SalesDailyDetail) {
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

export function renderSalesTable(
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

export function ModalShell({
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

export function DateField({
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

export function PaginationBar({
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

export function parseError(err: unknown): string {
  return err instanceof Error ? err.message : "请求失败";
}

export function toNumberOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}
