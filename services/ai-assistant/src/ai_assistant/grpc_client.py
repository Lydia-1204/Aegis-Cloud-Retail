import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict

import grpc

from ai_assistant.config import go_basic_data_addr, go_store_business_addr
from ai_assistant.proto.basic_data_service_pb2 import (
    SkuDictRequest,
    StoreContextRequest,
)
from ai_assistant.proto.basic_data_service_pb2_grpc import BasicDataServiceStub
from ai_assistant.proto.store_business_service_pb2 import (
    SnapshotRequest,
    PushCustomerFlowRequest,
    SyncDiagnosisRequest,
    CreateAiTransferRequest,
)
from ai_assistant.proto.store_business_service_pb2_grpc import StoreBusinessServiceStub

logger = logging.getLogger(__name__)


class GoServiceClient:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._basic_data_channel = None
        self._store_business_channel = None
        self._basic_data_stub = None
        self._store_business_stub = None
        self._initialized = True

    def _ensure_channels(self):
        if self._basic_data_channel is None:
            addr = go_basic_data_addr()
            self._basic_data_channel = grpc.insecure_channel(addr)
            self._basic_data_stub = BasicDataServiceStub(self._basic_data_channel)
            logger.info(f"BasicDataService gRPC channel created: {addr}")

        if self._store_business_channel is None:
            addr = go_store_business_addr()
            self._store_business_channel = grpc.insecure_channel(addr)
            self._store_business_stub = StoreBusinessServiceStub(self._store_business_channel)
            logger.info(f"StoreBusinessService gRPC channel created: {addr}")

    async def get_sku_dictionary(self, sku_ids: List[int] = None) -> List[Dict]:
        self._ensure_channels()
        try:
            request = SkuDictRequest()
            if sku_ids:
                request.sku_ids.extend(sku_ids)
            response = self._basic_data_stub.GetSkuDictionary(request, timeout=10)
            return [
                {
                    "sku_id": s.sku_id,
                    "sku_code": s.sku_code,
                    "sku_name": s.sku_name,
                    "category_name": s.category_name,
                    "std_cost": s.std_cost,
                    "sug_price": s.sug_price,
                    "sku_status": s.sku_status,
                }
                for s in response.skus
            ]
        except grpc.RpcError as e:
            logger.warning(f"GetSkuDictionary gRPC failed, using mock: {e.code()}")
            return self._mock_sku_dictionary(sku_ids)

    async def get_store_context(self, store_id: int) -> Optional[Dict]:
        self._ensure_channels()
        try:
            request = StoreContextRequest(store_id=store_id)
            response = self._basic_data_stub.GetStoreContext(request, timeout=10)
            return {
                "store_id": response.store_id,
                "store_code": response.store_code,
                "store_name": response.store_name,
                "store_location": response.store_location,
                "store_area": response.store_area,
                "store_status": response.store_status,
            }
        except grpc.RpcError as e:
            logger.warning(f"GetStoreContext gRPC failed, using mock: {e.code()}")
            return self._mock_store_context(store_id)

    async def get_business_snapshot(
        self, store_id: int, start_date: str = None, end_date: str = None
    ) -> Optional[Dict]:
        self._ensure_channels()
        try:
            if start_date is None:
                start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            if end_date is None:
                end_date = datetime.now().strftime("%Y-%m-%d")

            request = SnapshotRequest(
                store_id=store_id, start_date=start_date, end_date=end_date
            )
            response = self._store_business_stub.GetBusinessSnapshot(request, timeout=15)

            current_inventory = [
                {"sku_id": item.sku_id, "actual_quantity": item.actual_quantity}
                for item in response.current_inventory
            ]

            daily_sales_list = []
            for day in response.daily_sales_list:
                details = [
                    {"sku_id": d.sku_id, "sku_amount": d.sku_amount}
                    for d in day.details
                ]
                daily_sales_list.append(
                    {
                        "sales_date": day.sales_date,
                        "total_income": day.total_income,
                        "total_orders": day.total_orders,
                        "details": details,
                    }
                )

            return {
                "current_inventory": current_inventory,
                "daily_sales_list": daily_sales_list,
            }
        except grpc.RpcError as e:
            logger.warning(f"GetBusinessSnapshot gRPC failed, using mock: {e.code()}")
            return self._mock_business_snapshot(store_id)

    async def push_customer_flow(
        self, store_id: int, record_timestamp: str,
        customer_start_time: str, customer_end_time: str, in_count: int
    ) -> bool:
        self._ensure_channels()
        try:
            request = PushCustomerFlowRequest(
                store_id=store_id,
                record_timestamp=record_timestamp,
                customer_start_time=customer_start_time,
                customer_end_time=customer_end_time,
                in_count=in_count,
            )
            response = self._store_business_stub.PushCustomerFlow(request, timeout=10)
            return response.success
        except grpc.RpcError as e:
            logger.warning(f"PushCustomerFlow gRPC failed: {e.code()}")
            return False

    async def sync_inventory_diagnosis(
        self, store_id: int, sku_id: int,
        result_type: str, root_cause: str
    ) -> bool:
        self._ensure_channels()
        try:
            request = SyncDiagnosisRequest(
                store_id=store_id,
                sku_id=sku_id,
                inventory_diagnosis_result_type=result_type,
                inventory_root_cause=root_cause,
            )
            response = self._store_business_stub.SyncInventoryDiagnosis(request, timeout=10)
            return response.success
        except grpc.RpcError as e:
            logger.warning(f"SyncInventoryDiagnosis gRPC failed: {e.code()}")
            return False

    async def create_ai_transfer_order(
        self, store_id: int, details: List[Dict], ai_reasoning: str
    ) -> Optional[int]:
        self._ensure_channels()
        try:
            request = CreateAiTransferRequest(
                store_id=store_id,
                ai_reasoning=ai_reasoning,
            )
            for d in details:
                detail = request.details.add()
                detail.sku_id = d["sku_id"]
                detail.suggested_qty = d["suggested_qty"]
                detail.transfer_direction = d.get("transfer_direction", "H2S")

            response = self._store_business_stub.CreateAITransferOrder(request, timeout=10)
            if response.success:
                return response.new_order_id
            return None
        except grpc.RpcError as e:
            logger.warning(f"CreateAITransferOrder gRPC failed: {e.code()}")
            return None

    def _mock_sku_dictionary(self, sku_ids: List[int] = None) -> List[Dict]:
        all_skus = [
            {"sku_id": 101, "sku_code": "SKU-101", "sku_name": "可口可乐 330ml", "category_name": "饮料", "std_cost": 2.50, "sug_price": 5.00, "sku_status": "active"},
            {"sku_id": 102, "sku_code": "SKU-102", "sku_name": "薯片原味 75g", "category_name": "零食", "std_cost": 4.00, "sug_price": 8.50, "sku_status": "active"},
            {"sku_id": 103, "sku_code": "SKU-103", "sku_name": "矿泉水 500ml", "category_name": "饮料", "std_cost": 0.80, "sug_price": 2.00, "sku_status": "active"},
        ]
        if sku_ids:
            return [s for s in all_skus if s["sku_id"] in sku_ids]
        return all_skus

    def _mock_store_context(self, store_id: int) -> Dict:
        stores = {
            1: {"store_id": 1, "store_code": "S001", "store_name": "葵涌旗舰店", "store_location": "香港新界葵涌葵涌道123号", "store_area": 150.0, "store_status": "open"},
            2: {"store_id": 2, "store_code": "S002", "store_name": "旺角分店", "store_location": "香港九龙旺角西洋菜南街88号", "store_area": 98.5, "store_status": "open"},
        }
        return stores.get(store_id, {"store_id": store_id, "store_code": "", "store_name": "", "store_location": "", "store_area": 0.0, "store_status": "unknown"})

    def _mock_business_snapshot(self, store_id: int) -> Dict:
        from ai_assistant.mock_data import MockBusinessData
        inventory = MockBusinessData.get_inventory_data(store_id)
        current_inventory = [
            {"sku_id": item["sku_id"], "actual_quantity": item["actual_quantity"]}
            for item in inventory.get("items", [])
        ]

        sku_ids = [item["sku_id"] for item in current_inventory]

        daily_sales_list = []
        today = datetime.now()
        for i in range(30, 0, -1):
            date = today - timedelta(days=i)
            weekday = date.weekday()
            weekend_factor = 1.3 if weekday >= 5 else 1.0

            details = []
            total_income = 0.0
            total_orders = 0
            for sku_id in sku_ids:
                hist = MockBusinessData.get_historical_sales(store_id, sku_id, days=30)
                day_idx = 30 - i
                if day_idx < len(hist):
                    base_amount = hist[day_idx]["value"]
                else:
                    base_amount = 50.0
                sku_amount = max(0, int(base_amount * weekend_factor))

                sku_dict = self._mock_sku_dictionary([sku_id])
                sug_price = sku_dict[0]["sug_price"] if sku_dict else 5.0

                details.append({"sku_id": sku_id, "sku_amount": sku_amount})
                total_income += sku_amount * sug_price
                total_orders += max(1, sku_amount // 3)

            daily_sales_list.append({
                "sales_date": date.strftime("%Y-%m-%d"),
                "total_income": round(total_income, 2),
                "total_orders": total_orders,
                "details": details,
            })

        return {
            "current_inventory": current_inventory,
            "daily_sales_list": daily_sales_list,
        }


go_client = GoServiceClient()
