import asyncio
import grpc
from typing import List
from grpc_reflection.v1alpha import reflection
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from traffic_sense.proto.perception_pb2 import (
    GetRawFlowRequest,
    GetRawFlowResponse
)
from traffic_sense.proto.perception_pb2_grpc import (
    AiPerceptionServiceServicer,
    add_AiPerceptionServiceServicer_to_server
)
from traffic_sense.db_models import AiCustomer
from traffic_sense import database


class AiPerceptionService(AiPerceptionServiceServicer):
    async def GetRawCustomerFlow(self, request, context):
        if database.async_session_maker is None:
            flow_list = self._generate_mock_data(request.store_id)
            return GetRawFlowResponse(
                code=0,
                message="success (mock data, database not connected)",
                flow_list=flow_list
            )

        async with database.async_session_maker() as session:
            stmt = select(AiCustomer).where(
                AiCustomer.store_id == request.store_id
            )
            if request.start_time:
                from datetime import datetime
                start_dt = datetime.fromisoformat(request.start_time.replace('Z', '+00:00'))
                stmt = stmt.where(AiCustomer.customer_start_time >= start_dt)
            if request.end_time:
                from datetime import datetime
                end_dt = datetime.fromisoformat(request.end_time.replace('Z', '+00:00'))
                stmt = stmt.where(AiCustomer.customer_end_time <= end_dt)

            stmt = stmt.order_by(AiCustomer.customer_start_time)
            result = await session.execute(stmt)
            customers = result.scalars().all()

            flow_list = []
            for c in customers:
                item = GetRawFlowResponse.AiCustomerItem(
                    ai_customer_id=c.ai_customer_id,
                    store_id=c.store_id,
                    customer_start_time=c.customer_start_time.isoformat().replace('+00:00', 'Z'),
                    customer_end_time=c.customer_end_time.isoformat().replace('+00:00', 'Z'),
                    customer_enter_total=c.customer_enter_total,
                    customer_leave_total=c.customer_leave_total,
                    ai_customer_stats_time=c.ai_customer_stats_time.isoformat().replace('+00:00', 'Z')
                )
                flow_list.append(item)

        return GetRawFlowResponse(
            code=0,
            message="success",
            flow_list=flow_list
        )

    def _generate_mock_data(self, store_id: int) -> List:
        flow_list = []
        for i in range(5):
            item = GetRawFlowResponse.AiCustomerItem(
                ai_customer_id=1000 + i,
                store_id=store_id,
                customer_start_time=f"2026-04-19T{i:02d}:00:00Z",
                customer_end_time=f"2026-04-19T{i+1:02d}:00:00Z",
                customer_enter_total=40 + i * 5,
                customer_leave_total=35 + i * 5,
                ai_customer_stats_time=f"2026-04-19T{i+1:02d}:00:00Z"
            )
            flow_list.append(item)
        return flow_list


import logging

async def serve_grpc():
    try:
        server = grpc.aio.server()
        add_AiPerceptionServiceServicer_to_server(AiPerceptionService(), server)
        
        # 启用反射
        SERVICE_NAMES = (
            'ai.perception.AiPerceptionService',
            reflection.SERVICE_NAME,
        )
        reflection.enable_server_reflection(SERVICE_NAMES, server)
        
        server.add_insecure_port('[::]:50051')
        await server.start()
        print("gRPC server started on port 50051")
        logging.info("gRPC server started on port 50051")
        await server.wait_for_termination()
    except Exception as e:
        print(f"gRPC server error: {e}")
        logging.error(f"gRPC server error: {e}")
        raise
