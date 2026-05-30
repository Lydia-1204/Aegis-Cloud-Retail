package app

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
)

type passwordChangeReq struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

type storeCreateReq struct {
	StoreCode     string  `json:"store_code"`
	StoreName     string  `json:"store_name"`
	StoreLocation string  `json:"store_location"`
	StoreArea     float64 `json:"store_area"`
	StoreStatus   string  `json:"store_status"`
}

type storeUpdateReq struct {
	StoreName     *string  `json:"store_name"`
	StoreLocation *string  `json:"store_location"`
	StoreArea     *float64 `json:"store_area"`
	StoreStatus   *string  `json:"store_status"`
}

type skuCreateReq struct {
	SKUCode    string  `json:"sku_code"`
	SKUName    string  `json:"sku_name"`
	CategoryID int64   `json:"category_id"`
	StdCost    float64 `json:"std_cost"`
	SugPrice   float64 `json:"sug_price"`
	Force      bool    `json:"force"`
	SKUStatus  string  `json:"sku_status"`
}

type skuUpdateReq struct {
	SKUName    *string  `json:"sku_name"`
	CategoryID *int64   `json:"category_id"`
	StdCost    *float64 `json:"std_cost"`
	SugPrice   *float64 `json:"sug_price"`
	Force      bool     `json:"force"`
}

type userCreateReq struct {
	StoreID     int64  `json:"store_id"`
	RoleID      int64  `json:"role_id"`
	UserName    string `json:"user_name"`
	AccountName string `json:"account_name"`
	Password    string `json:"password"`
}

type userUpdateReq struct {
	StoreID  *int64  `json:"store_id"`
	RoleID   *int64  `json:"role_id"`
	UserName *string `json:"user_name"`
}

func (s *Server) handlePassword(w http.ResponseWriter, r *http.Request, user authUser) {
	if r.Method != http.MethodPatch {
		writeJSON(w, http.StatusMethodNotAllowed, response{Code: 1001, Message: "method not allowed", Data: nil})
		return
	}

	var req passwordChangeReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil ||
		strings.TrimSpace(req.OldPassword) == "" || len(req.NewPassword) < 6 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "参数校验失败", Data: nil})
		return
	}

	res, err := s.db.ExecContext(r.Context(), `
UPDATE app_users
SET password_hash = crypt($1, gen_salt('bf')), updated_at = now()
WHERE user_id = $2
  AND password_hash = crypt($3, password_hash)`, req.NewPassword, user.UserID, req.OldPassword)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "旧密码不正确", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "密码修改成功", Data: nil})
}

func (s *Server) handleCreateStore(w http.ResponseWriter, r *http.Request, user authUser) {
	if !requireHead(w, user) {
		return
	}
	var req storeCreateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "参数校验失败", Data: nil})
		return
	}
	req.StoreCode = strings.TrimSpace(req.StoreCode)
	req.StoreName = strings.TrimSpace(req.StoreName)
	req.StoreLocation = strings.TrimSpace(req.StoreLocation)
	if req.StoreCode == "" || req.StoreName == "" || req.StoreLocation == "" || req.StoreArea <= 0 || !validStoreStatus(req.StoreStatus) {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "参数校验失败", Data: nil})
		return
	}

	var id int64
	err := s.db.QueryRowContext(r.Context(), `
INSERT INTO stores (store_code, store_name, store_location, store_area, store_status)
VALUES ($1, $2, $3, $4, $5)
RETURNING store_id`, req.StoreCode, req.StoreName, req.StoreLocation, req.StoreArea, req.StoreStatus).Scan(&id)
	if err != nil {
		if isUniqueViolation(err) {
			writeJSON(w, http.StatusConflict, response{Code: 1003, Message: fmt.Sprintf("门店编码 %s 已存在", req.StoreCode), Data: nil})
			return
		}
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	data, err := s.storeByID(r.Context(), id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "门店创建成功", Data: data})
}

func (s *Server) handleUpdateStore(w http.ResponseWriter, r *http.Request, user authUser) {
	if !requireHead(w, user) {
		return
	}
	storeID, ok := parseIDFromPath(r.URL.Path, "/api/stores/")
	if !ok {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "store_id 非法", Data: nil})
		return
	}
	var req storeUpdateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "参数校验失败", Data: nil})
		return
	}
	if req.StoreName != nil && strings.TrimSpace(*req.StoreName) == "" {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "store_name 非法", Data: nil})
		return
	}
	if req.StoreLocation != nil && strings.TrimSpace(*req.StoreLocation) == "" {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "store_location 非法", Data: nil})
		return
	}
	if req.StoreArea != nil && *req.StoreArea <= 0 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "store_area 非法", Data: nil})
		return
	}
	if req.StoreStatus != nil && !validStoreStatus(*req.StoreStatus) {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "store_status 非法", Data: nil})
		return
	}
	res, err := s.db.ExecContext(r.Context(), `
UPDATE stores
SET store_name = COALESCE($1, store_name),
    store_location = COALESCE($2, store_location),
    store_area = COALESCE($3, store_area),
    store_status = COALESCE($4, store_status),
    updated_at = now()
WHERE store_id = $5`, req.StoreName, req.StoreLocation, req.StoreArea, req.StoreStatus, storeID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "门店不存在", Data: nil})
		return
	}
	data, err := s.storeByID(r.Context(), storeID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "更新成功", Data: data})
}

func (s *Server) handleDeleteStore(w http.ResponseWriter, r *http.Request, user authUser) {
	if !requireHead(w, user) {
		return
	}
	storeID, ok := parseIDFromPath(r.URL.Path, "/api/stores/")
	if !ok || storeID == 0 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "store_id 非法", Data: nil})
		return
	}
	res, err := s.db.ExecContext(r.Context(), `UPDATE stores SET store_status = 'inactive', updated_at = now() WHERE store_id = $1`, storeID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "门店不存在", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "门店已停用", Data: nil})
}

func (s *Server) handleCreateSKU(w http.ResponseWriter, r *http.Request, user authUser) {
	if !requireHead(w, user) {
		return
	}
	var req skuCreateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "参数校验失败", Data: nil})
		return
	}
	req.SKUCode = strings.TrimSpace(req.SKUCode)
	req.SKUName = strings.TrimSpace(req.SKUName)
	if req.SKUCode == "" || req.SKUName == "" || req.CategoryID <= 0 || req.StdCost <= 0 || req.SugPrice <= 0 || !validSKUStatus(req.SKUStatus) {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "参数校验失败", Data: nil})
		return
	}
	if req.SugPrice < req.StdCost && !req.Force {
		writeJSON(w, http.StatusOK, response{
			Code:    1002,
			Message: fmt.Sprintf("建议售价（%.2f）低于进价（%.2f），请确认后重新提交（附带 force: true）", req.SugPrice, req.StdCost),
			Data: map[string]interface{}{
				"std_cost":   req.StdCost,
				"sug_price":  req.SugPrice,
				"sku_status": req.SKUStatus,
			},
		})
		return
	}

	var id int64
	err := s.db.QueryRowContext(r.Context(), `
INSERT INTO skus (sku_code, sku_name, category_id, std_cost, sug_price, sku_status)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING sku_id`, req.SKUCode, req.SKUName, req.CategoryID, req.StdCost, req.SugPrice, req.SKUStatus).Scan(&id)
	if err != nil {
		if isUniqueViolation(err) {
			writeJSON(w, http.StatusConflict, response{Code: 1003, Message: fmt.Sprintf("SKU 编码 %s 已存在", req.SKUCode), Data: nil})
			return
		}
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "SKU 分类不存在或参数非法", Data: nil})
		return
	}
	data, err := s.skuByID(r.Context(), id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "SKU 创建成功", Data: data})
}

func (s *Server) handleUpdateSKU(w http.ResponseWriter, r *http.Request, user authUser) {
	if !requireHead(w, user) {
		return
	}
	skuID, ok := parseIDFromPath(r.URL.Path, "/api/skus/")
	if !ok {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "sku_id 非法", Data: nil})
		return
	}
	current, err := s.skuByID(r.Context(), skuID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "SKU 不存在", Data: nil})
			return
		}
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	var req skuUpdateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "参数校验失败", Data: nil})
		return
	}
	if req.SKUName != nil && strings.TrimSpace(*req.SKUName) == "" {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "sku_name 非法", Data: nil})
		return
	}
	if req.CategoryID != nil && *req.CategoryID <= 0 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "category_id 非法", Data: nil})
		return
	}
	if req.StdCost != nil && *req.StdCost <= 0 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "std_cost 非法", Data: nil})
		return
	}
	if req.SugPrice != nil && *req.SugPrice <= 0 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "sug_price 非法", Data: nil})
		return
	}
	stdCost := current["std_cost"].(float64)
	sugPrice := current["sug_price"].(float64)
	if req.StdCost != nil {
		stdCost = *req.StdCost
	}
	if req.SugPrice != nil {
		sugPrice = *req.SugPrice
	}
	if sugPrice < stdCost && !req.Force {
		writeJSON(w, http.StatusOK, response{
			Code:    1002,
			Message: fmt.Sprintf("建议售价（%.2f）低于进价（%.2f），请确认后重新提交（附带 force: true）", sugPrice, stdCost),
			Data: map[string]interface{}{
				"std_cost":  stdCost,
				"sug_price": sugPrice,
			},
		})
		return
	}
	_, err = s.db.ExecContext(r.Context(), `
UPDATE skus
SET sku_name = COALESCE($1, sku_name),
    category_id = COALESCE($2, category_id),
    std_cost = COALESCE($3, std_cost),
    sug_price = COALESCE($4, sug_price),
    updated_at = now()
WHERE sku_id = $5`, req.SKUName, req.CategoryID, req.StdCost, req.SugPrice, skuID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "SKU 分类不存在或参数非法", Data: nil})
		return
	}
	data, err := s.skuByID(r.Context(), skuID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "更新成功", Data: data})
}

func (s *Server) handleDeleteSKU(w http.ResponseWriter, r *http.Request, user authUser) {
	if !requireHead(w, user) {
		return
	}
	skuID, ok := parseIDFromPath(r.URL.Path, "/api/skus/")
	if !ok {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "sku_id 非法", Data: nil})
		return
	}
	res, err := s.db.ExecContext(r.Context(), `UPDATE skus SET sku_status = 'unsale', updated_at = now() WHERE sku_id = $1`, skuID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "SKU 不存在", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "SKU 已停用", Data: nil})
}

func (s *Server) handleCreateUser(w http.ResponseWriter, r *http.Request, user authUser) {
	if !requireHead(w, user) {
		return
	}
	var req userCreateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "参数校验失败", Data: nil})
		return
	}
	req.UserName = strings.TrimSpace(req.UserName)
	req.AccountName = strings.TrimSpace(req.AccountName)
	if req.StoreID < 0 || req.RoleID <= 0 || req.UserName == "" || req.AccountName == "" || len(req.Password) < 6 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "参数校验失败", Data: nil})
		return
	}
	var id int64
	err := s.db.QueryRowContext(r.Context(), `
INSERT INTO app_users (store_id, role_id, user_name, account_name, password_hash)
VALUES ($1, $2, $3, $4, crypt($5, gen_salt('bf')))
RETURNING user_id`, req.StoreID, req.RoleID, req.UserName, req.AccountName, req.Password).Scan(&id)
	if err != nil {
		if isUniqueViolation(err) {
			writeJSON(w, http.StatusConflict, response{Code: 1003, Message: fmt.Sprintf("账号 %s 已存在", req.AccountName), Data: nil})
			return
		}
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "门店或角色不存在", Data: nil})
		return
	}
	data, err := s.userByID(r.Context(), id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "用户创建成功", Data: data})
}

func (s *Server) handleUserByID(w http.ResponseWriter, r *http.Request, user authUser) {
	if r.Method == http.MethodDelete {
		s.handleDeleteUser(w, r, user)
		return
	}
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, response{Code: 1001, Message: "method not allowed", Data: nil})
		return
	}
	if !requireHead(w, user) {
		return
	}
	userID, ok := parseIDFromPath(r.URL.Path, "/api/users/")
	if !ok {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "user_id 非法", Data: nil})
		return
	}
	var req userUpdateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "参数校验失败", Data: nil})
		return
	}
	if req.StoreID != nil && *req.StoreID < 0 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "store_id 非法", Data: nil})
		return
	}
	if req.RoleID != nil && *req.RoleID <= 0 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "role_id 非法", Data: nil})
		return
	}
	if req.UserName != nil && strings.TrimSpace(*req.UserName) == "" {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "user_name 非法", Data: nil})
		return
	}
	res, err := s.db.ExecContext(r.Context(), `
UPDATE app_users
SET store_id = COALESCE($1, store_id),
    role_id = COALESCE($2, role_id),
    user_name = COALESCE($3, user_name),
    updated_at = now()
WHERE user_id = $4`, req.StoreID, req.RoleID, req.UserName, userID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "门店或角色不存在", Data: nil})
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "用户不存在", Data: nil})
		return
	}
	data, err := s.userByID(r.Context(), userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "更新成功", Data: data})
}

func (s *Server) handleDeleteUser(w http.ResponseWriter, r *http.Request, user authUser) {
	if !requireHead(w, user) {
		return
	}
	userID, ok := parseIDFromPath(r.URL.Path, "/api/users/")
	if !ok || userID == user.UserID {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "user_id 非法", Data: nil})
		return
	}
	res, err := s.db.ExecContext(r.Context(), `
UPDATE app_users
SET account_name = CONCAT('__deleted__', user_id, '_', EXTRACT(EPOCH FROM now())::BIGINT),
    user_name = CONCAT('已删除-', user_name),
    updated_at = now()
WHERE user_id = $1
  AND account_name NOT LIKE '__deleted__%'`, userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "用户不存在或已删除", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "用户已软删除", Data: nil})
}
