// Code generated manually from services/ai-assistant/proto/basic_data_service.proto. DO NOT EDIT.

package basicdata

import (
	context "context"

	grpc "google.golang.org/grpc"
	codes "google.golang.org/grpc/codes"
	status "google.golang.org/grpc/status"
)

const _ = grpc.SupportPackageIsVersion9

const (
	BasicDataService_GetSkuDictionary_FullMethodName = "/basicdata.BasicDataService/GetSkuDictionary"
	BasicDataService_GetStoreContext_FullMethodName  = "/basicdata.BasicDataService/GetStoreContext"
	BasicDataService_ListStores_FullMethodName       = "/basicdata.BasicDataService/ListStores"
)

type BasicDataServiceClient interface {
	GetSkuDictionary(ctx context.Context, in *SkuDictRequest, opts ...grpc.CallOption) (*SkuDictResponse, error)
	GetStoreContext(ctx context.Context, in *StoreContextRequest, opts ...grpc.CallOption) (*StoreContextResponse, error)
	ListStores(ctx context.Context, in *ListStoresRequest, opts ...grpc.CallOption) (*ListStoresResponse, error)
}

type basicDataServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewBasicDataServiceClient(cc grpc.ClientConnInterface) BasicDataServiceClient {
	return &basicDataServiceClient{cc}
}

func (c *basicDataServiceClient) GetSkuDictionary(ctx context.Context, in *SkuDictRequest, opts ...grpc.CallOption) (*SkuDictResponse, error) {
	out := new(SkuDictResponse)
	err := c.cc.Invoke(ctx, BasicDataService_GetSkuDictionary_FullMethodName, in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *basicDataServiceClient) GetStoreContext(ctx context.Context, in *StoreContextRequest, opts ...grpc.CallOption) (*StoreContextResponse, error) {
	out := new(StoreContextResponse)
	err := c.cc.Invoke(ctx, BasicDataService_GetStoreContext_FullMethodName, in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *basicDataServiceClient) ListStores(ctx context.Context, in *ListStoresRequest, opts ...grpc.CallOption) (*ListStoresResponse, error) {
	out := new(ListStoresResponse)
	err := c.cc.Invoke(ctx, BasicDataService_ListStores_FullMethodName, in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

type BasicDataServiceServer interface {
	GetSkuDictionary(context.Context, *SkuDictRequest) (*SkuDictResponse, error)
	GetStoreContext(context.Context, *StoreContextRequest) (*StoreContextResponse, error)
	ListStores(context.Context, *ListStoresRequest) (*ListStoresResponse, error)
}

type UnimplementedBasicDataServiceServer struct{}

func (UnimplementedBasicDataServiceServer) GetSkuDictionary(context.Context, *SkuDictRequest) (*SkuDictResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetSkuDictionary not implemented")
}
func (UnimplementedBasicDataServiceServer) GetStoreContext(context.Context, *StoreContextRequest) (*StoreContextResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetStoreContext not implemented")
}
func (UnimplementedBasicDataServiceServer) ListStores(context.Context, *ListStoresRequest) (*ListStoresResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ListStores not implemented")
}

func RegisterBasicDataServiceServer(s grpc.ServiceRegistrar, srv BasicDataServiceServer) {
	s.RegisterService(&BasicDataService_ServiceDesc, srv)
}

func _BasicDataService_GetSkuDictionary_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(SkuDictRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(BasicDataServiceServer).GetSkuDictionary(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: BasicDataService_GetSkuDictionary_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(BasicDataServiceServer).GetSkuDictionary(ctx, req.(*SkuDictRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _BasicDataService_GetStoreContext_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(StoreContextRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(BasicDataServiceServer).GetStoreContext(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: BasicDataService_GetStoreContext_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(BasicDataServiceServer).GetStoreContext(ctx, req.(*StoreContextRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _BasicDataService_ListStores_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ListStoresRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(BasicDataServiceServer).ListStores(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: BasicDataService_ListStores_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(BasicDataServiceServer).ListStores(ctx, req.(*ListStoresRequest))
	}
	return interceptor(ctx, in, info, handler)
}

var BasicDataService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "basicdata.BasicDataService",
	HandlerType: (*BasicDataServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "GetSkuDictionary",
			Handler:    _BasicDataService_GetSkuDictionary_Handler,
		},
		{
			MethodName: "GetStoreContext",
			Handler:    _BasicDataService_GetStoreContext_Handler,
		},
		{
			MethodName: "ListStores",
			Handler:    _BasicDataService_ListStores_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "basic_data_service.proto",
}
