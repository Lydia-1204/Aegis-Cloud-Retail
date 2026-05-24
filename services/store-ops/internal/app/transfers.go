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

type transferCreateReq struct {
	StoreID int64               `json:"store_id"`
	Details []transferDetailReq `json:"details"`
}

type transferDetailReq struct {
	SKUID             int64  `json:"sku_id"`
	SuggestedQty      int    `json:"suggested_qty"`
	ActualQty         int    `json:"actual_qty"`
	TransferDirection string `json:"transfer_direction"`
}

type qtyUpdateReq struct {
	Details []qtyUpdateDetailReq `json:"details"`
}

type qtyUpdateDetailReq struct {
	DetailID  int64 `json:"detail_id"`
	ActualQty int   `json:"actual_qty"`
}

type feedbackReq struct {
	Feedback string `json:"feedback"`
}

func (s *Server) handleTransfers(w http.ResponseWriter, r *http.Request, user authUser) {
	switch r.Method {
	case http.MethodGet:
		s.handleTransferList(w, r, user)
	case http.MethodPost:
		s.handleCreateTransfer(w, r, user)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, response{Code: 1001, Message: "method not allowed", Data: nil})
	}
}

func (s *Server) handleTransferAction(w http.ResponseWriter, r *http.Request, user authUser) {
	orderID, action, ok := parseActionPath(r.URL.Path)
	if !ok {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "order_id 或 action 非法", Data: nil})
		return
	}
	if r.Method != http.MethodPatch {
		writeJSON(w, http.StatusMethodNotAllowed, response{Code: 1001, Message: "method not allowed", Data: nil})
		return
	}
	switch action {
	case "approve":
		s.handleApproveTransfer(w, r, user, orderID)
	case "issue":
		s.handleIssueTransfer(w, r, user, orderID)
	case "acknowledge":
		s.handleAcknowledgeTransfer(w, r, user, orderID)
	case "feedback":
		s.handleFeedbackTransfer(w, r, user, orderID)
	case "confirm":
		s.handleConfirmTransfer(w, r, user, orderID)
	case "cancel":
		s.handleCancelTransfer(w, r, user, orderID)
	default:
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "action 非法", Data: nil})
	}
}

func (s *Server) handleTransferList(w http.ResponseWriter, r *http.Request, user authUser) {
	page, limit := parsePageLimit(r)
	requestedStoreID, hasStore, err := parseInt64Query(r, "store_id")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "store_id 非法", Data: nil})
		return
	}
	if !hasStore && user.RoleName == "Store" {
		requestedStoreID = user.StoreID
	}
	storeID, ok := storeScope(w, user, requestedStoreID)
	if !ok {
		return
	}
	statusFilter := strings.TrimSpace(r.URL.Query().Get("status"))
	if statusFilter != "" && !validTransferStatus(statusFilter) {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "status 非法", Data: nil})
		return
	}

	where := []string{"1=1"}
	args := []interface{}{}
	if storeID > 0 {
		args = append(args, storeID)
		where = append(where, fmt.Sprintf("tor.store_id = $%d", len(args)))
	}
	if statusFilter != "" {
		args = append(args, statusFilter)
		where = append(where, fmt.Sprintf("tor.status = $%d", len(args)))
	}
	for _, spec := range []struct {
		key string
		op  string
	}{
		{"start_date", ">="},
		{"end_date", "<="},
	} {
		raw := strings.TrimSpace(r.URL.Query().Get(spec.key))
		if raw == "" {
			continue
		}
		if _, err := parseDate(raw); err != nil {
			writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: spec.key + " 非法", Data: nil})
			return
		}
		args = append(args, raw)
		where = append(where, fmt.Sprintf("tor.created_at::date %s $%d", spec.op, len(args)))
	}
	whereSQL := strings.Join(where, " AND ")

	var total int64
	if err := s.db.QueryRowContext(r.Context(), `
SELECT COUNT(*)
FROM transfer_orders tor
JOIN stores st ON st.store_id = tor.store_id
WHERE `+whereSQL, args...).Scan(&total); err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}

	args = append(args, limit, (page-1)*limit)
	rows, err := s.db.QueryContext(r.Context(), fmt.Sprintf(`
SELECT tor.order_id, tor.store_id, st.store_name, tor.status, tor.feedback, tor.created_at, tor.updated_at
FROM transfer_orders tor
JOIN stores st ON st.store_id = tor.store_id
WHERE %s
ORDER BY tor.updated_at DESC, tor.order_id DESC
LIMIT $%d OFFSET $%d`, whereSQL, len(args)-1, len(args)), args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	defer rows.Close()
	orders := []map[string]interface{}{}
	orderIDs := []int64{}
	for rows.Next() {
		var orderID, rowStoreID int64
		var storeName, status string
		var feedback sql.NullString
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&orderID, &rowStoreID, &storeName, &status, &feedback, &createdAt, &updatedAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
			return
		}
		orderIDs = append(orderIDs, orderID)
		orders = append(orders, transferOrderBaseMap(orderID, rowStoreID, storeName, status, feedback, createdAt, updatedAt))
	}
	if err := fillTransferDetails(r.Context(), s.db, orders, orderIDs); err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "ok", Data: map[string]interface{}{
		"page": page, "limit": limit, "total": total, "data": orders,
	}})
}

func (s *Server) handleCreateTransfer(w http.ResponseWriter, r *http.Request, user authUser) {
	if !requireHead(w, user) {
		return
	}
	var req transferCreateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || !validTransferCreate(req) {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "参数校验失败", Data: nil})
		return
	}
	orderID, err := s.createTransferOrder(r.Context(), req.StoreID, req.Details, statusPendingApproval)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	data, err := s.transferOrderByID(r.Context(), orderID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "调拨单创建成功", Data: data})
}

func (s *Server) handleApproveTransfer(w http.ResponseWriter, r *http.Request, user authUser, orderID int64) {
	if !requireHead(w, user) {
		return
	}
	data, err := s.transitionTransfer(r.Context(), orderID, []string{statusAIGenerated}, statusPendingApproval, nil, false)
	if err != nil {
		writeTransferActionError(w, err, "审核")
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "调拨单已审核，等待总部下发", Data: data})
}

func (s *Server) handleIssueTransfer(w http.ResponseWriter, r *http.Request, user authUser, orderID int64) {
	if !requireHead(w, user) {
		return
	}
	data, err := s.transitionTransfer(r.Context(), orderID, []string{statusPendingApproval}, statusIssuedPendingConfirmation, nil, false)
	if err != nil {
		writeTransferActionError(w, err, "下发")
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "调拨单已下发，等待门店确认", Data: data})
}

func (s *Server) handleAcknowledgeTransfer(w http.ResponseWriter, r *http.Request, user authUser, orderID int64) {
	if !requireStore(w, user) {
		return
	}
	updates, ok := decodeQtyUpdates(w, r)
	if !ok {
		return
	}
	data, err := s.acknowledgeTransfer(r.Context(), orderID, user.StoreID, updates)
	if err != nil {
		writeTransferActionError(w, err, "确认")
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "调拨单已确认，库存已同步更新", Data: data})
}

func (s *Server) handleFeedbackTransfer(w http.ResponseWriter, r *http.Request, user authUser, orderID int64) {
	if !requireStore(w, user) {
		return
	}
	var req feedbackReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Feedback) == "" {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "feedback 不能为空", Data: nil})
		return
	}
	data, err := s.feedbackTransfer(r.Context(), orderID, user.StoreID, strings.TrimSpace(req.Feedback))
	if err != nil {
		writeTransferActionError(w, err, "反馈")
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "异议已提交，等待总部处理", Data: data})
}

func (s *Server) handleConfirmTransfer(w http.ResponseWriter, r *http.Request, user authUser, orderID int64) {
	if !requireHead(w, user) {
		return
	}
	updates, ok := decodeQtyUpdates(w, r)
	if !ok {
		return
	}
	data, err := s.transitionTransfer(r.Context(), orderID, []string{statusInNegotiation}, statusPendingApproval, updates, false)
	if err != nil {
		writeTransferActionError(w, err, "协商确认")
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "已修改调拨数量，等待总部下发", Data: data})
}

func (s *Server) handleCancelTransfer(w http.ResponseWriter, r *http.Request, user authUser, orderID int64) {
	if !requireHead(w, user) {
		return
	}
	data, err := s.transitionTransfer(r.Context(), orderID, []string{statusPendingApproval, statusIssuedPendingConfirmation, statusInNegotiation, statusAIGenerated}, statusCancelled, nil, true)
	if err != nil {
		writeTransferActionError(w, err, "作废")
		return
	}
	_ = data
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "调拨单已作废", Data: nil})
}

var (
	errTransferNotFound      = errors.New("transfer not found")
	errTransferStatusInvalid = errors.New("transfer status invalid")
	errTransferStoreMismatch = errors.New("transfer store mismatch")
	errTransferStock         = errors.New("transfer stock insufficient")
)

type transferStatusError struct{ Current string }

func (e transferStatusError) Error() string { return errTransferStatusInvalid.Error() }

type transferStockError struct{ SKUID int64 }

func (e transferStockError) Error() string { return errTransferStock.Error() }

func validTransferCreate(req transferCreateReq) bool {
	if req.StoreID <= 0 || len(req.Details) == 0 {
		return false
	}
	for _, d := range req.Details {
		if d.SKUID <= 0 || d.SuggestedQty < 0 || d.ActualQty < 0 || (d.TransferDirection != "H2S" && d.TransferDirection != "S2H") {
			return false
		}
	}
	return true
}

func (s *Server) createTransferOrder(ctx context.Context, storeID int64, details []transferDetailReq, initialStatus string) (int64, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	var orderID int64
	if err := tx.QueryRowContext(ctx, `INSERT INTO transfer_orders (store_id, status) VALUES ($1, $2) RETURNING order_id`, storeID, initialStatus).Scan(&orderID); err != nil {
		return 0, err
	}
	for _, d := range details {
		if _, err := tx.ExecContext(ctx, `
INSERT INTO transfer_details (order_id, sku_id, suggested_qty, actual_qty, transfer_direction)
VALUES ($1, $2, $3, $4, $5)`, orderID, d.SKUID, d.SuggestedQty, d.ActualQty, d.TransferDirection); err != nil {
			return 0, err
		}
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return orderID, nil
}

func decodeQtyUpdates(w http.ResponseWriter, r *http.Request) (map[int64]int, bool) {
	if r.Body == nil {
		return map[int64]int{}, true
	}
	var req qtyUpdateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "参数校验失败", Data: nil})
		return nil, false
	}
	updates := map[int64]int{}
	for _, d := range req.Details {
		if d.DetailID <= 0 || d.ActualQty < 0 {
			writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "调拨明细数量非法", Data: nil})
			return nil, false
		}
		updates[d.DetailID] = d.ActualQty
	}
	return updates, true
}

func (s *Server) transitionTransfer(ctx context.Context, orderID int64, allowed []string, next string, updates map[int64]int, allowTerminalNoData bool) (map[string]interface{}, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var current string
	if err := tx.QueryRowContext(ctx, `SELECT status FROM transfer_orders WHERE order_id = $1 FOR UPDATE`, orderID).Scan(&current); err != nil {
		if err == sql.ErrNoRows {
			return nil, errTransferNotFound
		}
		return nil, err
	}
	if !containsStatus(allowed, current) {
		return nil, transferStatusError{Current: current}
	}
	if len(updates) > 0 {
		if err := updateTransferActualQty(ctx, tx, orderID, updates); err != nil {
			return nil, err
		}
	}
	if _, err := tx.ExecContext(ctx, `UPDATE transfer_orders SET status = $1, updated_at = now() WHERE order_id = $2`, next, orderID); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	if allowTerminalNoData {
		return nil, nil
	}
	return s.transferOrderByID(ctx, orderID)
}

func (s *Server) acknowledgeTransfer(ctx context.Context, orderID, storeID int64, updates map[int64]int) (map[string]interface{}, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var current string
	var orderStoreID int64
	if err := tx.QueryRowContext(ctx, `SELECT store_id, status FROM transfer_orders WHERE order_id = $1 FOR UPDATE`, orderID).Scan(&orderStoreID, &current); err != nil {
		if err == sql.ErrNoRows {
			return nil, errTransferNotFound
		}
		return nil, err
	}
	if orderStoreID != storeID {
		return nil, errTransferStoreMismatch
	}
	if current != statusIssuedPendingConfirmation {
		return nil, transferStatusError{Current: current}
	}
	if len(updates) > 0 {
		if err := updateTransferActualQty(ctx, tx, orderID, updates); err != nil {
			return nil, err
		}
	}
	if err := executeTransferInventory(ctx, tx, orderID, storeID); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE transfer_orders SET status = $1, updated_at = now() WHERE order_id = $2`, statusConfirmedExecuted, orderID); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return s.transferOrderByID(ctx, orderID)
}

func (s *Server) feedbackTransfer(ctx context.Context, orderID, storeID int64, feedback string) (map[string]interface{}, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var current string
	var orderStoreID int64
	if err := tx.QueryRowContext(ctx, `SELECT store_id, status FROM transfer_orders WHERE order_id = $1 FOR UPDATE`, orderID).Scan(&orderStoreID, &current); err != nil {
		if err == sql.ErrNoRows {
			return nil, errTransferNotFound
		}
		return nil, err
	}
	if orderStoreID != storeID {
		return nil, errTransferStoreMismatch
	}
	if current != statusIssuedPendingConfirmation {
		return nil, transferStatusError{Current: current}
	}
	if _, err := tx.ExecContext(ctx, `UPDATE transfer_orders SET status = $1, feedback = $2, updated_at = now() WHERE order_id = $3`, statusInNegotiation, feedback, orderID); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return s.transferOrderByID(ctx, orderID)
}

func updateTransferActualQty(ctx context.Context, tx *sql.Tx, orderID int64, updates map[int64]int) error {
	for detailID, qty := range updates {
		res, err := tx.ExecContext(ctx, `UPDATE transfer_details SET actual_qty = $1 WHERE order_id = $2 AND detail_id = $3`, qty, orderID, detailID)
		if err != nil {
			return err
		}
		if affected, _ := res.RowsAffected(); affected == 0 {
			return errTransferNotFound
		}
	}
	return nil
}

func executeTransferInventory(ctx context.Context, tx *sql.Tx, orderID, storeID int64) error {
	rows, err := tx.QueryContext(ctx, `SELECT sku_id, actual_qty, transfer_direction FROM transfer_details WHERE order_id = $1`, orderID)
	if err != nil {
		return err
	}
	type transferInventoryDelta struct {
		skuID     int64
		qty       int
		direction string
	}
	deltas := []transferInventoryDelta{}
	for rows.Next() {
		var delta transferInventoryDelta
		if err := rows.Scan(&delta.skuID, &delta.qty, &delta.direction); err != nil {
			rows.Close()
			return err
		}
		deltas = append(deltas, delta)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	for _, deltaInfo := range deltas {
		var current int
		err := tx.QueryRowContext(ctx, `SELECT actual_quantity FROM inventories WHERE store_id = $1 AND sku_id = $2 FOR UPDATE`, storeID, deltaInfo.skuID).Scan(&current)
		if err == sql.ErrNoRows {
			current = 0
			if _, err := tx.ExecContext(ctx, `INSERT INTO inventories (store_id, sku_id, actual_quantity) VALUES ($1, $2, 0)`, storeID, deltaInfo.skuID); err != nil {
				return err
			}
		} else if err != nil {
			return err
		}
		delta := deltaInfo.qty
		if deltaInfo.direction == "S2H" {
			delta = -deltaInfo.qty
		}
		if current+delta < 0 {
			return transferStockError{SKUID: deltaInfo.skuID}
		}
		if _, err := tx.ExecContext(ctx, `UPDATE inventories SET actual_quantity = actual_quantity + $1, updated_at = now() WHERE store_id = $2 AND sku_id = $3`, delta, storeID, deltaInfo.skuID); err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) transferOrderByID(ctx context.Context, orderID int64) (map[string]interface{}, error) {
	var storeID int64
	var storeName, status string
	var feedback sql.NullString
	var createdAt, updatedAt time.Time
	err := s.db.QueryRowContext(ctx, `
SELECT tor.order_id, tor.store_id, st.store_name, tor.status, tor.feedback, tor.created_at, tor.updated_at
FROM transfer_orders tor
JOIN stores st ON st.store_id = tor.store_id
WHERE tor.order_id = $1`, orderID).Scan(&orderID, &storeID, &storeName, &status, &feedback, &createdAt, &updatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errTransferNotFound
		}
		return nil, err
	}
	order := transferOrderBaseMap(orderID, storeID, storeName, status, feedback, createdAt, updatedAt)
	if err := fillTransferDetails(ctx, s.db, []map[string]interface{}{order}, []int64{orderID}); err != nil {
		return nil, err
	}
	return order, nil
}

func transferOrderBaseMap(orderID, storeID int64, storeName, status string, feedback sql.NullString, createdAt, updatedAt time.Time) map[string]interface{} {
	var fb interface{}
	if feedback.Valid {
		fb = feedback.String
	}
	return map[string]interface{}{
		"order_id":   orderID,
		"store_id":   storeID,
		"store_name": storeName,
		"status":     status,
		"feedback":   fb,
		"created_at": createdAt.Format(time.RFC3339),
		"updated_at": updatedAt.Format(time.RFC3339),
		"details":    []map[string]interface{}{},
	}
}

type queryer interface {
	QueryContext(context.Context, string, ...interface{}) (*sql.Rows, error)
}

func fillTransferDetails(ctx context.Context, q queryer, orders []map[string]interface{}, orderIDs []int64) error {
	if len(orderIDs) == 0 {
		return nil
	}
	placeholders := make([]string, 0, len(orderIDs))
	args := make([]interface{}, 0, len(orderIDs))
	for _, id := range orderIDs {
		args = append(args, id)
		placeholders = append(placeholders, fmt.Sprintf("$%d", len(args)))
	}
	rows, err := q.QueryContext(ctx, fmt.Sprintf(`
SELECT td.detail_id, td.order_id, td.sku_id, sk.sku_name, td.suggested_qty, td.actual_qty, td.transfer_direction
FROM transfer_details td
JOIN skus sk ON sk.sku_id = td.sku_id
WHERE td.order_id IN (%s)
ORDER BY td.detail_id`, strings.Join(placeholders, ",")), args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	byID := map[int64]map[string]interface{}{}
	for _, order := range orders {
		byID[order["order_id"].(int64)] = order
	}
	for rows.Next() {
		var detailID, orderID, skuID int64
		var skuName, direction string
		var suggested, actual int
		if err := rows.Scan(&detailID, &orderID, &skuID, &skuName, &suggested, &actual, &direction); err != nil {
			return err
		}
		order := byID[orderID]
		details := order["details"].([]map[string]interface{})
		details = append(details, map[string]interface{}{
			"detail_id":          detailID,
			"order_id":           orderID,
			"sku_id":             skuID,
			"sku_name":           skuName,
			"suggested_qty":      suggested,
			"actual_qty":         actual,
			"transfer_direction": direction,
		})
		order["details"] = details
	}
	return rows.Err()
}

func containsStatus(list []string, status string) bool {
	for _, item := range list {
		if item == status {
			return true
		}
	}
	return false
}

func writeTransferActionError(w http.ResponseWriter, err error, action string) {
	var statusErr transferStatusError
	var stockErr transferStockError
	switch {
	case errors.Is(err, errTransferNotFound):
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "调拨单不存在", Data: nil})
	case errors.As(err, &statusErr):
		writeJSON(w, http.StatusBadRequest, response{Code: 1004, Message: fmt.Sprintf("当前状态为 %s，不允许执行%s操作", statusErr.Current, action), Data: map[string]interface{}{"current_status": statusErr.Current}})
	case errors.Is(err, errTransferStoreMismatch):
		writeJSON(w, http.StatusForbidden, response{Code: 2002, Message: "越权操作", Data: nil})
	case errors.As(err, &stockErr):
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: fmt.Sprintf("SKU %d 库存不足，调拨执行已回滚", stockErr.SKUID), Data: nil})
	default:
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
	}
}
