package app

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	pb "aegis/foundation-data/internal/proto/basicdata"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type BasicDataGRPCServer struct {
	pb.UnimplementedBasicDataServiceServer
	db *sql.DB
}

func RegisterGRPC(grpcServer *grpc.Server, db *sql.DB) {
	pb.RegisterBasicDataServiceServer(grpcServer, &BasicDataGRPCServer{db: db})
}

func (s *BasicDataGRPCServer) GetSkuDictionary(ctx context.Context, req *pb.SkuDictRequest) (*pb.SkuDictResponse, error) {
	whereSQL := ""
	args := []interface{}{}
	if len(req.GetSkuIds()) > 0 {
		placeholders := make([]string, 0, len(req.GetSkuIds()))
		for _, skuID := range req.GetSkuIds() {
			if skuID <= 0 {
				return nil, status.Error(codes.InvalidArgument, "sku_id must be positive")
			}
			args = append(args, skuID)
			placeholders = append(placeholders, fmt.Sprintf("$%d", len(args)))
		}
		whereSQL = "WHERE s.sku_id IN (" + strings.Join(placeholders, ",") + ")"
	}

	query := fmt.Sprintf(`
SELECT s.sku_id, s.sku_code, s.sku_name, c.category_name, s.std_cost, s.sug_price, s.sku_status
FROM skus s
JOIN sku_categories c ON c.category_id = s.category_id
%s
ORDER BY s.sku_id`, whereSQL)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, status.Error(codes.Internal, "query sku dictionary failed")
	}
	defer rows.Close()

	resp := &pb.SkuDictResponse{Skus: []*pb.SkuDictResponse_SkuInfo{}}
	for rows.Next() {
		var sku pb.SkuDictResponse_SkuInfo
		if err := rows.Scan(&sku.SkuId, &sku.SkuCode, &sku.SkuName, &sku.CategoryName, &sku.StdCost, &sku.SugPrice, &sku.SkuStatus); err != nil {
			return nil, status.Error(codes.Internal, "scan sku dictionary failed")
		}
		resp.Skus = append(resp.Skus, &sku)
	}
	if err := rows.Err(); err != nil {
		return nil, status.Error(codes.Internal, "read sku dictionary failed")
	}
	return resp, nil
}

func (s *BasicDataGRPCServer) GetStoreContext(ctx context.Context, req *pb.StoreContextRequest) (*pb.StoreContextResponse, error) {
	if req.GetStoreId() < 0 {
		return nil, status.Error(codes.InvalidArgument, "store_id must be non-negative")
	}

	const q = `
SELECT store_id, store_code, store_name, store_location, store_area, store_status
FROM stores
WHERE store_id = $1`
	var resp pb.StoreContextResponse
	err := s.db.QueryRowContext(ctx, q, req.GetStoreId()).Scan(
		&resp.StoreId,
		&resp.StoreCode,
		&resp.StoreName,
		&resp.StoreLocation,
		&resp.StoreArea,
		&resp.StoreStatus,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, status.Error(codes.NotFound, "store not found")
		}
		return nil, status.Error(codes.Internal, "query store context failed")
	}
	return &resp, nil
}

func (s *BasicDataGRPCServer) ListStores(ctx context.Context, req *pb.ListStoresRequest) (*pb.ListStoresResponse, error) {
	storeStatus := strings.TrimSpace(req.GetStoreStatus())
	if storeStatus == "" {
		storeStatus = "active"
	}
	if storeStatus != "active" && storeStatus != "inactive" && storeStatus != "all" {
		return nil, status.Error(codes.InvalidArgument, "store_status must be active, inactive, or all")
	}

	whereSQL := "store_id > 0"
	args := []interface{}{}
	if storeStatus != "all" {
		args = append(args, storeStatus)
		whereSQL += " AND store_status = $1"
	}

	rows, err := s.db.QueryContext(ctx, `
SELECT store_id, store_code, store_name, store_location, store_area, store_status
FROM stores
WHERE `+whereSQL+`
ORDER BY store_id`, args...)
	if err != nil {
		return nil, status.Error(codes.Internal, "query stores failed")
	}
	defer rows.Close()

	resp := &pb.ListStoresResponse{Stores: []*pb.StoreContextResponse{}}
	for rows.Next() {
		var store pb.StoreContextResponse
		if err := rows.Scan(
			&store.StoreId,
			&store.StoreCode,
			&store.StoreName,
			&store.StoreLocation,
			&store.StoreArea,
			&store.StoreStatus,
		); err != nil {
			return nil, status.Error(codes.Internal, "scan stores failed")
		}
		resp.Stores = append(resp.Stores, &store)
	}
	if err := rows.Err(); err != nil {
		return nil, status.Error(codes.Internal, "read stores failed")
	}
	return resp, nil
}
