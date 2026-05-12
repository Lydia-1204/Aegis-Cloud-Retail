package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"
)

type inventoryAdjustReq struct {
	StoreID                       int64           `json:"store_id"`
	SKUID                         int64           `json:"sku_id"`
	ActualQuantity                int             `json:"actual_quantity"`
	InventoryDiagnosisResultType  string          `json:"inventory_diagonsis_result_type"`
	InventoryDiagnosisResultType2 string          `json:"inventory_diagnosis_result_type"`
	InventoryRootCause            json.RawMessage `json:"inventory_root_cause"`
	Remark                        string          `json:"remark"`
}

func (s *Server) handleInventory(w http.ResponseWriter, r *http.Request, user authUser) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, response{Code: 1001, Message: "method not allowed", Data: nil})
		return
	}
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

	keyword := strings.TrimSpace(r.URL.Query().Get("keyword"))
	categoryID, hasCategory, err := parseInt64Query(r, "category_id")
	if err != nil || (hasCategory && categoryID <= 0) {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "category_id 非法", Data: nil})
		return
	}
	lowStock := strings.EqualFold(r.URL.Query().Get("low_stock"), "true")

	where := []string{"1=1"}
	args := []interface{}{}
	if storeID > 0 {
		args = append(args, storeID)
		where = append(where, fmt.Sprintf("i.store_id = $%d", len(args)))
	}
	if keyword != "" {
		args = append(args, "%"+keyword+"%")
		where = append(where, fmt.Sprintf("(s.sku_name ILIKE $%d OR s.sku_code ILIKE $%d)", len(args), len(args)))
	}
	if hasCategory {
		args = append(args, categoryID)
		where = append(where, fmt.Sprintf("s.category_id = $%d", len(args)))
	}
	if lowStock {
		where = append(where, "i.actual_quantity < 20")
	}
	whereSQL := strings.Join(where, " AND ")

	countQ := `
SELECT COUNT(*)
FROM inventories i
JOIN skus s ON s.sku_id = i.sku_id
JOIN sku_categories c ON c.category_id = s.category_id
WHERE ` + whereSQL
	var total int64
	if err := s.db.QueryRowContext(r.Context(), countQ, args...).Scan(&total); err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}

	args = append(args, limit, (page-1)*limit)
	listQ := fmt.Sprintf(`
SELECT i.inventory_id, i.store_id, i.sku_id, s.sku_code, s.sku_name, c.category_name, i.actual_quantity,
       EXISTS (
         SELECT 1
         FROM transfer_orders tor
         JOIN transfer_details td ON td.order_id = tor.order_id
         WHERE tor.store_id = i.store_id
           AND td.sku_id = i.sku_id
           AND tor.status IN ('%s','%s','%s','%s')
       ) AS is_locked
FROM inventories i
JOIN skus s ON s.sku_id = i.sku_id
JOIN sku_categories c ON c.category_id = s.category_id
WHERE %s
ORDER BY i.store_id, i.inventory_id
LIMIT $%d OFFSET $%d`, statusAIGenerated, statusPendingApproval, statusIssuedPendingConfirmation, statusInNegotiation, whereSQL, len(args)-1, len(args))
	rows, err := s.db.QueryContext(r.Context(), listQ, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	defer rows.Close()

	data := make([]map[string]interface{}, 0, limit)
	for rows.Next() {
		var inventoryID, rowStoreID, skuID int64
		var skuCode, skuName, categoryName string
		var qty int
		var locked bool
		if err := rows.Scan(&inventoryID, &rowStoreID, &skuID, &skuCode, &skuName, &categoryName, &qty, &locked); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
			return
		}
		data = append(data, inventoryItemMap(inventoryID, rowStoreID, skuID, skuCode, skuName, categoryName, qty, locked))
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "ok", Data: map[string]interface{}{
		"page": page, "limit": limit, "total": total, "data": data,
	}})
}

func (s *Server) handleInventoryAdjust(w http.ResponseWriter, r *http.Request, user authUser) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, response{Code: 1001, Message: "method not allowed", Data: nil})
		return
	}
	if !requireStore(w, user) {
		return
	}
	var req inventoryAdjustReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "参数校验失败", Data: nil})
		return
	}
	if req.StoreID != user.StoreID {
		writeJSON(w, http.StatusForbidden, response{Code: 2002, Message: "越权操作", Data: nil})
		return
	}
	resultType := req.InventoryDiagnosisResultType
	if resultType == "" {
		resultType = req.InventoryDiagnosisResultType2
	}
	if req.SKUID <= 0 || req.ActualQuantity < 0 || !validDiagnosisType(resultType) || len(req.InventoryRootCause) == 0 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "参数校验失败", Data: nil})
		return
	}

	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	defer tx.Rollback()

	locked, skuName, err := isInventoryLockedTx(r.Context(), tx, req.StoreID, req.SKUID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	if locked {
		writeJSON(w, http.StatusLocked, response{Code: 1005, Message: fmt.Sprintf("SKU %d（%s）正在参与调拨流程，暂时无法修改库存", req.SKUID, skuName), Data: nil})
		return
	}

	var inventoryID int64
	var currentQty int
	err = tx.QueryRowContext(r.Context(), `
SELECT inventory_id, actual_quantity
FROM inventories
WHERE store_id = $1 AND sku_id = $2
FOR UPDATE`, req.StoreID, req.SKUID).Scan(&inventoryID, &currentQty)
	if err != nil {
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "库存记录不存在", Data: nil})
			return
		}
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}

	ratio := changeRatio(currentQty, req.ActualQuantity)
	if ratio > 0.3 && strings.TrimSpace(req.Remark) == "" {
		writeJSON(w, http.StatusBadRequest, response{Code: 1007, Message: fmt.Sprintf("修正幅度超过 30%%（当前库存：%d，修正后：%d），请在 remark 字段填写原因后重新提交", currentQty, req.ActualQuantity), Data: map[string]interface{}{
			"current_quantity": currentQty,
			"new_quantity":     req.ActualQuantity,
			"change_ratio":     ratio,
		}})
		return
	}

	if _, err := tx.ExecContext(r.Context(), `UPDATE inventories SET actual_quantity = $1, updated_at = now() WHERE inventory_id = $2`, req.ActualQuantity, inventoryID); err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	if _, err := tx.ExecContext(r.Context(), `
INSERT INTO ai_inventory_diagnoses (store_id, sku_id, inventory_diagnosis_result_type, inventory_root_cause)
VALUES ($1, $2, $3, $4::jsonb)
ON CONFLICT DO NOTHING`, req.StoreID, req.SKUID, resultType, string(req.InventoryRootCause)); err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	if err := tx.Commit(); err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	item, err := s.inventoryItemByStoreSKU(r.Context(), req.StoreID, req.SKUID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "库存修正成功", Data: item})
}

func validDiagnosisType(v string) bool {
	return v == "Normal" || v == "Shortage" || v == "Unsale"
}

func changeRatio(oldQty, newQty int) float64 {
	if oldQty == 0 {
		if newQty == 0 {
			return 0
		}
		return 1
	}
	return math.Abs(float64(newQty-oldQty)) / float64(oldQty)
}

func inventoryItemMap(inventoryID, storeID, skuID int64, skuCode, skuName, categoryName string, qty int, locked bool) map[string]interface{} {
	return map[string]interface{}{
		"inventory_id":    inventoryID,
		"store_id":        storeID,
		"sku_id":          skuID,
		"sku_code":        skuCode,
		"sku_name":        skuName,
		"category_name":   categoryName,
		"actual_quantity": qty,
		"is_locked":       locked,
	}
}

func (s *Server) inventoryItemByStoreSKU(ctx context.Context, storeID, skuID int64) (map[string]interface{}, error) {
	var inventoryID int64
	var skuCode, skuName, categoryName string
	var qty int
	var locked bool
	err := s.db.QueryRowContext(ctx, fmt.Sprintf(`
SELECT i.inventory_id, s.sku_code, s.sku_name, c.category_name, i.actual_quantity,
       EXISTS (
         SELECT 1 FROM transfer_orders tor
         JOIN transfer_details td ON td.order_id = tor.order_id
         WHERE tor.store_id = i.store_id AND td.sku_id = i.sku_id
           AND tor.status IN ('%s','%s','%s','%s')
       )
FROM inventories i
JOIN skus s ON s.sku_id = i.sku_id
JOIN sku_categories c ON c.category_id = s.category_id
WHERE i.store_id = $1 AND i.sku_id = $2`, statusAIGenerated, statusPendingApproval, statusIssuedPendingConfirmation, statusInNegotiation), storeID, skuID).
		Scan(&inventoryID, &skuCode, &skuName, &categoryName, &qty, &locked)
	if err != nil {
		return nil, err
	}
	return inventoryItemMap(inventoryID, storeID, skuID, skuCode, skuName, categoryName, qty, locked), nil
}

func isInventoryLockedTx(ctx context.Context, tx *sql.Tx, storeID, skuID int64) (bool, string, error) {
	var skuName string
	if err := tx.QueryRowContext(ctx, `SELECT sku_name FROM skus WHERE sku_id = $1`, skuID).Scan(&skuName); err != nil {
		return false, "", err
	}
	var exists bool
	err := tx.QueryRowContext(ctx, `
SELECT EXISTS (
  SELECT 1
  FROM transfer_orders tor
  JOIN transfer_details td ON td.order_id = tor.order_id
  WHERE tor.store_id = $1
    AND td.sku_id = $2
    AND tor.status IN ($3, $4, $5, $6)
)`, storeID, skuID, statusAIGenerated, statusPendingApproval, statusIssuedPendingConfirmation, statusInNegotiation).Scan(&exists)
	return exists, skuName, err
}
