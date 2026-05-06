package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type salesDailyReq struct {
	StoreID        int64            `json:"store_id"`
	SalesDate      string           `json:"sales_date"`
	TotalOrders    int              `json:"total_orders"`
	TotalIncome    float64          `json:"total_income"`
	TotalProfit    float64          `json:"total_profit"`
	ForceOverwrite bool             `json:"force_overwrite"`
	Details        []salesDetailReq `json:"details"`
}

type salesDetailReq struct {
	SKUID     int64   `json:"sku_id"`
	SKUAmount int     `json:"sku_amount"`
	SKUIncome float64 `json:"sku_income"`
	SKUProfit float64 `json:"sku_profit"`
}

func (s *Server) handleSalesDaily(w http.ResponseWriter, r *http.Request, user authUser) {
	switch r.Method {
	case http.MethodGet:
		s.handleSalesDailyList(w, r, user)
	case http.MethodPost:
		s.handleCreateSalesDaily(w, r, user)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, response{Code: 1001, Message: "method not allowed", Data: nil})
	}
}

func (s *Server) handleSalesDailyByID(w http.ResponseWriter, r *http.Request, user authUser) {
	salesID, ok := parseIDFromPath(r.URL.Path, "/api/sales/daily/")
	if !ok {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "sales_id 非法", Data: nil})
		return
	}
	switch r.Method {
	case http.MethodGet:
		data, err := s.salesDailyDetail(r.Context(), salesID, user)
		if err != nil {
			writeSalesLookupError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, response{Code: 0, Message: "ok", Data: data})
	case http.MethodPut:
		s.handleUpdateSalesDaily(w, r, user, salesID)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, response{Code: 1001, Message: "method not allowed", Data: nil})
	}
}

func (s *Server) handleSalesDailyList(w http.ResponseWriter, r *http.Request, user authUser) {
	page, limit := parsePageLimit(r)
	requestedStoreID, _, err := parseInt64Query(r, "store_id")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "store_id 非法", Data: nil})
		return
	}
	storeID, ok := storeScope(w, user, requestedStoreID)
	if !ok {
		return
	}
	salesDate := strings.TrimSpace(r.URL.Query().Get("sales_date"))
	startDate := strings.TrimSpace(r.URL.Query().Get("start_date"))
	endDate := strings.TrimSpace(r.URL.Query().Get("end_date"))

	where := []string{"1=1"}
	args := []interface{}{}
	if storeID > 0 {
		args = append(args, storeID)
		where = append(where, fmt.Sprintf("store_id = $%d", len(args)))
	}
	if salesDate != "" {
		if _, err := parseDate(salesDate); err != nil {
			writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "sales_date 非法", Data: nil})
			return
		}
		args = append(args, salesDate)
		where = append(where, fmt.Sprintf("sales_date = $%d", len(args)))
	}
	if startDate != "" {
		if _, err := parseDate(startDate); err != nil {
			writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "start_date 非法", Data: nil})
			return
		}
		args = append(args, startDate)
		where = append(where, fmt.Sprintf("sales_date >= $%d", len(args)))
	}
	if endDate != "" {
		if _, err := parseDate(endDate); err != nil {
			writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "end_date 非法", Data: nil})
			return
		}
		args = append(args, endDate)
		where = append(where, fmt.Sprintf("sales_date <= $%d", len(args)))
	}
	whereSQL := strings.Join(where, " AND ")

	var total int64
	if err := s.db.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM sales_daily WHERE "+whereSQL, args...).Scan(&total); err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}

	args = append(args, limit, (page-1)*limit)
	rows, err := s.db.QueryContext(r.Context(), fmt.Sprintf(`
SELECT sales_id, store_id, to_char(sales_date, 'YYYY-MM-DD'), total_orders, total_income, total_profit
FROM sales_daily
WHERE %s
ORDER BY sales_date DESC, sales_id DESC
LIMIT $%d OFFSET $%d`, whereSQL, len(args)-1, len(args)), args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	defer rows.Close()

	data := make([]map[string]interface{}, 0, limit)
	for rows.Next() {
		var salesID, rowStoreID int64
		var date string
		var orders int
		var income, profit float64
		if err := rows.Scan(&salesID, &rowStoreID, &date, &orders, &income, &profit); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
			return
		}
		data = append(data, salesDailyMap(salesID, rowStoreID, date, orders, income, profit))
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "ok", Data: map[string]interface{}{
		"page": page, "limit": limit, "total": total, "data": data,
	}})
}

func (s *Server) handleCreateSalesDaily(w http.ResponseWriter, r *http.Request, user authUser) {
	if !requireStore(w, user) {
		return
	}
	req, ok := decodeSalesReq(w, r, user.StoreID)
	if !ok {
		return
	}
	salesID, err := s.saveSalesDaily(r.Context(), req, 0)
	if err != nil {
		writeSalesSaveError(w, err)
		return
	}
	data, err := s.salesDailyDetailByID(r.Context(), salesID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "销售流水提交成功", Data: data})
}

func (s *Server) handleUpdateSalesDaily(w http.ResponseWriter, r *http.Request, user authUser, salesID int64) {
	if !requireStore(w, user) {
		return
	}
	req, ok := decodeSalesReq(w, r, user.StoreID)
	if !ok {
		return
	}
	if _, err := s.saveSalesDaily(r.Context(), req, salesID); err != nil {
		writeSalesSaveError(w, err)
		return
	}
	data, err := s.salesDailyDetailByID(r.Context(), salesID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "更新成功", Data: data})
}

func decodeSalesReq(w http.ResponseWriter, r *http.Request, storeID int64) (salesDailyReq, bool) {
	var req salesDailyReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "参数校验失败", Data: nil})
		return req, false
	}
	if req.StoreID != storeID {
		writeJSON(w, http.StatusForbidden, response{Code: 2002, Message: "越权操作", Data: nil})
		return req, false
	}
	if req.TotalOrders <= 0 || req.TotalIncome <= 0 || len(req.Details) == 0 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "参数校验失败", Data: nil})
		return req, false
	}
	for _, detail := range req.Details {
		if detail.SKUID <= 0 || detail.SKUAmount <= 0 || detail.SKUIncome < 0 {
			writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "销售明细非法", Data: nil})
			return req, false
		}
	}
	if _, err := parseDate(req.SalesDate); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "sales_date 非法", Data: nil})
		return req, false
	}
	return req, true
}

var (
	errSalesTooOld        = errors.New("sales too old")
	errSalesExists        = errors.New("sales exists")
	errSalesNotFound      = errors.New("sales not found")
	errInsufficientStock  = errors.New("insufficient stock")
	errSalesStoreMismatch = errors.New("sales store mismatch")
)

type salesExistsError struct {
	SalesID int64
}

func (e salesExistsError) Error() string { return errSalesExists.Error() }

type stockError struct {
	SKUID int64
}

func (e stockError) Error() string { return errInsufficientStock.Error() }

func (s *Server) saveSalesDaily(ctx context.Context, req salesDailyReq, targetSalesID int64) (int64, error) {
	salesDate, _ := parseDate(req.SalesDate)
	if time.Since(salesDate) > 48*time.Hour || salesDate.After(time.Now().Add(24*time.Hour)) {
		return 0, errSalesTooOld
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	var salesID int64
	var oldStoreID int64
	if targetSalesID == 0 {
		err := tx.QueryRowContext(ctx, `SELECT sales_id FROM sales_daily WHERE store_id = $1 AND sales_date = $2`, req.StoreID, req.SalesDate).Scan(&salesID)
		if err == nil && !req.ForceOverwrite {
			return 0, salesExistsError{SalesID: salesID}
		}
		if err != nil && err != sql.ErrNoRows {
			return 0, err
		}
	} else {
		salesID = targetSalesID
		if err := tx.QueryRowContext(ctx, `SELECT store_id FROM sales_daily WHERE sales_id = $1 FOR UPDATE`, salesID).Scan(&oldStoreID); err != nil {
			if err == sql.ErrNoRows {
				return 0, errSalesNotFound
			}
			return 0, err
		}
		if oldStoreID != req.StoreID {
			return 0, errSalesStoreMismatch
		}
	}

	if salesID != 0 {
		if err := restoreSalesInventory(ctx, tx, salesID); err != nil {
			return 0, err
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM sales_details WHERE sales_id = $1`, salesID); err != nil {
			return 0, err
		}
		if _, err := tx.ExecContext(ctx, `
UPDATE sales_daily
SET sales_date = $1, total_orders = $2, total_income = $3, total_profit = $4, updated_at = now()
WHERE sales_id = $5`, req.SalesDate, req.TotalOrders, req.TotalIncome, req.TotalProfit, salesID); err != nil {
			return 0, err
		}
	} else {
		if err := tx.QueryRowContext(ctx, `
INSERT INTO sales_daily (store_id, sales_date, total_orders, total_income, total_profit)
VALUES ($1, $2, $3, $4, $5)
RETURNING sales_id`, req.StoreID, req.SalesDate, req.TotalOrders, req.TotalIncome, req.TotalProfit).Scan(&salesID); err != nil {
			return 0, err
		}
	}

	for _, detail := range req.Details {
		if err := decrementInventory(ctx, tx, req.StoreID, detail.SKUID, detail.SKUAmount); err != nil {
			return 0, err
		}
		if _, err := tx.ExecContext(ctx, `
INSERT INTO sales_details (sales_id, sku_id, sku_amount, sku_income, sku_profit)
VALUES ($1, $2, $3, $4, $5)`, salesID, detail.SKUID, detail.SKUAmount, detail.SKUIncome, detail.SKUProfit); err != nil {
			return 0, err
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return salesID, nil
}

func restoreSalesInventory(ctx context.Context, tx *sql.Tx, salesID int64) error {
	rows, err := tx.QueryContext(ctx, `
SELECT sd.sku_id, sd.sku_amount, s.store_id
FROM sales_details sd
JOIN sales_daily s ON s.sales_id = sd.sales_id
WHERE sd.sales_id = $1`, salesID)
	if err != nil {
		return err
	}
	type inventoryRestore struct {
		skuID   int64
		storeID int64
		amount  int
	}
	items := []inventoryRestore{}
	for rows.Next() {
		var item inventoryRestore
		if err := rows.Scan(&item.skuID, &item.amount, &item.storeID); err != nil {
			rows.Close()
			return err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	for _, item := range items {
		if _, err := tx.ExecContext(ctx, `
INSERT INTO inventories (store_id, sku_id, actual_quantity)
VALUES ($1, $2, $3)
ON CONFLICT (store_id, sku_id)
DO UPDATE SET actual_quantity = inventories.actual_quantity + EXCLUDED.actual_quantity, updated_at = now()`, item.storeID, item.skuID, item.amount); err != nil {
			return err
		}
	}
	return nil
}

func decrementInventory(ctx context.Context, tx *sql.Tx, storeID, skuID int64, amount int) error {
	var current int
	err := tx.QueryRowContext(ctx, `
SELECT actual_quantity
FROM inventories
WHERE store_id = $1 AND sku_id = $2
FOR UPDATE`, storeID, skuID).Scan(&current)
	if err != nil {
		return err
	}
	if current < amount {
		return stockError{SKUID: skuID}
	}
	_, err = tx.ExecContext(ctx, `UPDATE inventories SET actual_quantity = actual_quantity - $1, updated_at = now() WHERE store_id = $2 AND sku_id = $3`, amount, storeID, skuID)
	return err
}

func (s *Server) salesDailyDetail(ctx context.Context, salesID int64, user authUser) (map[string]interface{}, error) {
	data, err := s.salesDailyDetailByID(ctx, salesID)
	if err != nil {
		return nil, err
	}
	storeID := data["store_id"].(int64)
	if user.RoleName == "Store" && user.StoreID != storeID {
		return nil, errSalesStoreMismatch
	}
	return data, nil
}

func (s *Server) salesDailyDetailByID(ctx context.Context, salesID int64) (map[string]interface{}, error) {
	var storeID int64
	var date string
	var orders int
	var income, profit float64
	err := s.db.QueryRowContext(ctx, `
SELECT sales_id, store_id, to_char(sales_date, 'YYYY-MM-DD'), total_orders, total_income, total_profit
FROM sales_daily
WHERE sales_id = $1`, salesID).Scan(&salesID, &storeID, &date, &orders, &income, &profit)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errSalesNotFound
		}
		return nil, err
	}
	data := salesDailyMap(salesID, storeID, date, orders, income, profit)

	rows, err := s.db.QueryContext(ctx, `
SELECT sd.detail_id, sd.sales_id, sd.sku_id, sk.sku_name, sd.sku_amount, sd.sku_income, sd.sku_profit
FROM sales_details sd
JOIN skus sk ON sk.sku_id = sd.sku_id
WHERE sd.sales_id = $1
ORDER BY sd.detail_id`, salesID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	details := []map[string]interface{}{}
	for rows.Next() {
		var detailID, rowSalesID, skuID int64
		var skuName string
		var amount int
		var skuIncome, skuProfit float64
		if err := rows.Scan(&detailID, &rowSalesID, &skuID, &skuName, &amount, &skuIncome, &skuProfit); err != nil {
			return nil, err
		}
		details = append(details, map[string]interface{}{
			"detail_id":  detailID,
			"sales_id":   rowSalesID,
			"sku_id":     skuID,
			"sku_name":   skuName,
			"sku_amount": amount,
			"sku_income": skuIncome,
			"sku_profit": skuProfit,
		})
	}
	data["details"] = details
	return data, rows.Err()
}

func salesDailyMap(salesID, storeID int64, date string, orders int, income, profit float64) map[string]interface{} {
	return map[string]interface{}{
		"sales_id":     salesID,
		"store_id":     storeID,
		"sales_date":   date,
		"total_orders": orders,
		"total_income": income,
		"total_profit": profit,
	}
}

func writeSalesSaveError(w http.ResponseWriter, err error) {
	var exists salesExistsError
	var stock stockError
	switch {
	case errors.Is(err, errSalesTooOld):
		writeJSON(w, http.StatusBadRequest, response{Code: 1006, Message: "超出补录时限，仅允许补录过去 48 小时内的数据", Data: nil})
	case errors.As(err, &exists):
		writeJSON(w, http.StatusBadRequest, response{Code: 1006, Message: fmt.Sprintf("已存在销售记录（sales_id: %d），请确认覆盖后传 force_overwrite: true 重新提交", exists.SalesID), Data: map[string]interface{}{"existing_sales_id": exists.SalesID}})
	case errors.As(err, &stock):
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: fmt.Sprintf("SKU %d 库存不足，销售流水已回滚", stock.SKUID), Data: nil})
	case errors.Is(err, errSalesNotFound):
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "销售流水不存在", Data: nil})
	case errors.Is(err, errSalesStoreMismatch):
		writeJSON(w, http.StatusForbidden, response{Code: 2002, Message: "越权操作", Data: nil})
	default:
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
	}
}

func writeSalesLookupError(w http.ResponseWriter, err error) {
	if errors.Is(err, errSalesNotFound) {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "销售流水不存在", Data: nil})
		return
	}
	if errors.Is(err, errSalesStoreMismatch) {
		writeJSON(w, http.StatusForbidden, response{Code: 2002, Message: "越权操作", Data: nil})
		return
	}
	writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
}
