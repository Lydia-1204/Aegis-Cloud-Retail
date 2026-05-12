import logging

import grpc

from traffic_sense.config import go_store_business_addrs
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
        self._channels = {}
        self._stubs = {}
        self._initialized = True

    def _get_stubs(self):
        stubs = []
        for addr in go_store_business_addrs():
            if addr not in self._stubs:
                channel = grpc.insecure_channel(addr)
                self._channels[addr] = channel
                self._stubs[addr] = StoreBusinessServiceStub(channel)
                logger.info("StoreBusinessService gRPC channel created: %s", addr)
            stubs.append((addr, self._stubs[addr]))
        return stubs

    def _log_rpc_error(self, rpc_name: str, addr: str, err: grpc.RpcError):
        details = err.details() if hasattr(err, "details") else ""
        logger.warning("%s gRPC failed at %s: %s %s", rpc_name, addr, err.code(), details)

    async def push_customer_flow(
        self, store_id: int, record_timestamp: str,
        customer_start_time: str, customer_end_time: str, in_count: int
    ) -> bool:
        request = PushCustomerFlowRequest(
            store_id=store_id,
            record_timestamp=record_timestamp,
            customer_start_time=customer_start_time,
            customer_end_time=customer_end_time,
            in_count=in_count,
        )
        for addr, stub in self._get_stubs():
            try:
                response = stub.PushCustomerFlow(request, timeout=10)
                return response.success
            except grpc.RpcError as e:
                self._log_rpc_error("PushCustomerFlow", addr, e)
        logger.warning("All StoreBusinessService gRPC addresses failed; customer flow not synced")
        return False


go_client = GoServiceClient()
