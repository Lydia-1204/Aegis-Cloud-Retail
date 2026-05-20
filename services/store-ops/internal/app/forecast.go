package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/descriptorpb"
	"google.golang.org/protobuf/types/dynamicpb"
)

const aiForecastRPC = "/ai.analysis.AiAnalysisAndChatService/GetSalesForecast"

type salesForecast struct {
	SKUID          int64
	SKUName        string
	TargetDate     string
	PredictedSales float64
	PredictedLower float64
	PredictedUpper float64
	Trend          float64
	AnalysisLabel  string
	StrategyKey    string
	CurrentStock   int
	Method         string
}

type aiForecastClient struct {
	addrs []string
	desc  aiForecastDescriptors
}

type aiForecastDescriptors struct {
	request      protoreflect.MessageDescriptor
	response     protoreflect.MessageDescriptor
	forecastItem protoreflect.MessageDescriptor
}

type transferForecastResponse struct {
	TargetDate     string `json:"target_date"`
	PredictedSales int    `json:"predicted_sales"`
}

func newAIForecastClient(addrs []string) (*aiForecastClient, error) {
	cleanAddrs := make([]string, 0, len(addrs))
	for _, addr := range addrs {
		addr = strings.TrimSpace(addr)
		if addr != "" {
			cleanAddrs = append(cleanAddrs, addr)
		}
	}
	if len(cleanAddrs) == 0 {
		return nil, nil
	}
	desc, err := loadAIForecastDescriptors()
	if err != nil {
		return nil, err
	}
	return &aiForecastClient{addrs: cleanAddrs, desc: desc}, nil
}

func loadAIForecastDescriptors() (aiForecastDescriptors, error) {
	forecastItem := &descriptorpb.DescriptorProto{
		Name: proto.String("ForecastItem"),
		Field: []*descriptorpb.FieldDescriptorProto{
			protoField("sku_id", 1, descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL, descriptorpb.FieldDescriptorProto_TYPE_INT32, ""),
			protoField("sku_name", 3, descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL, descriptorpb.FieldDescriptorProto_TYPE_STRING, ""),
			protoField("target_date", 4, descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL, descriptorpb.FieldDescriptorProto_TYPE_STRING, ""),
			protoField("predicted_sales", 5, descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL, descriptorpb.FieldDescriptorProto_TYPE_DOUBLE, ""),
			protoField("predicted_lower", 6, descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL, descriptorpb.FieldDescriptorProto_TYPE_DOUBLE, ""),
			protoField("predicted_upper", 7, descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL, descriptorpb.FieldDescriptorProto_TYPE_DOUBLE, ""),
			protoField("trend", 8, descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL, descriptorpb.FieldDescriptorProto_TYPE_DOUBLE, ""),
			protoField("analysis_label", 9, descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL, descriptorpb.FieldDescriptorProto_TYPE_STRING, ""),
			protoField("strategy_key", 10, descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL, descriptorpb.FieldDescriptorProto_TYPE_STRING, ""),
			protoField("current_stock", 11, descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL, descriptorpb.FieldDescriptorProto_TYPE_INT32, ""),
			protoField("method", 12, descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL, descriptorpb.FieldDescriptorProto_TYPE_STRING, ""),
		},
	}
	fd := &descriptorpb.FileDescriptorProto{
		Name:    proto.String("ai_analysis.proto"),
		Package: proto.String("ai.analysis"),
		Syntax:  proto.String("proto3"),
		MessageType: []*descriptorpb.DescriptorProto{
			{
				Name: proto.String("GetSalesForecastRequest"),
				Field: []*descriptorpb.FieldDescriptorProto{
					protoField("store_id", 1, descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL, descriptorpb.FieldDescriptorProto_TYPE_INT32, ""),
					protoField("sku_id", 2, descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL, descriptorpb.FieldDescriptorProto_TYPE_INT32, ""),
				},
			},
			{
				Name: proto.String("GetSalesForecastResponse"),
				Field: []*descriptorpb.FieldDescriptorProto{
					protoField("code", 1, descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL, descriptorpb.FieldDescriptorProto_TYPE_INT32, ""),
					protoField("message", 2, descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL, descriptorpb.FieldDescriptorProto_TYPE_STRING, ""),
					protoField("forecasts", 3, descriptorpb.FieldDescriptorProto_LABEL_REPEATED, descriptorpb.FieldDescriptorProto_TYPE_MESSAGE, ".ai.analysis.GetSalesForecastResponse.ForecastItem"),
				},
				NestedType: []*descriptorpb.DescriptorProto{forecastItem},
			},
		},
	}
	file, err := protodesc.NewFile(fd, nil)
	if err != nil {
		return aiForecastDescriptors{}, err
	}
	msgs := file.Messages()
	response := msgs.ByName("GetSalesForecastResponse")
	return aiForecastDescriptors{
		request:      msgs.ByName("GetSalesForecastRequest"),
		response:     response,
		forecastItem: response.Messages().ByName("ForecastItem"),
	}, nil
}

func protoField(name string, number int32, label descriptorpb.FieldDescriptorProto_Label, typ descriptorpb.FieldDescriptorProto_Type, typeName string) *descriptorpb.FieldDescriptorProto {
	field := &descriptorpb.FieldDescriptorProto{
		Name:   proto.String(name),
		Number: proto.Int32(number),
		Label:  label.Enum(),
		Type:   typ.Enum(),
	}
	if typeName != "" {
		field.TypeName = proto.String(typeName)
	}
	return field
}

func (c *aiForecastClient) GetSalesForecast(ctx context.Context, storeID, skuID int64) ([]salesForecast, error) {
	if c == nil || len(c.addrs) == 0 {
		return nil, errors.New("ai forecast client is not configured")
	}
	var lastErr error
	for _, addr := range c.addrs {
		forecasts, err := c.getSalesForecastAt(ctx, addr, storeID, skuID)
		if err == nil {
			return forecasts, nil
		}
		lastErr = err
		log.Printf("GetSalesForecast gRPC failed at %s: %v", addr, err)
	}
	if lastErr == nil {
		lastErr = errors.New("no ai forecast address configured")
	}
	return nil, lastErr
}

func (c *aiForecastClient) getSalesForecastAt(ctx context.Context, addr string, storeID, skuID int64) ([]salesForecast, error) {
	callCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()

	conn, err := grpc.DialContext(
		callCtx,
		addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	req := dynamicpb.NewMessage(c.desc.request)
	reqFields := c.desc.request.Fields()
	req.Set(reqFields.ByName("store_id"), protoreflect.ValueOfInt32(int32(storeID)))
	req.Set(reqFields.ByName("sku_id"), protoreflect.ValueOfInt32(int32(skuID)))

	resp := dynamicpb.NewMessage(c.desc.response)
	if err := conn.Invoke(callCtx, aiForecastRPC, req, resp); err != nil {
		return nil, err
	}
	return c.decodeForecastResponse(resp)
}

func (c *aiForecastClient) decodeForecastResponse(resp *dynamicpb.Message) ([]salesForecast, error) {
	respFields := c.desc.response.Fields()
	code := int(resp.Get(respFields.ByName("code")).Int())
	message := resp.Get(respFields.ByName("message")).String()
	if code != 0 {
		if message == "" {
			message = "ai forecast service returned an error"
		}
		return nil, errors.New(message)
	}

	list := resp.Get(respFields.ByName("forecasts")).List()
	itemFields := c.desc.forecastItem.Fields()
	forecasts := make([]salesForecast, 0, list.Len())
	for i := 0; i < list.Len(); i++ {
		item := list.Get(i).Message()
		forecasts = append(forecasts, salesForecast{
			SKUID:          item.Get(itemFields.ByName("sku_id")).Int(),
			SKUName:        item.Get(itemFields.ByName("sku_name")).String(),
			TargetDate:     item.Get(itemFields.ByName("target_date")).String(),
			PredictedSales: item.Get(itemFields.ByName("predicted_sales")).Float(),
			PredictedLower: item.Get(itemFields.ByName("predicted_lower")).Float(),
			PredictedUpper: item.Get(itemFields.ByName("predicted_upper")).Float(),
			Trend:          item.Get(itemFields.ByName("trend")).Float(),
			AnalysisLabel:  item.Get(itemFields.ByName("analysis_label")).String(),
			StrategyKey:    item.Get(itemFields.ByName("strategy_key")).String(),
			CurrentStock:   int(item.Get(itemFields.ByName("current_stock")).Int()),
			Method:         item.Get(itemFields.ByName("method")).String(),
		})
	}
	return forecasts, nil
}

func (s *Server) handleTransferForecast(w http.ResponseWriter, r *http.Request, user authUser) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, response{Code: 1001, Message: "method not allowed", Data: nil})
		return
	}
	if !requireHead(w, user) {
		return
	}
	storeID, hasStore, err := parseInt64Query(r, "store_id")
	if err != nil || !hasStore || storeID <= 0 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "store_id 非法", Data: nil})
		return
	}
	skuID, hasSKU, err := parseInt64Query(r, "sku_id")
	if err != nil || !hasSKU || skuID <= 0 {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "sku_id 非法", Data: nil})
		return
	}
	if s.aiForecast == nil {
		writeJSON(w, http.StatusServiceUnavailable, response{Code: 5001, Message: "AI 预测服务未配置", Data: nil})
		return
	}

	ok, err := s.storeAndSKUExist(r.Context(), storeID, skuID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "服务器内部错误", Data: nil})
		return
	}
	if !ok {
		writeJSON(w, http.StatusBadRequest, response{Code: 1001, Message: "门店或 SKU 不存在", Data: nil})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	forecasts, err := s.aiForecast.GetSalesForecast(ctx, storeID, skuID)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, response{Code: 5001, Message: "AI 预测服务调用失败", Data: nil})
		return
	}
	forecast, ok := pickForecast(forecasts, skuID)
	if !ok {
		writeJSON(w, http.StatusOK, response{Code: 0, Message: "no forecast data", Data: nil})
		return
	}
	if err := s.insertForecastDiagnosis(r.Context(), storeID, forecast); err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Code: 5001, Message: "预测结果落库失败", Data: nil})
		return
	}

	writeJSON(w, http.StatusOK, response{Code: 0, Message: "success", Data: transferForecastResponse{
		TargetDate:     forecast.TargetDate,
		PredictedSales: displayForecastSales(forecast.PredictedSales),
	}})
}

func (s *Server) storeAndSKUExist(ctx context.Context, storeID, skuID int64) (bool, error) {
	var storeExists, skuExists bool
	err := s.db.QueryRowContext(ctx, `
SELECT
  EXISTS(SELECT 1 FROM stores WHERE store_id = $1),
  EXISTS(SELECT 1 FROM skus WHERE sku_id = $2)`, storeID, skuID).Scan(&storeExists, &skuExists)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}
	return storeExists && skuExists, nil
}

func pickForecast(forecasts []salesForecast, skuID int64) (salesForecast, bool) {
	for _, forecast := range forecasts {
		if forecast.SKUID == skuID {
			return forecast, true
		}
	}
	if len(forecasts) == 0 {
		return salesForecast{}, false
	}
	return forecasts[0], true
}

func displayForecastSales(value float64) int {
	if value <= 0 || math.IsNaN(value) || math.IsInf(value, 0) {
		return 0
	}
	return int(math.Round(value))
}

func (s *Server) insertForecastDiagnosis(ctx context.Context, storeID int64, forecast salesForecast) error {
	rootCause := map[string]interface{}{
		"source":           "prophet_forecast",
		"store_id":         storeID,
		"sku_id":           forecast.SKUID,
		"sku_name":         forecast.SKUName,
		"target_date":      forecast.TargetDate,
		"predicted_sales":  forecast.PredictedSales,
		"predicted_lower":  forecast.PredictedLower,
		"predicted_upper":  forecast.PredictedUpper,
		"trend":            forecast.Trend,
		"analysis_label":   forecast.AnalysisLabel,
		"strategy_key":     forecast.StrategyKey,
		"current_stock":    forecast.CurrentStock,
		"method":           forecast.Method,
		"display_quantity": displayForecastSales(forecast.PredictedSales),
		"generated_at":     time.Now().Format(time.RFC3339),
	}
	raw, err := json.Marshal(rootCause)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `
INSERT INTO ai_inventory_diagnoses (store_id, sku_id, inventory_diagnosis_result_type, inventory_root_cause)
VALUES ($1, $2, $3, $4::jsonb)`, storeID, forecast.SKUID, diagnosisTypeFromForecast(forecast), string(raw))
	return err
}

func diagnosisTypeFromForecast(forecast salesForecast) string {
	key := strings.ToLower(forecast.StrategyKey)
	label := strings.ToLower(forecast.AnalysisLabel)
	switch {
	case strings.Contains(key, "shortage") || strings.Contains(label, "shortage") || strings.Contains(forecast.AnalysisLabel, "缺货"):
		return "Shortage"
	case strings.Contains(key, "oversupply") || strings.Contains(label, "unsale") || strings.Contains(forecast.AnalysisLabel, "堆积"):
		return "Unsale"
	default:
		return "Normal"
	}
}

func (f salesForecast) String() string {
	return fmt.Sprintf("store forecast sku=%d target=%s predicted=%.2f", f.SKUID, f.TargetDate, f.PredictedSales)
}
