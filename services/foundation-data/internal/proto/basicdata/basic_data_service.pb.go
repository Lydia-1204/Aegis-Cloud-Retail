// Code generated manually from services/ai-assistant/proto/basic_data_service.proto. DO NOT EDIT.

package basicdata

import (
	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
	protoimpl "google.golang.org/protobuf/runtime/protoimpl"
	reflect "reflect"
	sync "sync"
)

const (
	_ = protoimpl.EnforceVersion(20 - protoimpl.MinVersion)
	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
)

type SkuDictRequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	SkuIds []int32 `protobuf:"varint,1,rep,packed,name=sku_ids,json=skuIds,proto3" json:"sku_ids,omitempty"`
}

func (x *SkuDictRequest) Reset() {
	*x = SkuDictRequest{}
	if protoimpl.UnsafeEnabled {
		mi := &file_basic_data_service_proto_msgTypes[0]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *SkuDictRequest) String() string { return protoimpl.X.MessageStringOf(x) }
func (*SkuDictRequest) ProtoMessage()    {}
func (x *SkuDictRequest) ProtoReflect() protoreflect.Message {
	mi := &file_basic_data_service_proto_msgTypes[0]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}
func (*SkuDictRequest) Descriptor() ([]byte, []int) {
	return file_basic_data_service_proto_rawDescGZIP(), []int{0}
}
func (x *SkuDictRequest) GetSkuIds() []int32 {
	if x != nil {
		return x.SkuIds
	}
	return nil
}

type SkuDictResponse struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Skus []*SkuDictResponse_SkuInfo `protobuf:"bytes,1,rep,name=skus,proto3" json:"skus,omitempty"`
}

func (x *SkuDictResponse) Reset() {
	*x = SkuDictResponse{}
	if protoimpl.UnsafeEnabled {
		mi := &file_basic_data_service_proto_msgTypes[1]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *SkuDictResponse) String() string { return protoimpl.X.MessageStringOf(x) }
func (*SkuDictResponse) ProtoMessage()    {}
func (x *SkuDictResponse) ProtoReflect() protoreflect.Message {
	mi := &file_basic_data_service_proto_msgTypes[1]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}
func (*SkuDictResponse) Descriptor() ([]byte, []int) {
	return file_basic_data_service_proto_rawDescGZIP(), []int{1}
}
func (x *SkuDictResponse) GetSkus() []*SkuDictResponse_SkuInfo {
	if x != nil {
		return x.Skus
	}
	return nil
}

type StoreContextRequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	StoreId int32 `protobuf:"varint,1,opt,name=store_id,json=storeId,proto3" json:"store_id,omitempty"`
}

func (x *StoreContextRequest) Reset() {
	*x = StoreContextRequest{}
	if protoimpl.UnsafeEnabled {
		mi := &file_basic_data_service_proto_msgTypes[2]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *StoreContextRequest) String() string { return protoimpl.X.MessageStringOf(x) }
func (*StoreContextRequest) ProtoMessage()    {}
func (x *StoreContextRequest) ProtoReflect() protoreflect.Message {
	mi := &file_basic_data_service_proto_msgTypes[2]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}
func (*StoreContextRequest) Descriptor() ([]byte, []int) {
	return file_basic_data_service_proto_rawDescGZIP(), []int{2}
}
func (x *StoreContextRequest) GetStoreId() int32 {
	if x != nil {
		return x.StoreId
	}
	return 0
}

type StoreContextResponse struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	StoreId       int32   `protobuf:"varint,1,opt,name=store_id,json=storeId,proto3" json:"store_id,omitempty"`
	StoreCode     string  `protobuf:"bytes,2,opt,name=store_code,json=storeCode,proto3" json:"store_code,omitempty"`
	StoreName     string  `protobuf:"bytes,3,opt,name=store_name,json=storeName,proto3" json:"store_name,omitempty"`
	StoreLocation string  `protobuf:"bytes,4,opt,name=store_location,json=storeLocation,proto3" json:"store_location,omitempty"`
	StoreArea     float64 `protobuf:"fixed64,5,opt,name=store_area,json=storeArea,proto3" json:"store_area,omitempty"`
	StoreStatus   string  `protobuf:"bytes,6,opt,name=store_status,json=storeStatus,proto3" json:"store_status,omitempty"`
}

func (x *StoreContextResponse) Reset() {
	*x = StoreContextResponse{}
	if protoimpl.UnsafeEnabled {
		mi := &file_basic_data_service_proto_msgTypes[3]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *StoreContextResponse) String() string { return protoimpl.X.MessageStringOf(x) }
func (*StoreContextResponse) ProtoMessage()    {}
func (x *StoreContextResponse) ProtoReflect() protoreflect.Message {
	mi := &file_basic_data_service_proto_msgTypes[3]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}
func (*StoreContextResponse) Descriptor() ([]byte, []int) {
	return file_basic_data_service_proto_rawDescGZIP(), []int{3}
}
func (x *StoreContextResponse) GetStoreId() int32 {
	if x != nil {
		return x.StoreId
	}
	return 0
}
func (x *StoreContextResponse) GetStoreCode() string {
	if x != nil {
		return x.StoreCode
	}
	return ""
}
func (x *StoreContextResponse) GetStoreName() string {
	if x != nil {
		return x.StoreName
	}
	return ""
}
func (x *StoreContextResponse) GetStoreLocation() string {
	if x != nil {
		return x.StoreLocation
	}
	return ""
}
func (x *StoreContextResponse) GetStoreArea() float64 {
	if x != nil {
		return x.StoreArea
	}
	return 0
}
func (x *StoreContextResponse) GetStoreStatus() string {
	if x != nil {
		return x.StoreStatus
	}
	return ""
}

type SkuDictResponse_SkuInfo struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	SkuId        int32   `protobuf:"varint,1,opt,name=sku_id,json=skuId,proto3" json:"sku_id,omitempty"`
	SkuCode      string  `protobuf:"bytes,2,opt,name=sku_code,json=skuCode,proto3" json:"sku_code,omitempty"`
	SkuName      string  `protobuf:"bytes,3,opt,name=sku_name,json=skuName,proto3" json:"sku_name,omitempty"`
	CategoryName string  `protobuf:"bytes,4,opt,name=category_name,json=categoryName,proto3" json:"category_name,omitempty"`
	StdCost      float64 `protobuf:"fixed64,5,opt,name=std_cost,json=stdCost,proto3" json:"std_cost,omitempty"`
	SugPrice     float64 `protobuf:"fixed64,6,opt,name=sug_price,json=sugPrice,proto3" json:"sug_price,omitempty"`
	SkuStatus    string  `protobuf:"bytes,7,opt,name=sku_status,json=skuStatus,proto3" json:"sku_status,omitempty"`
}

func (x *SkuDictResponse_SkuInfo) Reset() {
	*x = SkuDictResponse_SkuInfo{}
	if protoimpl.UnsafeEnabled {
		mi := &file_basic_data_service_proto_msgTypes[4]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *SkuDictResponse_SkuInfo) String() string { return protoimpl.X.MessageStringOf(x) }
func (*SkuDictResponse_SkuInfo) ProtoMessage()    {}
func (x *SkuDictResponse_SkuInfo) ProtoReflect() protoreflect.Message {
	mi := &file_basic_data_service_proto_msgTypes[4]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}
func (*SkuDictResponse_SkuInfo) Descriptor() ([]byte, []int) {
	return file_basic_data_service_proto_rawDescGZIP(), []int{1, 0}
}
func (x *SkuDictResponse_SkuInfo) GetSkuId() int32 {
	if x != nil {
		return x.SkuId
	}
	return 0
}
func (x *SkuDictResponse_SkuInfo) GetSkuCode() string {
	if x != nil {
		return x.SkuCode
	}
	return ""
}
func (x *SkuDictResponse_SkuInfo) GetSkuName() string {
	if x != nil {
		return x.SkuName
	}
	return ""
}
func (x *SkuDictResponse_SkuInfo) GetCategoryName() string {
	if x != nil {
		return x.CategoryName
	}
	return ""
}
func (x *SkuDictResponse_SkuInfo) GetStdCost() float64 {
	if x != nil {
		return x.StdCost
	}
	return 0
}
func (x *SkuDictResponse_SkuInfo) GetSugPrice() float64 {
	if x != nil {
		return x.SugPrice
	}
	return 0
}
func (x *SkuDictResponse_SkuInfo) GetSkuStatus() string {
	if x != nil {
		return x.SkuStatus
	}
	return ""
}

var File_basic_data_service_proto protoreflect.FileDescriptor

var file_basic_data_service_proto_rawDesc = []byte("\n\x18basic_data_service.proto\x12\tbasicdata\"!\n\x0eSkuDictRequest\x12\x0f\n\x07sku_ids\x18\x01 \x03(\x05\"\xd3\x01\n\x0fSkuDictResponse\x12\x30\n\x04skus\x18\x01 \x03(\x0b\x32\".basicdata.SkuDictResponse.SkuInfo\x1a\x8d\x01\n\x07SkuInfo\x12\x0e\n\x06sku_id\x18\x01 \x01(\x05\x12\x10\n\x08sku_code\x18\x02 \x01(\t\x12\x10\n\x08sku_name\x18\x03 \x01(\t\x12\x15\n\rcategory_name\x18\x04 \x01(\t\x12\x10\n\x08std_cost\x18\x05 \x01(\x01\x12\x11\n\tsug_price\x18\x06 \x01(\x01\x12\x12\n\nsku_status\x18\x07 \x01(\t\"'\n\x13StoreContextRequest\x12\x10\n\x08store_id\x18\x01 \x01(\x05\"\x92\x01\n\x14StoreContextResponse\x12\x10\n\x08store_id\x18\x01 \x01(\x05\x12\x12\n\nstore_code\x18\x02 \x01(\t\x12\x12\n\nstore_name\x18\x03 \x01(\t\x12\x16\n\x0estore_location\x18\x04 \x01(\t\x12\x12\n\nstore_area\x18\x05 \x01(\x01\x12\x14\n\x0cstore_status\x18\x06 \x01(\t2\xb1\x01\n\x10BasicDataService\x12I\n\x10GetSkuDictionary\x12\x19.basicdata.SkuDictRequest\x1a\x1a.basicdata.SkuDictResponse\x12R\n\x0fGetStoreContext\x12\x1e.basicdata.StoreContextRequest\x1a\x1f.basicdata.StoreContextResponseb\x06proto3")

var (
	file_basic_data_service_proto_rawDescOnce sync.Once
	file_basic_data_service_proto_rawDescData = file_basic_data_service_proto_rawDesc
)

func file_basic_data_service_proto_rawDescGZIP() []byte {
	file_basic_data_service_proto_rawDescOnce.Do(func() {
		file_basic_data_service_proto_rawDescData = protoimpl.X.CompressGZIP(file_basic_data_service_proto_rawDescData)
	})
	return file_basic_data_service_proto_rawDescData
}

var file_basic_data_service_proto_msgTypes = make([]protoimpl.MessageInfo, 5)
var file_basic_data_service_proto_goTypes = []interface{}{
	(*SkuDictRequest)(nil),
	(*SkuDictResponse)(nil),
	(*StoreContextRequest)(nil),
	(*StoreContextResponse)(nil),
	(*SkuDictResponse_SkuInfo)(nil),
}
var file_basic_data_service_proto_depIdxs = []int32{
	4, // 0: basicdata.SkuDictResponse.skus:type_name -> basicdata.SkuDictResponse.SkuInfo
	0, // 1: basicdata.BasicDataService.GetSkuDictionary:input_type -> basicdata.SkuDictRequest
	2, // 2: basicdata.BasicDataService.GetStoreContext:input_type -> basicdata.StoreContextRequest
	1, // 3: basicdata.BasicDataService.GetSkuDictionary:output_type -> basicdata.SkuDictResponse
	3, // 4: basicdata.BasicDataService.GetStoreContext:output_type -> basicdata.StoreContextResponse
	3, // [3:5] is the sub-list for method output_type
	1, // [1:3] is the sub-list for method input_type
	1, // [1:1] is the sub-list for extension type_name
	1, // [1:1] is the sub-list for extension extendee
	0, // [0:1] is the sub-list for field type_name
}

func init() { file_basic_data_service_proto_init() }
func file_basic_data_service_proto_init() {
	if File_basic_data_service_proto != nil {
		return
	}
	if protoimpl.UnsafeEnabled {
		file_basic_data_service_proto_msgTypes[0].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*SkuDictRequest); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_basic_data_service_proto_msgTypes[1].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*SkuDictResponse); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_basic_data_service_proto_msgTypes[2].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*StoreContextRequest); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_basic_data_service_proto_msgTypes[3].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*StoreContextResponse); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_basic_data_service_proto_msgTypes[4].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*SkuDictResponse_SkuInfo); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
	}
	type x struct{}
	out := protoimpl.TypeBuilder{
		File: protoimpl.DescBuilder{
			GoPackagePath: reflect.TypeOf(x{}).PkgPath(),
			RawDescriptor: file_basic_data_service_proto_rawDesc,
			NumEnums:      0,
			NumMessages:   5,
			NumExtensions: 0,
			NumServices:   1,
		},
		GoTypes:           file_basic_data_service_proto_goTypes,
		DependencyIndexes: file_basic_data_service_proto_depIdxs,
		MessageInfos:      file_basic_data_service_proto_msgTypes,
	}.Build()
	File_basic_data_service_proto = out.File
	file_basic_data_service_proto_rawDesc = nil
	file_basic_data_service_proto_goTypes = nil
	file_basic_data_service_proto_depIdxs = nil
}
