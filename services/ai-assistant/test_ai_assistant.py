import sys
import time
import json
import grpc
import requests

from ai_assistant.proto.ai_analysis_pb2 import (
    TriggerAnalysisRequest,
    GetAnalysisRequest,
    GetSalesForecastRequest,
)
from ai_assistant.proto.ai_analysis_pb2_grpc import AiAnalysisAndChatServiceStub

HTTP_BASE = "http://localhost:8084"
GRPC_ADDR = "localhost:50053"

passed = 0
failed = 0


def record(name, ok, detail=""):
    global passed, failed
    if ok:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        print(f"  ❌ {name}" + (f" — {detail}" if detail else ""))


def sep(title):
    print(f"\n{'='*60}\n{title}\n{'='*60}")


# ──────────────────────────────────────────────
# 1. HTTP 健康检查 & 数据库连接
# ──────────────────────────────────────────────
def test_health():
    sep("1. HTTP 健康检查")
    try:
        r = requests.get(f"{HTTP_BASE}/health", timeout=5)
        ok = r.status_code == 200 and r.json().get("status") == "ok"
        record("GET /health", ok, r.text[:100])
    except Exception as e:
        record("GET /health", False, str(e))


def test_database_connection():
    sep("2. 数据库连接检测")
    import asyncio
    from ai_assistant.config import database_url
    from ai_assistant.database import init_db, async_session_maker

    async def _test():
        db_url = database_url()
        if db_url:
            try:
                await init_db(db_url)
            except Exception as e:
                return False, f"init_db 失败: {e}"

        from ai_assistant.database import async_session_maker as asm
        if asm is not None:
            try:
                async with asm() as session:
                    from sqlalchemy import text
                    await session.execute(text("SELECT 1"))
                return True, "PostgreSQL 连接正常"
            except Exception as e:
                return False, f"连接成功但查询失败: {e}"
        else:
            return True, "Mock 模式（无数据库 URL）"

    ok, detail = asyncio.run(_test())
    record("数据库连接", ok, detail)


# ──────────────────────────────────────────────
# 3. gRPC 接口测试
# ──────────────────────────────────────────────
def test_grpc_trigger_daily_analysis():
    sep("3. gRPC — TriggerDailyAnalysis")
    channel = grpc.insecure_channel(GRPC_ADDR)
    stub = AiAnalysisAndChatServiceStub(channel)
    try:
        resp = stub.TriggerDailyAnalysis(
            TriggerAnalysisRequest(store_id=1, target_date="2026-05-05"),
            timeout=120,
        )
        record("TriggerDailyAnalysis(store_id=1)", resp.code == 0, resp.message)
    except grpc.RpcError as e:
        record("TriggerDailyAnalysis(store_id=1)", False, f"{e.code()}: {e.details()}")
    finally:
        channel.close()


def test_grpc_get_analysis_report():
    sep("4. gRPC — GetAnalysisReport")
    channel = grpc.insecure_channel(GRPC_ADDR)
    stub = AiAnalysisAndChatServiceStub(channel)
    try:
        resp = stub.GetAnalysisReport(
            GetAnalysisRequest(store_id=1, sku_id=0), timeout=30
        )
        record("GetAnalysisReport 返回成功", resp.code == 0, resp.message)
        record("reports 非空", len(resp.reports) > 0, f"共 {len(resp.reports)} 条")

        if resp.reports:
            r0 = resp.reports[0]
            record("analysis_label 非空", r0.analysis_label != "", r0.analysis_label)
            record("strategy_key 非空", r0.strategy_key != "", r0.strategy_key)
            record("analysis_data 可解析为 JSON", _is_valid_json(r0.analysis_data))
            record("analysis_time 非空", r0.analysis_time != "", r0.analysis_time)

            data = json.loads(r0.analysis_data) if r0.analysis_data else {}
            prophet = data.get("prophet", {})
            record("prophet.yhat > 0", prophet.get("yhat", 0) > 0, str(prophet.get("yhat")))
            record("prophet.method 有效", prophet.get("method") in ("prophet", "moving_average"), prophet.get("method"))
    except grpc.RpcError as e:
        record("GetAnalysisReport", False, f"{e.code()}: {e.details()}")
    finally:
        channel.close()


def test_grpc_get_sales_forecast():
    sep("5. gRPC — GetSalesForecast")
    channel = grpc.insecure_channel(GRPC_ADDR)
    stub = AiAnalysisAndChatServiceStub(channel)
    try:
        resp = stub.GetSalesForecast(
            GetSalesForecastRequest(store_id=1, sku_id=0), timeout=30
        )
        record("GetSalesForecast 返回成功", resp.code == 0, resp.message)
        record("forecasts 非空", len(resp.forecasts) > 0, f"共 {len(resp.forecasts)} 条")

        if resp.forecasts:
            f0 = resp.forecasts[0]
            record("sku_id > 0", f0.sku_id > 0, str(f0.sku_id))
            record("sku_name 非空", f0.sku_name != "", f0.sku_name)
            record("target_date 非空", f0.target_date != "", f0.target_date)
            record("predicted_sales > 0", f0.predicted_sales > 0, str(f0.predicted_sales))
            record("predicted_lower > 0", f0.predicted_lower > 0, str(f0.predicted_lower))
            record("predicted_upper > predicted_lower", f0.predicted_upper >= f0.predicted_lower)
            record("trend 有效", isinstance(f0.trend, float), str(f0.trend))
            record("analysis_label 有效", f0.analysis_label in ("正常", "缺货", "堆积"), f0.analysis_label)
            record("strategy_key 非空", f0.strategy_key != "", f0.strategy_key)
            record("current_stock >= 0", f0.current_stock >= 0, str(f0.current_stock))
            record("method 有效", f0.method in ("prophet", "moving_average"), f0.method)

        channel2 = grpc.insecure_channel(GRPC_ADDR)
        stub2 = AiAnalysisAndChatServiceStub(channel2)
        resp2 = stub2.GetSalesForecast(
            GetSalesForecastRequest(store_id=1, sku_id=101), timeout=30
        )
        record("sku_id=101 过滤生效", len(resp2.forecasts) > 0 and all(f.sku_id == 101 for f in resp2.forecasts))
        channel2.close()
    except grpc.RpcError as e:
        record("GetSalesForecast", False, f"{e.code()}: {e.details()}")
    finally:
        channel.close()


# ──────────────────────────────────────────────
# 6. HTTP 前端接口测试
# ──────────────────────────────────────────────
def test_http_chat_completions():
    sep("6. HTTP — POST /api/ai/chat/completions")
    try:
        r = requests.post(
            f"{HTTP_BASE}/api/ai/chat/completions",
            json={"store_id": 1, "query": "测试问题：库存情况如何？"},
            timeout=60,
        )
        record("HTTP 200", r.status_code == 200, f"status={r.status_code}")

        if r.status_code == 200:
            body = r.text
            has_session = "session_id" in body
            has_content = "content" in body
            has_finish = "is_finish" in body
            record("返回包含 session_id", has_session)
            record("返回包含 content", has_content)
            record("返回包含 is_finish", has_finish)
    except Exception as e:
        record("chat/completions", False, str(e))


def test_http_chat_sessions():
    sep("7. HTTP — GET /api/ai/chat/sessions")
    try:
        r = requests.get(f"{HTTP_BASE}/api/ai/chat/sessions", params={"store_id": 1}, timeout=10)
        record("HTTP 200", r.status_code == 200, f"status={r.status_code}")

        if r.status_code == 200:
            data = r.json()
            record("code == 0", data.get("code") == 0, str(data.get("code")))
            record("data 字段存在", "data" in data)
    except Exception as e:
        record("chat/sessions", False, str(e))


def test_http_save_and_get_chat_log():
    sep("8. HTTP — POST/GET /api/ai/chat/logs")
    try:
        save_r = requests.post(
            f"{HTTP_BASE}/api/ai/chat/logs",
            json={
                "store_id": 1,
                "session_id": f"test_sess_{int(time.time())}",
                "query": "测试保存日志",
                "response": "这是AI的测试回复",
            },
            timeout=10,
        )
        record("POST save log HTTP 200", save_r.status_code == 200, f"status={save_r.status_code}")

        if save_r.status_code == 200:
            save_data = save_r.json()
            chat_id = save_data.get("data", {}).get("chat_id")
            record("返回 chat_id", chat_id is not None, str(chat_id))

            if chat_id:
                get_r = requests.get(f"{HTTP_BASE}/api/ai/chat/logs/{chat_id}", timeout=10)
                record("GET log HTTP 200", get_r.status_code == 200, f"status={get_r.status_code}")

                if get_r.status_code == 200:
                    get_data = get_r.json()
                    record("查询到的 chat_id 匹配", get_data.get("data", {}).get("chat_id") == chat_id)

                del_r = requests.delete(f"{HTTP_BASE}/api/ai/chat/logs/{chat_id}", timeout=10)
                record("DELETE log HTTP 200", del_r.status_code == 200, f"status={del_r.status_code}")
    except Exception as e:
        record("chat/logs CRUD", False, str(e))


def test_http_chat_history():
    sep("9. HTTP — GET /api/ai/chat/history")
    try:
        r = requests.get(
            f"{HTTP_BASE}/api/ai/chat/sessions", params={"store_id": 1}, timeout=10
        )
        if r.status_code == 200:
            sessions = r.json().get("data", {}).get("data", [])
            if sessions:
                sid = sessions[0].get("session_id", "")
                h_r = requests.get(
                    f"{HTTP_BASE}/api/ai/chat/history", params={"session_id": sid}, timeout=10
                )
                record("GET history HTTP 200", h_r.status_code == 200, f"status={h_r.status_code}")
                if h_r.status_code == 200:
                    h_data = h_r.json()
                    msgs = h_data.get("data", {}).get("messages", [])
                    record("messages 非空", len(msgs) > 0, f"共 {len(msgs)} 条消息")
            else:
                record("GET history（跳过，无会话数据）", True)
    except Exception as e:
        record("chat/history", False, str(e))


# ──────────────────────────────────────────────
# 10. Go gRPC Client Mock Fallback 测试
# ──────────────────────────────────────────────
def test_go_client_mock_fallback():
    sep("10. Go gRPC Client Mock Fallback")
    import asyncio

    async def _test():
        from ai_assistant.grpc_client import go_client

        sku_dict = await go_client.get_sku_dictionary()
        record("get_sku_dictionary 返回非空", len(sku_dict) > 0, f"共 {len(sku_dict)} 个 SKU")
        if sku_dict:
            s = sku_dict[0]
            record("SKU 含 sku_id", "sku_id" in s, str(s.get("sku_id")))
            record("SKU 含 sku_name", "sku_name" in s, s.get("sku_name"))
            record("SKU 含 category_name", "category_name" in s, s.get("category_name"))
            record("SKU 含 std_cost", "std_cost" in s, str(s.get("std_cost")))
            record("SKU 含 sug_price", "sug_price" in s, str(s.get("sug_price")))
            record("SKU 含 sku_status", "sku_status" in s, s.get("sku_status"))

        store_ctx = await go_client.get_store_context(1)
        record("get_store_context 返回非空", store_ctx is not None)
        if store_ctx:
            record("含 store_id", "store_id" in store_ctx, str(store_ctx.get("store_id")))
            record("含 store_name", "store_name" in store_ctx, store_ctx.get("store_name"))
            record("含 store_location", "store_location" in store_ctx, store_ctx.get("store_location"))
            record("含 store_area", "store_area" in store_ctx, str(store_ctx.get("store_area")))
            record("含 store_status", "store_status" in store_ctx, store_ctx.get("store_status"))

        snapshot = await go_client.get_business_snapshot(1)
        record("get_business_snapshot 返回非空", snapshot is not None)
        if snapshot:
            inv = snapshot.get("current_inventory", [])
            sales = snapshot.get("daily_sales_list", [])
            record("current_inventory 非空", len(inv) > 0, f"共 {len(inv)} 项")
            record("daily_sales_list 非空", len(sales) > 0, f"共 {len(sales)} 天")
            if inv:
                record("inventory 含 sku_id", "sku_id" in inv[0], str(inv[0].get("sku_id")))
                record("inventory 含 actual_quantity", "actual_quantity" in inv[0], str(inv[0].get("actual_quantity")))
            if sales:
                record("sales 含 sales_date", "sales_date" in sales[0], sales[0].get("sales_date"))
                record("sales 含 total_income", "total_income" in sales[0], str(sales[0].get("total_income")))
                record("sales 含 total_orders", "total_orders" in sales[0], str(sales[0].get("total_orders")))
                record("sales 含 details", "details" in sales[0], f"{len(sales[0].get('details', []))} 条")

    asyncio.run(_test())


# ──────────────────────────────────────────────
# 11. Prophet 预测服务测试
# ──────────────────────────────────────────────
def test_prophet_service():
    sep("11. Prophet 预测服务")
    from ai_assistant.prophet_service import ProphetService, PROPHET_AVAILABLE

    record("Prophet 库可用", PROPHET_AVAILABLE, "prophet" if PROPHET_AVAILABLE else "moving_average fallback")

    from ai_assistant.mock_data import MockBusinessData
    data = MockBusinessData.get_historical_sales(1, 101, 30)
    record("历史数据 30 天", len(data) == 30, f"实际 {len(data)} 天")

    result = ProphetService.predict(data, periods=1)
    record("predict 返回 yhat", "yhat" in result, str(result.get("yhat")))
    record("predict 返回 yhat_lower", "yhat_lower" in result, str(result.get("yhat_lower")))
    record("predict 返回 yhat_upper", "yhat_upper" in result, str(result.get("yhat_upper")))
    record("predict 返回 trend", "trend" in result, str(result.get("trend")))
    record("predict 返回 method", "method" in result, result.get("method"))
    record("yhat > 0", result.get("yhat", 0) > 0, str(result.get("yhat")))
    record("yhat_upper >= yhat_lower", result.get("yhat_upper", 0) >= result.get("yhat_lower", 0))

    label, key = ProphetService.determine_label(100, 10)
    record("determine_label(100,10) → 缺货", label == "缺货", f"{label}/{key}")

    label2, key2 = ProphetService.determine_label(10, 500)
    record("determine_label(10,500) → 堆积", label2 == "堆积", f"{label2}/{key2}")

    label3, key3 = ProphetService.determine_label(50, 200)
    record("determine_label(50,200) → 正常", label3 == "正常", f"{label3}/{key3}")


# ──────────────────────────────────────────────
# 工具函数
# ──────────────────────────────────────────────
def _is_valid_json(s):
    try:
        json.loads(s)
        return True
    except (json.JSONDecodeError, TypeError):
        return False


# ──────────────────────────────────────────────
# 主入口
# ──────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("AI 对话与分析微服务 — 全接口测试")
    print("=" * 60)

    test_health()
    test_database_connection()
    test_grpc_trigger_daily_analysis()
    test_grpc_get_analysis_report()
    test_grpc_get_sales_forecast()
    test_http_chat_completions()
    test_http_chat_sessions()
    test_http_save_and_get_chat_log()
    test_http_chat_history()
    test_go_client_mock_fallback()
    test_prophet_service()

    print(f"\n{'='*60}")
    print(f"测试结果汇总：通过 {passed}/{passed + failed}")
    print(f"{'='*60}")
    if failed == 0:
        print("🎉 所有测试通过！")
    else:
        print(f"⚠️ {failed} 项测试失败，请检查")
    sys.exit(0 if failed == 0 else 1)
