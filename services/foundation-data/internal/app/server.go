package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Server struct {
	db        *sql.DB
	jwtSecret []byte
}

type response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

type claims struct {
	UserID   int64  `json:"uid"`
	RoleID   int64  `json:"rid"`
	StoreID  int64  `json:"sid"`
	RoleName string `json:"rnm"`
	jwt.RegisteredClaims
}

type authUser struct {
	UserID      int64
	AccountName string
	UserName    string
	RoleID      int64
	RoleName    string
	StoreID     int64
	Permissions []string
}

func NewServer(db *sql.DB, jwtSecret string) *Server {
	return &Server{
		db:        db,
		jwtSecret: []byte(jwtSecret),
	}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/swagger", s.handleSwaggerUI)
	mux.HandleFunc("/swagger/", s.handleSwaggerUI)
	mux.HandleFunc("/swagger/openapi.json", s.handleOpenAPI)
	mux.HandleFunc("/api/auth/login", s.handleLogin)
	mux.HandleFunc("/api/auth/me", s.auth(s.handleMe))
	mux.HandleFunc("/api/auth/password", s.auth(s.handlePassword))
	mux.HandleFunc("/api/stores", s.auth(s.handleStores))
	mux.HandleFunc("/api/stores/", s.auth(s.handleStoreByID))
	mux.HandleFunc("/api/skus", s.auth(s.handleSKUs))
	mux.HandleFunc("/api/skus/", s.auth(s.handleSKUByID))
	mux.HandleFunc("/api/sku-categories", s.auth(s.handleCategories))
	mux.HandleFunc("/api/users", s.auth(s.handleUsers))
	mux.HandleFunc("/api/users/", s.auth(s.handleUserByID))
	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := s.db.PingContext(ctx); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, response{
			Code:    5001,
			Message: "database unavailable",
			Data:    nil,
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"service": "foundation-data",
		"status":  "ok",
	})
}

type loginReq struct {
	AccountName string `json:"account_name"`
	Password    string `json:"password"`
}

type loginRes struct {
	UserID      int64  `json:"user_id"`
	AccountName string `json:"account_name"`
	RoleName    string `json:"role_name"`
	StoreID     int64  `json:"store_id"`
	UserName    string `json:"user_name"`
	Token       string `json:"token"`
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, response{Code: 1001, Message: "method not allowed", Data: nil})
		return
	}

	var req loginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.AccountName == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "参数校验失败", Data: nil})
		return
	}

	const q = `
SELECT u.user_id, u.account_name, u.user_name, u.store_id, r.role_id, r.role_name, s.store_status
FROM app_users u
JOIN roles r ON r.role_id = u.role_id
JOIN stores s ON s.store_id = u.store_id
WHERE u.account_name = $1
  AND u.password_hash = crypt($2, u.password_hash)
LIMIT 1`
	var user authUser
	var storeStatus string
	err := s.db.QueryRowContext(r.Context(), q, req.AccountName, req.Password).Scan(
		&user.UserID, &user.AccountName, &user.UserName, &user.StoreID, &user.RoleID, &user.RoleName, &storeStatus,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "账号或密码错误", Data: nil})
			return
		}
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	if user.StoreID != 0 && storeStatus != "active" {
		writeJSON(w, http.StatusForbidden, response{Code: 2002, Message: "门店已停用，禁止登录", Data: nil})
		return
	}

	token, err := s.signToken(user)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{
		Code:    0,
		Message: "登录成功",
		Data: loginRes{
			UserID:      user.UserID,
			AccountName: user.AccountName,
			RoleName:    user.RoleName,
			StoreID:     user.StoreID,
			UserName:    user.UserName,
			Token:       token,
		},
	})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request, user authUser) {
	writeJSON(w, http.StatusOK, response{
		Code:    0,
		Message: "ok",
		Data: map[string]interface{}{
			"user_id":      user.UserID,
			"account_name": user.AccountName,
			"user_name":    user.UserName,
			"role_id":      user.RoleID,
			"role_name":    user.RoleName,
			"store_id":     user.StoreID,
			"permissions":  user.Permissions,
		},
	})
}

func (s *Server) handleStores(w http.ResponseWriter, r *http.Request, user authUser) {
	if r.Method == http.MethodPost {
		s.handleCreateStore(w, r, user)
		return
	}
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, response{Code: 1001, Message: "method not allowed", Data: nil})
		return
	}
	if user.RoleName != "Head" {
		writeJSON(w, http.StatusForbidden, response{Code: 2002, Message: "越权操作", Data: nil})
		return
	}

	page, limit := parsePageLimit(r)
	keyword := strings.TrimSpace(r.URL.Query().Get("keyword"))
	status := strings.TrimSpace(r.URL.Query().Get("store_status"))
	if status != "" && status != "active" && status != "inactive" {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "store_status 非法", Data: nil})
		return
	}

	where := []string{"store_id <> 0", "UPPER(store_code) <> 'HQ'", "store_name NOT ILIKE '%总部%'"}
	args := []interface{}{}
	if keyword != "" {
		args = append(args, "%"+keyword+"%")
		where = append(where, fmt.Sprintf("(store_name ILIKE $%d OR store_code ILIKE $%d)", len(args), len(args)))
	}
	if status != "" {
		args = append(args, status)
		where = append(where, fmt.Sprintf("store_status = $%d", len(args)))
	}
	whereSQL := strings.Join(where, " AND ")

	countQ := "SELECT COUNT(*) FROM stores WHERE " + whereSQL
	var total int64
	if err := s.db.QueryRowContext(r.Context(), countQ, args...).Scan(&total); err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}

	args = append(args, limit, (page-1)*limit)
	listQ := fmt.Sprintf(`
SELECT store_id, store_code, store_name, store_location, store_area, store_status
FROM stores
WHERE %s
ORDER BY store_id
LIMIT $%d OFFSET $%d`, whereSQL, len(args)-1, len(args))
	rows, err := s.db.QueryContext(r.Context(), listQ, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	defer rows.Close()

	data := make([]map[string]interface{}, 0, limit)
	for rows.Next() {
		var storeID int64
		var storeCode, storeName, location, storeStatus string
		var area float64
		if err := rows.Scan(&storeID, &storeCode, &storeName, &location, &area, &storeStatus); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
			return
		}
		data = append(data, map[string]interface{}{
			"store_id":       storeID,
			"store_code":     storeCode,
			"store_name":     storeName,
			"store_location": location,
			"store_area":     area,
			"store_status":   storeStatus,
		})
	}

	writeJSON(w, http.StatusOK, response{
		Code:    0,
		Message: "ok",
		Data: map[string]interface{}{
			"page":  page,
			"limit": limit,
			"total": total,
			"data":  data,
		},
	})
}

func (s *Server) handleStoreByID(w http.ResponseWriter, r *http.Request, user authUser) {
	if r.Method == http.MethodPut {
		s.handleUpdateStore(w, r, user)
		return
	}
	if r.Method == http.MethodDelete {
		s.handleDeleteStore(w, r, user)
		return
	}
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, response{Code: 1001, Message: "method not allowed", Data: nil})
		return
	}
	storeID, ok := parseIDFromPath(r.URL.Path, "/api/stores/")
	if !ok {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "store_id 非法", Data: nil})
		return
	}

	if user.RoleName != "Head" && user.StoreID != storeID {
		writeJSON(w, http.StatusForbidden, response{Code: 2002, Message: "越权操作", Data: nil})
		return
	}

	const q = `SELECT store_id, store_code, store_name, store_location, store_area, store_status FROM stores WHERE store_id = $1`
	var id int64
	var code, name, location, status string
	var area float64
	if err := s.db.QueryRowContext(r.Context(), q, storeID).Scan(&id, &code, &name, &location, &area, &status); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "门店不存在", Data: nil})
			return
		}
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{
		Code:    0,
		Message: "ok",
		Data: map[string]interface{}{
			"store_id":       id,
			"store_code":     code,
			"store_name":     name,
			"store_location": location,
			"store_area":     area,
			"store_status":   status,
		},
	})
}

func (s *Server) handleSKUs(w http.ResponseWriter, r *http.Request, user authUser) {
	if r.Method == http.MethodPost {
		s.handleCreateSKU(w, r, user)
		return
	}
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, response{Code: 1001, Message: "method not allowed", Data: nil})
		return
	}
	page, limit := parsePageLimit(r)
	keyword := strings.TrimSpace(r.URL.Query().Get("keyword"))
	categoryIDStr := strings.TrimSpace(r.URL.Query().Get("category_id"))

	where := []string{"1=1"}
	args := []interface{}{}
	if keyword != "" {
		args = append(args, "%"+keyword+"%")
		where = append(where, fmt.Sprintf("(s.sku_name ILIKE $%d OR s.sku_code ILIKE $%d)", len(args), len(args)))
	}
	if categoryIDStr != "" {
		categoryID, err := strconv.ParseInt(categoryIDStr, 10, 64)
		if err != nil || categoryID <= 0 {
			writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "category_id 非法", Data: nil})
			return
		}
		args = append(args, categoryID)
		where = append(where, fmt.Sprintf("s.category_id = $%d", len(args)))
	}
	whereSQL := strings.Join(where, " AND ")
	countQ := "SELECT COUNT(*) FROM skus s WHERE " + whereSQL
	var total int64
	if err := s.db.QueryRowContext(r.Context(), countQ, args...).Scan(&total); err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}

	args = append(args, limit, (page-1)*limit)
	listQ := fmt.Sprintf(`
SELECT s.sku_id, s.sku_code, s.sku_name, s.category_id, c.category_name, s.std_cost, s.sug_price, s.sku_status
FROM skus s
JOIN sku_categories c ON c.category_id = s.category_id
WHERE %s
ORDER BY s.sku_id
LIMIT $%d OFFSET $%d`, whereSQL, len(args)-1, len(args))
	rows, err := s.db.QueryContext(r.Context(), listQ, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	defer rows.Close()

	data := make([]map[string]interface{}, 0, limit)
	for rows.Next() {
		var skuID, catID int64
		var skuCode, skuName, catName, skuStatus string
		var stdCost, sugPrice float64
		if err := rows.Scan(&skuID, &skuCode, &skuName, &catID, &catName, &stdCost, &sugPrice, &skuStatus); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
			return
		}
		data = append(data, map[string]interface{}{
			"sku_id":        skuID,
			"sku_code":      skuCode,
			"sku_name":      skuName,
			"category_id":   catID,
			"category_name": catName,
			"std_cost":      stdCost,
			"sug_price":     sugPrice,
			"sku_status":    skuStatus,
		})
	}

	writeJSON(w, http.StatusOK, response{
		Code:    0,
		Message: "ok",
		Data: map[string]interface{}{
			"page":  page,
			"limit": limit,
			"total": total,
			"data":  data,
		},
	})
}

func (s *Server) handleSKUByID(w http.ResponseWriter, r *http.Request, user authUser) {
	if r.Method == http.MethodPut {
		s.handleUpdateSKU(w, r, user)
		return
	}
	if r.Method == http.MethodDelete {
		s.handleDeleteSKU(w, r, user)
		return
	}
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, response{Code: 1001, Message: "method not allowed", Data: nil})
		return
	}
	skuID, ok := parseIDFromPath(r.URL.Path, "/api/skus/")
	if !ok {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "sku_id 非法", Data: nil})
		return
	}
	const q = `
SELECT s.sku_id, s.sku_code, s.sku_name, s.category_id, c.category_name, s.std_cost, s.sug_price, s.sku_status
FROM skus s
JOIN sku_categories c ON c.category_id = s.category_id
WHERE s.sku_id = $1`
	var id, catID int64
	var code, name, catName, skuStatus string
	var stdCost, sugPrice float64
	if err := s.db.QueryRowContext(r.Context(), q, skuID).Scan(&id, &code, &name, &catID, &catName, &stdCost, &sugPrice, &skuStatus); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "SKU 不存在", Data: nil})
			return
		}
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, response{
		Code:    0,
		Message: "ok",
		Data: map[string]interface{}{
			"sku_id":        id,
			"sku_code":      code,
			"sku_name":      name,
			"category_id":   catID,
			"category_name": catName,
			"std_cost":      stdCost,
			"sug_price":     sugPrice,
			"sku_status":    skuStatus,
		},
	})
}

func (s *Server) handleCategories(w http.ResponseWriter, r *http.Request, _ authUser) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, response{Code: 1001, Message: "method not allowed", Data: nil})
		return
	}
	const q = `SELECT category_id, category_name FROM sku_categories ORDER BY category_id`
	rows, err := s.db.QueryContext(r.Context(), q)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	defer rows.Close()
	data := []map[string]interface{}{}
	for rows.Next() {
		var id int64
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
			return
		}
		data = append(data, map[string]interface{}{
			"category_id":   id,
			"category_name": name,
		})
	}
	writeJSON(w, http.StatusOK, response{Code: 0, Message: "ok", Data: data})
}

func (s *Server) handleUsers(w http.ResponseWriter, r *http.Request, user authUser) {
	if r.Method == http.MethodPost {
		s.handleCreateUser(w, r, user)
		return
	}
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, response{Code: 1001, Message: "method not allowed", Data: nil})
		return
	}
	if user.RoleName != "Head" {
		writeJSON(w, http.StatusForbidden, response{Code: 2002, Message: "越权操作", Data: nil})
		return
	}

	page, limit := parsePageLimit(r)
	roleIDStr := strings.TrimSpace(r.URL.Query().Get("role_id"))
	storeIDStr := strings.TrimSpace(r.URL.Query().Get("store_id"))

	where := []string{"u.account_name NOT LIKE '__deleted__%'"}
	args := []interface{}{}
	if roleIDStr != "" {
		roleID, err := strconv.ParseInt(roleIDStr, 10, 64)
		if err != nil || roleID <= 0 {
			writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "role_id 非法", Data: nil})
			return
		}
		args = append(args, roleID)
		where = append(where, fmt.Sprintf("u.role_id = $%d", len(args)))
	}
	if storeIDStr != "" {
		storeID, err := strconv.ParseInt(storeIDStr, 10, 64)
		if err != nil || storeID < 0 {
			writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "store_id 非法", Data: nil})
			return
		}
		args = append(args, storeID)
		where = append(where, fmt.Sprintf("u.store_id = $%d", len(args)))
	}
	whereSQL := strings.Join(where, " AND ")

	countQ := "SELECT COUNT(*) FROM app_users u WHERE " + whereSQL
	var total int64
	if err := s.db.QueryRowContext(r.Context(), countQ, args...).Scan(&total); err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}

	args = append(args, limit, (page-1)*limit)
	listQ := fmt.Sprintf(`
SELECT u.user_id, u.store_id, u.role_id, r.role_name, u.user_name, u.account_name
FROM app_users u
JOIN roles r ON r.role_id = u.role_id
WHERE %s
ORDER BY u.user_id
LIMIT $%d OFFSET $%d`, whereSQL, len(args)-1, len(args))
	rows, err := s.db.QueryContext(r.Context(), listQ, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	defer rows.Close()

	data := make([]map[string]interface{}, 0, limit)
	for rows.Next() {
		var userID, storeID, roleID int64
		var roleName, userName, accountName string
		if err := rows.Scan(&userID, &storeID, &roleID, &roleName, &userName, &accountName); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
			return
		}
		data = append(data, map[string]interface{}{
			"user_id":      userID,
			"store_id":     storeID,
			"role_id":      roleID,
			"role_name":    roleName,
			"user_name":    userName,
			"account_name": accountName,
		})
	}
	writeJSON(w, http.StatusOK, response{
		Code:    0,
		Message: "ok",
		Data: map[string]interface{}{
			"page":  page,
			"limit": limit,
			"total": total,
			"data":  data,
		},
	})
}

type authedHandler func(http.ResponseWriter, *http.Request, authUser)

func (s *Server) auth(next authedHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := s.authorize(r)
		if err != nil {
			log.Printf("auth failed path=%s err=%v", r.URL.Path, err)
			writeJSON(w, http.StatusUnauthorized, response{Code: 2001, Message: "Token 无效或已过期，请重新登录", Data: nil})
			return
		}
		next(w, r, user)
	}
}

func (s *Server) authorize(r *http.Request) (authUser, error) {
	authz := strings.TrimSpace(r.Header.Get("Authorization"))
	if authz == "" {
		return authUser{}, errors.New("missing bearer")
	}
	rawToken := extractToken(authz)
	rawToken = strings.Trim(rawToken, `"`)
	if rawToken == "" {
		return authUser{}, errors.New("empty token")
	}
	parsed, err := jwt.ParseWithClaims(rawToken, &claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return s.jwtSecret, nil
	})
	if err != nil || !parsed.Valid {
		return authUser{}, errors.New("invalid token")
	}
	c, ok := parsed.Claims.(*claims)
	if !ok {
		return authUser{}, errors.New("invalid claims")
	}

	const q = `
SELECT u.user_id, u.account_name, u.user_name, u.role_id, r.role_name, u.store_id, r.permissions
FROM app_users u
JOIN roles r ON r.role_id = u.role_id
WHERE u.user_id = $1`
	var user authUser
	var permissionsRaw []byte
	if err := s.db.QueryRowContext(r.Context(), q, c.UserID).Scan(
		&user.UserID, &user.AccountName, &user.UserName, &user.RoleID, &user.RoleName, &user.StoreID, &permissionsRaw,
	); err != nil {
		return authUser{}, errors.New("user not found")
	}
	user.Permissions = parsePermissions(permissionsRaw)
	return user, nil
}

func extractToken(authz string) string {
	s := strings.TrimSpace(authz)
	if s == "" {
		return ""
	}
	parts := strings.Fields(s)
	if len(parts) == 0 {
		return ""
	}
	// 标准形态：Bearer <token>；也兼容 bearer / Bearer Bearer <token> 等误输情况。
	last := parts[len(parts)-1]
	if strings.EqualFold(last, "bearer") {
		return ""
	}
	return strings.TrimSpace(last)
}

func parsePermissions(raw []byte) []string {
	if len(raw) == 0 {
		return []string{}
	}
	var obj map[string]interface{}
	if err := json.Unmarshal(raw, &obj); err != nil {
		return []string{}
	}
	scopesValue, ok := obj["scopes"]
	if !ok {
		return []string{}
	}
	scopes, ok := scopesValue.([]interface{})
	if !ok {
		return []string{}
	}
	out := make([]string, 0, len(scopes))
	for _, scope := range scopes {
		s, ok := scope.(string)
		if ok {
			out = append(out, s)
		}
	}
	return out
}

func (s *Server) signToken(user authUser) (string, error) {
	c := claims{
		UserID:   user.UserID,
		RoleID:   user.RoleID,
		StoreID:  user.StoreID,
		RoleName: user.RoleName,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			Issuer:    "foundation-data",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, c)
	return token.SignedString(s.jwtSecret)
}

func parsePageLimit(r *http.Request) (int, int) {
	page := 1
	limit := 10
	if raw := r.URL.Query().Get("page"); raw != "" {
		if p, err := strconv.Atoi(raw); err == nil && p > 0 {
			page = p
		}
	}
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if l, err := strconv.Atoi(raw); err == nil && l > 0 {
			if l > 100 {
				l = 100
			}
			limit = l
		}
	}
	return page, limit
}

func parseIDFromPath(path, prefix string) (int64, bool) {
	if !strings.HasPrefix(path, prefix) {
		return 0, false
	}
	remain := strings.TrimPrefix(path, prefix)
	remain = strings.Trim(remain, "/")
	if remain == "" || strings.Contains(remain, "/") {
		return 0, false
	}
	id, err := strconv.ParseInt(remain, 10, 64)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func (s *Server) handleSwaggerUI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>foundation-data API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "/swagger/openapi.json",
      dom_id: "#swagger-ui",
    });
  </script>
</body>
</html>`))
}

func (s *Server) handleOpenAPI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{
  "openapi":"3.0.3",
  "info":{"title":"Aegis Foundation Data API","version":"0.1.0"},
  "servers":[{"url":"http://localhost:8081"}],
  "components":{
    "securitySchemes":{
      "bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}
    },
    "schemas":{
      "LoginReq":{
        "type":"object",
        "required":["account_name","password"],
        "properties":{
          "account_name":{"type":"string","example":"head001"},
          "password":{"type":"string","example":"123456"}
        }
      },
      "ApiEnvelope":{
        "type":"object",
        "properties":{
          "code":{"type":"integer","example":0},
          "message":{"type":"string","example":"ok"},
          "data":{"type":"object","nullable":true}
        }
      }
    }
  },
  "paths":{
    "/health":{"get":{"summary":"健康检查","responses":{"200":{"description":"ok"},"503":{"description":"db down"}}}},
    "/api/auth/login":{
      "post":{
        "summary":"登录",
        "requestBody":{
          "required":true,
          "content":{
            "application/json":{
              "schema":{"$ref":"#/components/schemas/LoginReq"}
            }
          }
        },
        "responses":{
          "200":{"description":"登录成功","content":{"application/json":{"schema":{"$ref":"#/components/schemas/ApiEnvelope"}}}},
          "400":{"description":"账号或密码错误","content":{"application/json":{"schema":{"$ref":"#/components/schemas/ApiEnvelope"}}}}
        }
      }
    },
    "/api/auth/me":{"get":{"summary":"当前用户","security":[{"bearerAuth":[]}],"responses":{"200":{"description":"ok"},"401":{"description":"token invalid"}}}},
    "/api/stores":{"get":{"summary":"门店列表","security":[{"bearerAuth":[]}],"responses":{"200":{"description":"ok"}}}},
    "/api/stores/{store_id}":{"get":{"summary":"门店详情","security":[{"bearerAuth":[]}],"parameters":[{"name":"store_id","in":"path","required":true,"schema":{"type":"integer"}}],"responses":{"200":{"description":"ok"}}}},
    "/api/skus":{"get":{"summary":"SKU 列表","security":[{"bearerAuth":[]}],"responses":{"200":{"description":"ok"}}}},
    "/api/skus/{sku_id}":{"get":{"summary":"SKU 详情","security":[{"bearerAuth":[]}],"parameters":[{"name":"sku_id","in":"path","required":true,"schema":{"type":"integer"}}],"responses":{"200":{"description":"ok"}}}},
    "/api/sku-categories":{"get":{"summary":"SKU 分类列表","security":[{"bearerAuth":[]}],"responses":{"200":{"description":"ok"}}}},
    "/api/users":{"get":{"summary":"用户列表","security":[{"bearerAuth":[]}],"responses":{"200":{"description":"ok"}}}}
  }
}`))
}
