package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"strconv"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/descriptorpb"
	"google.golang.org/protobuf/types/dynamicpb"
)

type storeBusinessGRPC struct {
	db   *sql.DB
	desc storeBusinessDescriptors
}

type storeBusinessDescriptors struct {
	snapshotRequest          protoreflect.MessageDescriptor
	snapshotResponse         protoreflect.MessageDescriptor
	inventoryItem            protoreflect.MessageDescriptor
	dailySalesSnapshot       protoreflect.MessageDescriptor
	skuSalesDetail           protoreflect.MessageDescriptor
	pushCustomerFlowRequest  protoreflect.MessageDescriptor
	pushCustomerFlowResponse protoreflect.MessageDescriptor
	syncDiagnosisRequest     protoreflect.MessageDescriptor
	syncDiagnosisResponse    protoreflect.MessageDescriptor
	createAITransferRequest  protoreflect.MessageDescriptor
	transferDetail           protoreflect.MessageDescriptor
	createAITransferResponse protoreflect.MessageDescriptor
}

func RegisterGRPC(grpcServer *grpc.Server, db *sql.DB) error {
	desc, err := loadStoreBusinessDescriptors()
	if err != nil {
		return err
	}
	svc := &storeBusinessGRPC{db: db, desc: desc}
	grpcServer.RegisterService(&grpc.ServiceDesc{
		ServiceName: "storebusiness.StoreBusinessService",
		HandlerType: (*interface{})(nil),
		Methods: []grpc.MethodDesc{
			{MethodName: "GetBusinessSnapshot", Handler: svc.getBusinessSnapshotHandler},
			{MethodName: "PushCustomerFlow", Handler: svc.pushCustomerFlowHandler},
			{MethodName: "SyncInventoryDiagnosis", Handler: svc.syncInventoryDiagnosisHandler},
			{MethodName: "CreateAITransferOrder", Handler: svc.createAITransferOrderHandler},
		},
		Streams:  []grpc.StreamDesc{},
		Metadata: "store_business_service.proto",
	}, svc)
	return nil
}

func loadStoreBusinessDescriptors() (storeBusinessDescriptors, error) {
	raw := []byte("\n\x1cstore_business_service.proto\x12\rstorebusiness\"I\n\x0fSnapshotRequest\x12\x10\n\x08store_id\x18\x01 \x01(\x05\x12\x12\n\nstart_date\x18\x02 \x01(\t\x12\x10\n\x08end_date\x18\x03 \x01(\t\"\xc5\x03\n\x10SnapshotResponse\x12H\n\x11current_inventory\x18\x01 \x03(\x0b\x32-.storebusiness.SnapshotResponse.InventoryItem\x12L\n\x10daily_sales_list\x18\x02 \x03(\x0b\x32\x32.storebusiness.SnapshotResponse.DailySalesSnapshot\x1a\x38\n\rInventoryItem\x12\x0e\n\x06sku_id\x18\x01 \x01(\x05\x12\x17\n\x0factual_quantity\x18\x02 \x01(\x05\x1a\xde\x01\n\x12DailySalesSnapshot\x12\x12\n\nsales_date\x18\x01 \x01(\t\x12\x14\n\x0ctotal_income\x18\x02 \x01(\x01\x12\x14\n\x0ctotal_orders\x18\x03 \x01(\x05\x12R\n\x07details\x18\x04 \x03(\x0b\x32A.storebusiness.SnapshotResponse.DailySalesSnapshot.SkuSalesDetail\x1a\x34\n\x0eSkuSalesDetail\x12\x0e\n\x06sku_id\x18\x01 \x01(\x05\x12\x12\n\nsku_amount\x18\x02 \x01(\x05\"\x8f\x01\n\x17PushCustomerFlowRequest\x12\x10\n\x08store_id\x18\x01 \x01(\x05\x12\x18\n\x10record_timestamp\x18\x02 \x01(\t\x12\x1b\n\x13customer_start_time\x18\x03 \x01(\t\x12\x19\n\x11customer_end_time\x18\x04 \x01(\t\x12\x10\n\x08in_count\x18\x05 \x01(\x05\"+\n\x18PushCustomerFlowResponse\x12\x0f\n\x07success\x18\x01 \x01(\x08\"\x7f\n\x14SyncDiagnosisRequest\x12\x10\n\x08store_id\x18\x01 \x01(\x05\x12\x0e\n\x06sku_id\x18\x02 \x01(\x05\x12'\n\x1finventory_diagnosis_result_type\x18\x03 \x01(\t\x12\x1c\n\x14inventory_root_cause\x18\x04 \x01(\t\"(\n\x15SyncDiagnosisResponse\x12\x0f\n\x07success\x18\x01 \x01(\x08\"\xde\x01\n\x17CreateAiTransferRequest\x12\x10\n\x08store_id\x18\x01 \x01(\x05\x12F\n\x07details\x18\x02 \x03(\x0b\x325.storebusiness.CreateAiTransferRequest.TransferDetail\x12\x14\n\x0cai_reasoning\x18\x03 \x01(\t\x1aS\n\x0eTransferDetail\x12\x0e\n\x06sku_id\x18\x01 \x01(\x05\x12\x15\n\rsuggested_qty\x18\x02 \x01(\x05\x12\x1a\n\x12transfer_direction\x18\x03 \x01(\t\"A\n\x18CreateAiTransferResponse\x12\x14\n\x0cnew_order_id\x18\x01 \x01(\x05\x12\x0f\n\x07success\x18\x02 \x01(\x082\xa2\x03\n\x14StoreBusinessService\x12V\n\x13GetBusinessSnapshot\x12\x1e.storebusiness.SnapshotRequest\x1a\x1f.storebusiness.SnapshotResponse\x12c\n\x10PushCustomerFlow\x12&.storebusiness.PushCustomerFlowRequest\x1a'.storebusiness.PushCustomerFlowResponse\x12c\n\x16SyncInventoryDiagnosis\x12#.storebusiness.SyncDiagnosisRequest\x1a$.storebusiness.SyncDiagnosisResponse\x12h\n\x15CreateAITransferOrder\x12&.storebusiness.CreateAiTransferRequest\x1a'.storebusiness.CreateAiTransferResponseb\x06proto3")
	var fd descriptorpb.FileDescriptorProto
	if err := proto.Unmarshal(raw, &fd); err != nil {
		return storeBusinessDescriptors{}, err
	}
	file, err := protodesc.NewFile(&fd, nil)
	if err != nil {
		return storeBusinessDescriptors{}, err
	}
	msgs := file.Messages()
	snapshotResponse := msgs.ByName("SnapshotResponse")
	dailySales := snapshotResponse.Messages().ByName("DailySalesSnapshot")
	createReq := msgs.ByName("CreateAiTransferRequest")
	return storeBusinessDescriptors{
		snapshotRequest:          msgs.ByName("SnapshotRequest"),
		snapshotResponse:         snapshotResponse,
		inventoryItem:            snapshotResponse.Messages().ByName("InventoryItem"),
		dailySalesSnapshot:       dailySales,
		skuSalesDetail:           dailySales.Messages().ByName("SkuSalesDetail"),
		pushCustomerFlowRequest:  msgs.ByName("PushCustomerFlowRequest"),
		pushCustomerFlowResponse: msgs.ByName("PushCustomerFlowResponse"),
		syncDiagnosisRequest:     msgs.ByName("SyncDiagnosisRequest"),
		syncDiagnosisResponse:    msgs.ByName("SyncDiagnosisResponse"),
		createAITransferRequest:  createReq,
		transferDetail:           createReq.Messages().ByName("TransferDetail"),
		createAITransferResponse: msgs.ByName("CreateAiTransferResponse"),
	}, nil
}

func (s *storeBusinessGRPC) getBusinessSnapshotHandler(_ interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	req := dynamicpb.NewMessage(s.desc.snapshotRequest)
	if err := dec(req); err != nil {
		return nil, err
	}
	handler := func(ctx context.Context, in interface{}) (interface{}, error) {
		return s.getBusinessSnapshot(ctx, in.(*dynamicpb.Message))
	}
	if interceptor == nil {
		return handler(ctx, req)
	}
	return interceptor(ctx, req, &grpc.UnaryServerInfo{Server: s, FullMethod: "/storebusiness.StoreBusinessService/GetBusinessSnapshot"}, handler)
}

func (s *storeBusinessGRPC) pushCustomerFlowHandler(_ interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	req := dynamicpb.NewMessage(s.desc.pushCustomerFlowRequest)
	if err := dec(req); err != nil {
		return nil, err
	}
	handler := func(ctx context.Context, in interface{}) (interface{}, error) {
		return s.pushCustomerFlow(ctx, in.(*dynamicpb.Message))
	}
	if interceptor == nil {
		return handler(ctx, req)
	}
	return interceptor(ctx, req, &grpc.UnaryServerInfo{Server: s, FullMethod: "/storebusiness.StoreBusinessService/PushCustomerFlow"}, handler)
}

func (s *storeBusinessGRPC) syncInventoryDiagnosisHandler(_ interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	req := dynamicpb.NewMessage(s.desc.syncDiagnosisRequest)
	if err := dec(req); err != nil {
		return nil, err
	}
	handler := func(ctx context.Context, in interface{}) (interface{}, error) {
		return s.syncInventoryDiagnosis(ctx, in.(*dynamicpb.Message))
	}
	if interceptor == nil {
		return handler(ctx, req)
	}
	return interceptor(ctx, req, &grpc.UnaryServerInfo{Server: s, FullMethod: "/storebusiness.StoreBusinessService/SyncInventoryDiagnosis"}, handler)
}

func (s *storeBusinessGRPC) createAITransferOrderHandler(_ interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	req := dynamicpb.NewMessage(s.desc.createAITransferRequest)
	if err := dec(req); err != nil {
		return nil, err
	}
	handler := func(ctx context.Context, in interface{}) (interface{}, error) {
		return s.createAITransferOrder(ctx, in.(*dynamicpb.Message))
	}
	if interceptor == nil {
		return handler(ctx, req)
	}
	return interceptor(ctx, req, &grpc.UnaryServerInfo{Server: s, FullMethod: "/storebusiness.StoreBusinessService/CreateAITransferOrder"}, handler)
}

func (s *storeBusinessGRPC) getBusinessSnapshot(ctx context.Context, req *dynamicpb.Message) (*dynamicpb.Message, error) {
	storeID := req.Get(s.desc.snapshotRequest.Fields().ByName("store_id")).Int()
	startDate := req.Get(s.desc.snapshotRequest.Fields().ByName("start_date")).String()
	endDate := req.Get(s.desc.snapshotRequest.Fields().ByName("end_date")).String()
	if storeID <= 0 {
		return nil, status.Error(codes.InvalidArgument, "store_id must be positive")
	}
	if _, err := parseDate(startDate); err != nil {
		return nil, status.Error(codes.InvalidArgument, "start_date invalid")
	}
	if _, err := parseDate(endDate); err != nil {
		return nil, status.Error(codes.InvalidArgument, "end_date invalid")
	}
	resp := dynamicpb.NewMessage(s.desc.snapshotResponse)
	if err := s.fillSnapshotInventory(ctx, resp, storeID); err != nil {
		return nil, err
	}
	if err := s.fillSnapshotSales(ctx, resp, storeID, startDate, endDate); err != nil {
		return nil, err
	}
	return resp, nil
}

func (s *storeBusinessGRPC) fillSnapshotInventory(ctx context.Context, resp *dynamicpb.Message, storeID int64) error {
	rows, err := s.db.QueryContext(ctx, `SELECT sku_id, actual_quantity FROM inventories WHERE store_id = $1 ORDER BY sku_id`, storeID)
	if err != nil {
		return status.Error(codes.Internal, "query inventory failed")
	}
	defer rows.Close()
	list := resp.Mutable(s.desc.snapshotResponse.Fields().ByName("current_inventory")).List()
	for rows.Next() {
		item := dynamicpb.NewMessage(s.desc.inventoryItem)
		var skuID, qty int32
		if err := rows.Scan(&skuID, &qty); err != nil {
			return status.Error(codes.Internal, "scan inventory failed")
		}
		item.Set(s.desc.inventoryItem.Fields().ByName("sku_id"), protoreflect.ValueOfInt32(skuID))
		item.Set(s.desc.inventoryItem.Fields().ByName("actual_quantity"), protoreflect.ValueOfInt32(qty))
		list.Append(protoreflect.ValueOfMessage(item))
	}
	return rows.Err()
}

func (s *storeBusinessGRPC) fillSnapshotSales(ctx context.Context, resp *dynamicpb.Message, storeID int64, startDate, endDate string) error {
	rows, err := s.db.QueryContext(ctx, `
SELECT sales_id, to_char(sales_date, 'YYYY-MM-DD'), total_income, total_orders
FROM sales_daily
WHERE store_id = $1 AND sales_date >= $2 AND sales_date <= $3
ORDER BY sales_date`, storeID, startDate, endDate)
	if err != nil {
		return status.Error(codes.Internal, "query sales failed")
	}
	defer rows.Close()
	list := resp.Mutable(s.desc.snapshotResponse.Fields().ByName("daily_sales_list")).List()
	for rows.Next() {
		var salesID int64
		var salesDate string
		var income float64
		var orders int32
		if err := rows.Scan(&salesID, &salesDate, &income, &orders); err != nil {
			return status.Error(codes.Internal, "scan sales failed")
		}
		sale := dynamicpb.NewMessage(s.desc.dailySalesSnapshot)
		sale.Set(s.desc.dailySalesSnapshot.Fields().ByName("sales_date"), protoreflect.ValueOfString(salesDate))
		sale.Set(s.desc.dailySalesSnapshot.Fields().ByName("total_income"), protoreflect.ValueOfFloat64(income))
		sale.Set(s.desc.dailySalesSnapshot.Fields().ByName("total_orders"), protoreflect.ValueOfInt32(orders))
		if err := s.fillSnapshotSalesDetails(ctx, sale, salesID); err != nil {
			return err
		}
		list.Append(protoreflect.ValueOfMessage(sale))
	}
	return rows.Err()
}

func (s *storeBusinessGRPC) fillSnapshotSalesDetails(ctx context.Context, sale *dynamicpb.Message, salesID int64) error {
	rows, err := s.db.QueryContext(ctx, `SELECT sku_id, sku_amount FROM sales_details WHERE sales_id = $1 ORDER BY detail_id`, salesID)
	if err != nil {
		return status.Error(codes.Internal, "query sales details failed")
	}
	defer rows.Close()
	list := sale.Mutable(s.desc.dailySalesSnapshot.Fields().ByName("details")).List()
	for rows.Next() {
		var skuID, amount int32
		if err := rows.Scan(&skuID, &amount); err != nil {
			return status.Error(codes.Internal, "scan sales details failed")
		}
		detail := dynamicpb.NewMessage(s.desc.skuSalesDetail)
		detail.Set(s.desc.skuSalesDetail.Fields().ByName("sku_id"), protoreflect.ValueOfInt32(skuID))
		detail.Set(s.desc.skuSalesDetail.Fields().ByName("sku_amount"), protoreflect.ValueOfInt32(amount))
		list.Append(protoreflect.ValueOfMessage(detail))
	}
	return rows.Err()
}

func (s *storeBusinessGRPC) pushCustomerFlow(ctx context.Context, req *dynamicpb.Message) (*dynamicpb.Message, error) {
	fields := s.desc.pushCustomerFlowRequest.Fields()
	storeID := req.Get(fields.ByName("store_id")).Int()
	recordTS := req.Get(fields.ByName("record_timestamp")).String()
	startTime := req.Get(fields.ByName("customer_start_time")).String()
	endTime := req.Get(fields.ByName("customer_end_time")).String()
	inCount := req.Get(fields.ByName("in_count")).Int()
	if storeID <= 0 || recordTS == "" || inCount < 0 {
		return nil, status.Error(codes.InvalidArgument, "invalid customer flow")
	}
	if _, err := time.Parse(time.RFC3339, recordTS); err != nil {
		return nil, status.Error(codes.InvalidArgument, "record_timestamp invalid")
	}
	if _, err := s.db.ExecContext(ctx, `
INSERT INTO customer_logs (store_id, record_timestamp, customer_start_time, customer_end_time, in_count)
VALUES ($1, $2, NULLIF($3, '')::timestamptz, NULLIF($4, '')::timestamptz, $5)`, storeID, recordTS, startTime, endTime, inCount); err != nil {
		return nil, status.Error(codes.Internal, "insert customer flow failed")
	}
	resp := dynamicpb.NewMessage(s.desc.pushCustomerFlowResponse)
	resp.Set(s.desc.pushCustomerFlowResponse.Fields().ByName("success"), protoreflect.ValueOfBool(true))
	return resp, nil
}

func (s *storeBusinessGRPC) syncInventoryDiagnosis(ctx context.Context, req *dynamicpb.Message) (*dynamicpb.Message, error) {
	fields := s.desc.syncDiagnosisRequest.Fields()
	storeID := req.Get(fields.ByName("store_id")).Int()
	skuID := req.Get(fields.ByName("sku_id")).Int()
	resultType := req.Get(fields.ByName("inventory_diagnosis_result_type")).String()
	rootCause := req.Get(fields.ByName("inventory_root_cause")).String()
	if storeID <= 0 || skuID <= 0 || !validDiagnosisType(resultType) || rootCause == "" {
		return nil, status.Error(codes.InvalidArgument, "invalid diagnosis")
	}
	if !json.Valid([]byte(rootCause)) {
		rootCause = strconv.Quote(rootCause)
	}
	if _, err := s.db.ExecContext(ctx, `
INSERT INTO ai_inventory_diagnoses (store_id, sku_id, inventory_diagnosis_result_type, inventory_root_cause)
VALUES ($1, $2, $3, $4::jsonb)`, storeID, skuID, resultType, rootCause); err != nil {
		return nil, status.Error(codes.Internal, "sync inventory diagnosis failed")
	}
	resp := dynamicpb.NewMessage(s.desc.syncDiagnosisResponse)
	resp.Set(s.desc.syncDiagnosisResponse.Fields().ByName("success"), protoreflect.ValueOfBool(true))
	return resp, nil
}

func (s *storeBusinessGRPC) createAITransferOrder(ctx context.Context, req *dynamicpb.Message) (*dynamicpb.Message, error) {
	fields := s.desc.createAITransferRequest.Fields()
	storeID := req.Get(fields.ByName("store_id")).Int()
	if storeID <= 0 {
		return nil, status.Error(codes.InvalidArgument, "store_id must be positive")
	}
	list := req.Get(fields.ByName("details")).List()
	details := make([]transferDetailReq, 0, list.Len())
	for i := 0; i < list.Len(); i++ {
		msg := list.Get(i).Message()
		detailFields := s.desc.transferDetail.Fields()
		suggestedQty := int(msg.Get(detailFields.ByName("suggested_qty")).Int())
		detail := transferDetailReq{
			SKUID:             msg.Get(detailFields.ByName("sku_id")).Int(),
			SuggestedQty:      suggestedQty,
			ActualQty:         suggestedQty,
			TransferDirection: msg.Get(detailFields.ByName("transfer_direction")).String(),
		}
		if !validTransferCreate(transferCreateReq{StoreID: storeID, Details: []transferDetailReq{detail}}) {
			return nil, status.Error(codes.InvalidArgument, "invalid transfer detail")
		}
		details = append(details, detail)
	}
	orderID, err := (&Server{db: s.db}).createTransferOrder(ctx, storeID, details, statusAIGenerated)
	if err != nil {
		return nil, status.Error(codes.Internal, "create ai transfer order failed")
	}
	resp := dynamicpb.NewMessage(s.desc.createAITransferResponse)
	resp.Set(s.desc.createAITransferResponse.Fields().ByName("new_order_id"), protoreflect.ValueOfInt32(int32(orderID)))
	resp.Set(s.desc.createAITransferResponse.Fields().ByName("success"), protoreflect.ValueOfBool(true))
	return resp, nil
}
