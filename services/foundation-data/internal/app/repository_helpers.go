package app

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
)

func requireHead(w http.ResponseWriter, user authUser) bool {
	if user.RoleName == "Head" {
		return true
	}
	writeJSON(w, http.StatusForbidden, response{Code: 2002, Message: "越权操作", Data: nil})
	return false
}

func validStoreStatus(status string) bool {
	return status == "active" || status == "inactive"
}

func validSKUStatus(status string) bool {
	return status == "sale" || status == "unsale"
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "SQLSTATE 23505") || strings.Contains(msg, "duplicate key value")
}

func (s *Server) storeByID(ctx context.Context, storeID int64) (map[string]interface{}, error) {
	const q = `SELECT store_id, store_code, store_name, store_location, store_area, store_status FROM stores WHERE store_id = $1`
	var id int64
	var code, name, location, status string
	var area float64
	if err := s.db.QueryRowContext(ctx, q, storeID).Scan(&id, &code, &name, &location, &area, &status); err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"store_id":       id,
		"store_code":     code,
		"store_name":     name,
		"store_location": location,
		"store_area":     area,
		"store_status":   status,
	}, nil
}

func (s *Server) skuByID(ctx context.Context, skuID int64) (map[string]interface{}, error) {
	const q = `
SELECT s.sku_id, s.sku_code, s.sku_name, s.category_id, c.category_name, s.std_cost, s.sug_price, s.sku_status
FROM skus s
JOIN sku_categories c ON c.category_id = s.category_id
WHERE s.sku_id = $1`
	var id, catID int64
	var code, name, catName, skuStatus string
	var stdCost, sugPrice float64
	if err := s.db.QueryRowContext(ctx, q, skuID).Scan(&id, &code, &name, &catID, &catName, &stdCost, &sugPrice, &skuStatus); err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"sku_id":        id,
		"sku_code":      code,
		"sku_name":      name,
		"category_id":   catID,
		"category_name": catName,
		"std_cost":      stdCost,
		"sug_price":     sugPrice,
		"sku_status":    skuStatus,
	}, nil
}

func (s *Server) userByID(ctx context.Context, userID int64) (map[string]interface{}, error) {
	const q = `
SELECT u.user_id, u.store_id, u.role_id, r.role_name, u.user_name, u.account_name
FROM app_users u
JOIN roles r ON r.role_id = u.role_id
WHERE u.user_id = $1`
	var id, storeID, roleID int64
	var roleName, userName, accountName string
	if err := s.db.QueryRowContext(ctx, q, userID).Scan(&id, &storeID, &roleID, &roleName, &userName, &accountName); err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"user_id":      id,
		"store_id":     storeID,
		"role_id":      roleID,
		"role_name":    roleName,
		"user_name":    userName,
		"account_name": accountName,
	}, nil
}

func notFound(err error) bool {
	return err == sql.ErrNoRows
}
