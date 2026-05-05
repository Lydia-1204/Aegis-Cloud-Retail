import json
import logging
from datetime import datetime, timedelta

import grpc
from grpc_reflection.v1alpha import reflection
from sqlalchemy import select

from ai_assistant.proto.ai_analysis_pb2 import (
    TriggerAnalysisRequest,
    TriggerAnalysisResponse,
    GetAnalysisRequest,
    GetAnalysisResponse,
    GetSalesForecastRequest,
    GetSalesForecastResponse,
)
from ai_assistant.proto.ai_analysis_pb2_grpc import (
    AiAnalysisAndChatServiceServicer,
    add_AiAnalysisAndChatServiceServicer_to_server,
)
from ai_assistant.db_models import AIAnalysis
from ai_assistant import database
from ai_assistant.prophet_service import ProphetService
from ai_assistant.grpc_client import go_client

logger = logging.getLogger(__name__)

LABEL_TO_DIAGNOSIS_TYPE = {
    "正常": "Normal",
    "缺货": "Shortage",
    "堆积": "Unsale",
}


class AiAnalysisAndChatService(AiAnalysisAndChatServiceServicer):

    async def TriggerDailyAnalysis(self, request, context):
        store_id = request.store_id
        target_date = request.target_date or datetime.now().strftime("%Y-%m-%d")

        logger.info(f"TriggerDailyAnalysis called: store_id={store_id}, target_date={target_date}")

        try:
            snapshot = await go_client.get_business_snapshot(store_id)

            if not snapshot or not snapshot.get("current_inventory"):
                return TriggerAnalysisResponse(code=0, message="no inventory data found for this store")

            sku_dict = await go_client.get_sku_dictionary()
            sku_name_map = {s["sku_id"]: s["sku_name"] for s in sku_dict}

            inventory_map = {}
            for item in snapshot["current_inventory"]:
                inventory_map[item["sku_id"]] = item["actual_quantity"]

            daily_sales = snapshot.get("daily_sales_list", [])

            if database.async_session_maker is None:
                return TriggerAnalysisResponse(code=0, message="success (mock, database not connected)")

            transfer_details = []

            async with database.async_session_maker() as db:
                for sku_id, current_stock in inventory_map.items():
                    sku_name = sku_name_map.get(sku_id, "")

                    historical_data = self._extract_historical_sales(daily_sales, sku_id)

                    if len(historical_data) < 7:
                        logger.warning(f"  SKU {sku_id}: insufficient data ({len(historical_data)} days), skipping")
                        continue

                    prediction = ProphetService.predict(historical_data, periods=1)
                    predicted_sales = prediction["yhat"]

                    analysis_label, strategy_key = ProphetService.determine_label(
                        predicted_sales, current_stock
                    )

                    next_day = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

                    analysis_data = {
                        "target_date": next_day,
                        "prophet": prediction,
                        "current_stock": current_stock,
                        "sku_name": sku_name,
                    }

                    record = AIAnalysis(
                        store_id=store_id,
                        sku_id=sku_id,
                        analysis_label=analysis_label,
                        strategy_key=strategy_key,
                        analysis_data=analysis_data,
                    )
                    db.add(record)

                    logger.info(
                        f"  SKU {sku_id} ({sku_name}): predicted={predicted_sales:.1f}, "
                        f"stock={current_stock}, label={analysis_label}, strategy={strategy_key}"
                    )

                    diagnosis_type = LABEL_TO_DIAGNOSIS_TYPE.get(analysis_label, "Normal")
                    root_cause = json.dumps(analysis_data, ensure_ascii=False)

                    await go_client.sync_inventory_diagnosis(
                        store_id, sku_id, diagnosis_type, root_cause
                    )

                    if analysis_label == "缺货":
                        suggested_qty = max(0, int(predicted_sales * 3 - current_stock))
                        if suggested_qty > 0:
                            transfer_details.append({
                                "sku_id": sku_id,
                                "suggested_qty": suggested_qty,
                                "transfer_direction": "H2S",
                            })

                await db.commit()

            if transfer_details:
                ai_reasoning = json.dumps({
                    "trigger_date": target_date,
                    "store_id": store_id,
                    "reason": "Prophet预测缺货，自动生成补货调拨单",
                }, ensure_ascii=False)
                order_id = await go_client.create_ai_transfer_order(
                    store_id, transfer_details, ai_reasoning
                )
                if order_id:
                    logger.info(f"  Created AI transfer order #{order_id} with {len(transfer_details)} items")
                else:
                    logger.warning("  Failed to create AI transfer order (Go service unavailable)")

            return TriggerAnalysisResponse(code=0, message="success")

        except Exception as e:
            logger.error(f"TriggerDailyAnalysis error: {e}")
            return TriggerAnalysisResponse(code=1, message=str(e))

    def _extract_historical_sales(self, daily_sales_list: list, sku_id: int) -> list:
        result = []
        for day in daily_sales_list:
            sales_date = day.get("sales_date", "")
            sku_amount = 0
            for detail in day.get("details", []):
                if detail.get("sku_id") == sku_id:
                    sku_amount = detail.get("sku_amount", 0)
                    break
            if sku_amount > 0:
                result.append({"date": sales_date, "value": float(sku_amount)})
        return result

    async def GetAnalysisReport(self, request, context):
        store_id = request.store_id
        sku_id = request.sku_id

        logger.info(f"GetAnalysisReport called: store_id={store_id}, sku_id={sku_id}")

        try:
            if database.async_session_maker is None:
                reports = self._generate_mock_reports(store_id, sku_id)
                return GetAnalysisResponse(
                    code=0,
                    message="success (mock data, database not connected)",
                    reports=reports,
                )

            async with database.async_session_maker() as db:
                stmt = select(AIAnalysis).where(AIAnalysis.store_id == store_id)

                if sku_id > 0:
                    stmt = stmt.where(AIAnalysis.sku_id == sku_id)

                stmt = stmt.order_by(AIAnalysis.analysis_time.desc()).limit(50)
                result = await db.execute(stmt)
                analyses = result.scalars().all()

                reports = []
                for analysis in analyses:
                    analysis_data_str = ""
                    if analysis.analysis_data:
                        if isinstance(analysis.analysis_data, dict):
                            analysis_data_str = json.dumps(analysis.analysis_data, ensure_ascii=False)
                        else:
                            analysis_data_str = str(analysis.analysis_data)

                    item = GetAnalysisResponse.AnalysisItem(
                        ai_analysis_id=analysis.ai_analysis_id,
                        analysis_label=analysis.analysis_label or "",
                        strategy_key=analysis.strategy_key or "",
                        analysis_data=analysis_data_str,
                        analysis_time=analysis.analysis_time.isoformat().replace("+00:00", "Z") if analysis.analysis_time else "",
                    )
                    reports.append(item)

                return GetAnalysisResponse(
                    code=0,
                    message="success",
                    reports=reports,
                )

        except Exception as e:
            logger.error(f"GetAnalysisReport error: {e}")
            return GetAnalysisResponse(code=1, message=str(e))

    def _generate_mock_reports(self, store_id: int, sku_id: int) -> list:
        reports = []
        mock_items = [
            {
                "ai_analysis_id": 1,
                "analysis_label": "缺货",
                "strategy_key": "inventory_shortage_low_stock",
                "analysis_data": json.dumps({
                    "target_date": "2026-05-03",
                    "prophet": {"yhat": 121.5, "yhat_lower": 98.3, "yhat_upper": 152.7, "trend": 1.5, "method": "prophet"},
                    "current_stock": 23,
                    "sku_name": "可口可乐 330ml",
                }, ensure_ascii=False),
                "analysis_time": datetime.now().isoformat().replace("+00:00", "Z"),
            },
            {
                "ai_analysis_id": 2,
                "analysis_label": "堆积",
                "strategy_key": "inventory_oversupply",
                "analysis_data": json.dumps({
                    "target_date": "2026-05-03",
                    "prophet": {"yhat": 79.2, "yhat_lower": 60.1, "yhat_upper": 95.3, "trend": -0.5, "method": "prophet"},
                    "current_stock": 156,
                    "sku_name": "薯片原味 75g",
                }, ensure_ascii=False),
                "analysis_time": datetime.now().isoformat().replace("+00:00", "Z"),
            },
            {
                "ai_analysis_id": 3,
                "analysis_label": "正常",
                "strategy_key": "normal",
                "analysis_data": json.dumps({
                    "target_date": "2026-05-03",
                    "prophet": {"yhat": 152.8, "yhat_lower": 130.5, "yhat_upper": 175.2, "trend": 2.0, "method": "prophet"},
                    "current_stock": 48,
                    "sku_name": "矿泉水 500ml",
                }, ensure_ascii=False),
                "analysis_time": datetime.now().isoformat().replace("+00:00", "Z"),
            },
        ]
        for item in mock_items:
            reports.append(GetAnalysisResponse.AnalysisItem(**item))
        return reports

    async def GetSalesForecast(self, request, context):
        store_id = request.store_id
        sku_id = request.sku_id

        logger.info(f"GetSalesForecast called: store_id={store_id}, sku_id={sku_id}")

        try:
            if database.async_session_maker is None:
                return self._mock_sales_forecast(store_id, sku_id)

            async with database.async_session_maker() as db:
                stmt = select(AIAnalysis).where(AIAnalysis.store_id == store_id)
                if sku_id > 0:
                    stmt = stmt.where(AIAnalysis.sku_id == sku_id)
                stmt = stmt.order_by(AIAnalysis.analysis_time.desc()).limit(50)
                result = await db.execute(stmt)
                analyses = result.scalars().all()

                forecasts = []
                for analysis in analyses:
                    data = analysis.analysis_data or {}
                    if isinstance(data, str):
                        try:
                            data = json.loads(data)
                        except json.JSONDecodeError:
                            data = {}

                    prophet = data.get("prophet", {})

                    item = GetSalesForecastResponse.ForecastItem(
                        sku_id=analysis.sku_id,
                        sku_name=data.get("sku_name", ""),
                        target_date=data.get("target_date", ""),
                        predicted_sales=prophet.get("yhat", 0.0),
                        predicted_lower=prophet.get("yhat_lower", 0.0),
                        predicted_upper=prophet.get("yhat_upper", 0.0),
                        trend=prophet.get("trend", 0.0),
                        analysis_label=analysis.analysis_label or "",
                        strategy_key=analysis.strategy_key or "",
                        current_stock=data.get("current_stock", 0),
                        method=prophet.get("method", "unknown"),
                    )
                    forecasts.append(item)

                return GetSalesForecastResponse(
                    code=0,
                    message="success",
                    forecasts=forecasts,
                )

        except Exception as e:
            logger.error(f"GetSalesForecast error: {e}")
            return GetSalesForecastResponse(code=1, message=str(e))

    def _mock_sales_forecast(self, store_id: int, sku_id: int) -> GetSalesForecastResponse:
        mock_forecasts = [
            GetSalesForecastResponse.ForecastItem(
                sku_id=101, sku_name="可口可乐 330ml", target_date="2026-05-05",
                predicted_sales=162.72, predicted_lower=153.96, predicted_upper=171.36,
                trend=195.42, analysis_label="缺货", strategy_key="inventory_shortage_low_stock",
                current_stock=23, method="prophet",
            ),
            GetSalesForecastResponse.ForecastItem(
                sku_id=102, sku_name="薯片原味 75g", target_date="2026-05-05",
                predicted_sales=64.55, predicted_lower=58.74, predicted_upper=70.51,
                trend=76.15, analysis_label="正常", strategy_key="normal",
                current_stock=156, method="prophet",
            ),
            GetSalesForecastResponse.ForecastItem(
                sku_id=103, sku_name="矿泉水 500ml", target_date="2026-05-05",
                predicted_sales=205.65, predicted_lower=196.94, predicted_upper=214.84,
                trend=247.36, analysis_label="缺货", strategy_key="inventory_shortage_low_stock",
                current_stock=48, method="prophet",
            ),
        ]
        if sku_id > 0:
            mock_forecasts = [f for f in mock_forecasts if f.sku_id == sku_id]
        return GetSalesForecastResponse(code=0, message="success (mock)", forecasts=mock_forecasts)


async def serve_grpc():
    try:
        server = grpc.aio.server()
        add_AiAnalysisAndChatServiceServicer_to_server(AiAnalysisAndChatService(), server)

        SERVICE_NAMES = (
            'ai.analysis.AiAnalysisAndChatService',
            reflection.SERVICE_NAME,
        )
        reflection.enable_server_reflection(SERVICE_NAMES, server)

        port = 50053
        server.add_insecure_port(f'[::]:{port}')
        await server.start()
        logger.info(f"gRPC server started on port {port}")
        print(f"gRPC server started on port {port}")
        await server.wait_for_termination()
    except Exception as e:
        logger.error(f"gRPC server error: {e}")
        print(f"gRPC server error: {e}")
        raise
