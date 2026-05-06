package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	statusAIGenerated               = "ai_generated"
	statusPendingApproval           = "pending_approval"
	statusIssuedPendingConfirmation = "issued_pending_confirmation"
	statusInNegotiation             = "in_negotiation"
	statusConfirmedExecuted         = "confirmed_executed"
	statusCancelled                 = "cancelled"
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
}

type authedHandler func(http.ResponseWriter, *http.Request, authUser)

func NewServer(db *sql.DB, jwtSecret string) *Server {
	return &Server{db: db, jwtSecret: []byte(jwtSecret)}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/swagger", s.handleSwaggerUI)
	mux.HandleFunc("/swagger/", s.handleSwaggerUI)
	mux.HandleFunc("/swagger/openapi.json", s.handleOpenAPI)
	mux.HandleFunc("/api/sales/daily", s.auth(s.handleSalesDaily))
	mux.HandleFunc("/api/sales/daily/", s.auth(s.handleSalesDailyByID))
	mux.HandleFunc("/api/inventory", s.auth(s.handleInventory))
	mux.HandleFunc("/api/inventory/adjust", s.auth(s.handleInventoryAdjust))
	mux.HandleFunc("/api/transfers", s.auth(s.handleTransfers))
	mux.HandleFunc("/api/transfers/", s.auth(s.handleTransferAction))
	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := s.db.PingContext(ctx); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, response{Code: 5001, Message: "database unavailable", Data: nil})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"service": "store-ops", "status": "ok"})
}

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
	rawToken := extractToken(r.Header.Get("Authorization"))
	if rawToken == "" {
		return authUser{}, errors.New("missing bearer")
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
SELECT u.user_id, u.account_name, u.user_name, u.role_id, r.role_name, u.store_id
FROM app_users u
JOIN roles r ON r.role_id = u.role_id
WHERE u.user_id = $1`
	var user authUser
	if err := s.db.QueryRowContext(r.Context(), q, c.UserID).Scan(
		&user.UserID, &user.AccountName, &user.UserName, &user.RoleID, &user.RoleName, &user.StoreID,
	); err != nil {
		return authUser{}, errors.New("user not found")
	}
	return user, nil
}

func extractToken(authz string) string {
	parts := strings.Fields(strings.TrimSpace(strings.Trim(authz, `"`)))
	if len(parts) == 0 {
		return ""
	}
	last := parts[len(parts)-1]
	if strings.EqualFold(last, "bearer") {
		return ""
	}
	return strings.TrimSpace(last)
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func parsePageLimit(r *http.Request) (int, int) {
	page, limit := 1, 10
	if raw := r.URL.Query().Get("page"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			page = v
		}
	}
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			if v > 100 {
				v = 100
			}
			limit = v
		}
	}
	return page, limit
}

func parseIDFromPath(path, prefix string) (int64, bool) {
	if !strings.HasPrefix(path, prefix) {
		return 0, false
	}
	remain := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if remain == "" || strings.Contains(remain, "/") {
		return 0, false
	}
	id, err := strconv.ParseInt(remain, 10, 64)
	return id, err == nil && id > 0
}

func parseActionPath(path string) (int64, string, bool) {
	const prefix = "/api/transfers/"
	if !strings.HasPrefix(path, prefix) {
		return 0, "", false
	}
	parts := strings.Split(strings.Trim(strings.TrimPrefix(path, prefix), "/"), "/")
	if len(parts) != 2 {
		return 0, "", false
	}
	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || id <= 0 || parts[1] == "" {
		return 0, "", false
	}
	return id, parts[1], true
}

func requireHead(w http.ResponseWriter, user authUser) bool {
	if user.RoleName == "Head" {
		return true
	}
	writeJSON(w, http.StatusForbidden, response{Code: 2002, Message: "越权操作", Data: nil})
	return false
}

func requireStore(w http.ResponseWriter, user authUser) bool {
	if user.RoleName == "Store" {
		return true
	}
	writeJSON(w, http.StatusForbidden, response{Code: 2002, Message: "越权操作", Data: nil})
	return false
}

func storeScope(w http.ResponseWriter, user authUser, requested int64) (int64, bool) {
	if user.RoleName == "Head" {
		if requested < 0 {
			writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "store_id 非法", Data: nil})
			return 0, false
		}
		return requested, true
	}
	if requested != 0 && requested != user.StoreID {
		writeJSON(w, http.StatusForbidden, response{Code: 2002, Message: "越权操作", Data: nil})
		return 0, false
	}
	return user.StoreID, true
}

func parseInt64Query(r *http.Request, key string) (int64, bool, error) {
	raw := strings.TrimSpace(r.URL.Query().Get(key))
	if raw == "" {
		return 0, false, nil
	}
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return 0, true, err
	}
	return v, true, nil
}

func parseDate(raw string) (time.Time, error) {
	return time.ParseInLocation("2006-01-02", raw, time.Local)
}

func validTransferStatus(status string) bool {
	switch status {
	case statusAIGenerated, statusPendingApproval, statusIssuedPendingConfirmation, statusInNegotiation, statusConfirmedExecuted, statusCancelled:
		return true
	default:
		return false
	}
}

func isTerminalStatus(status string) bool {
	return status == statusConfirmedExecuted || status == statusCancelled
}
