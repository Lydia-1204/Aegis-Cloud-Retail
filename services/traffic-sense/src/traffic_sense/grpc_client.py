import logging
from typing import Optional

import grpc

from traffic_sense.config import go_store_business_addr
from traffic_sense.proto.store_business_service_pb2 import PushCustomerFlowRequest
from traffic_sense.proto.store_business_service_pb2_grpc import StoreBusinessServiceStub

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
        self._channel = None
        self._stub = None
        self._initialized = True

    def _ensure_channel(self):
        if self._channel is None:
            addr = go_store_business_addr()
            self._channel = grpc.insecure_channel(addr)
            self._stub = StoreBusinessServiceStub(self._channel)
            logger.info(f"StoreBusinessService gRPC channel created: {addr}")

    async def push_customer_flow(
        self, store_id: int, record_timestamp: str,
        customer_start_time: str, customer_end_time: str, in_count: int
    ) -> bool:
        self._ensure_channel()
        try:
            request = PushCustomerFlowRequest(
                store_id=store_id,
                record_timestamp=record_timestamp,
                customer_start_time=customer_start_time,
                customer_end_time=customer_end_time,
                in_count=in_count,
            )
            response = self._stub.PushCustomerFlow(request, timeout=10)
            return response.success
        except grpc.RpcError as e:
            logger.warning(f"PushCustomerFlow gRPC failed: {e.code()}")
            return False


go_client = GoServiceClient()
