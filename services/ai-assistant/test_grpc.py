import grpc
import json
from ai_assistant.proto.ai_analysis_pb2 import (
    TriggerAnalysisRequest,
    GetAnalysisRequest,
    GetSalesForecastRequest,
)
from ai_assistant.proto.ai_analysis_pb2_grpc import AiAnalysisAndChatServiceStub


def test_trigger_daily_analysis():
    print("=" * 60)
    print("测试 1: TriggerDailyAnalysis")
    print("=" * 60)

    channel = grpc.insecure_channel('localhost:50053')
    stub = AiAnalysisAndChatServiceStub(channel)

    request = TriggerAnalysisRequest(
        store_id=1,
        target_date="2026-05-02"
    )

    try:
        response = stub.TriggerDailyAnalysis(request, timeout=60)
        print(f"code: {response.code}")
        print(f"message: {response.message}")

        if response.code == 0:
            print("✅ TriggerDailyAnalysis 测试通过")
        else:
            print("❌ TriggerDailyAnalysis 测试失败")
        return response.code == 0
    except grpc.RpcError as e:
        print(f"❌ gRPC 调用失败: {e.code()} - {e.details()}")
        return False
    finally:
        channel.close()


def test_get_analysis_report():
    print("\n" + "=" * 60)
    print("测试 2: GetAnalysisReport")
    print("=" * 60)

    channel = grpc.insecure_channel('localhost:50053')
    stub = AiAnalysisAndChatServiceStub(channel)

    request = GetAnalysisRequest(
        store_id=1,
        sku_id=0
    )

    try:
        response = stub.GetAnalysisReport(request, timeout=30)
        print(f"code: {response.code}")
        print(f"message: {response.message}")
        print(f"报告数量: {len(response.reports)}")

        for i, report in enumerate(response.reports[:3]):
            print(f"\n  报告 {i+1}:")
            print(f"    ai_analysis_id: {report.ai_analysis_id}")
            print(f"    analysis_label: {report.analysis_label}")
            print(f"    strategy_key: {report.strategy_key}")
            print(f"    analysis_time: {report.analysis_time}")
            try:
                data = json.loads(report.analysis_data)
                print(f"    analysis_data: {json.dumps(data, ensure_ascii=False, indent=2)[:200]}...")
            except (json.JSONDecodeError, TypeError):
                print(f"    analysis_data: {report.analysis_data[:200] if report.analysis_data else 'N/A'}")

        if response.code == 0:
            print("\n✅ GetAnalysisReport 测试通过")
        else:
            print("\n❌ GetAnalysisReport 测试失败")
        return response.code == 0
    except grpc.RpcError as e:
        print(f"❌ gRPC 调用失败: {e.code()} - {e.details()}")
        return False
    finally:
        channel.close()


def test_get_sales_forecast():
    print("\n" + "=" * 60)
    print("测试 3: GetSalesForecast")
    print("=" * 60)

    channel = grpc.insecure_channel('localhost:50053')
    stub = AiAnalysisAndChatServiceStub(channel)

    request = GetSalesForecastRequest(
        store_id=1,
        sku_id=0
    )

    try:
        response = stub.GetSalesForecast(request, timeout=30)
        print(f"code: {response.code}")
        print(f"message: {response.message}")
        print(f"预测数量: {len(response.forecasts)}")

        for i, fc in enumerate(response.forecasts):
            print(f"\n  预测 {i+1}:")
            print(f"    sku_id: {fc.sku_id}")
            print(f"    sku_name: {fc.sku_name}")
            print(f"    target_date: {fc.target_date}")
            print(f"    predicted_sales: {fc.predicted_sales}")
            print(f"    predicted_lower: {fc.predicted_lower}")
            print(f"    predicted_upper: {fc.predicted_upper}")
            print(f"    trend: {fc.trend}")
            print(f"    analysis_label: {fc.analysis_label}")
            print(f"    strategy_key: {fc.strategy_key}")
            print(f"    current_stock: {fc.current_stock}")
            print(f"    method: {fc.method}")

        if response.code == 0 and len(response.forecasts) > 0:
            print("\n✅ GetSalesForecast 测试通过")
        else:
            print("\n❌ GetSalesForecast 测试失败")
        return response.code == 0 and len(response.forecasts) > 0
    except grpc.RpcError as e:
        print(f"❌ gRPC 调用失败: {e.code()} - {e.details()}")
        return False
    finally:
        channel.close()


def test_health():
    import requests
    print("=" * 60)
    print("测试 0: 健康检查 (HTTP)")
    print("=" * 60)

    try:
        response = requests.get("http://localhost:8084/health", timeout=5)
        if response.status_code == 200:
            print(f"✅ HTTP 服务正常: {response.json()}")
            return True
        else:
            print(f"❌ HTTP 服务异常: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ HTTP 服务不可达: {e}")
        return False


if __name__ == "__main__":
    results = []
    results.append(test_health())
    results.append(test_trigger_daily_analysis())
    results.append(test_get_analysis_report())
    results.append(test_get_sales_forecast())

    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"通过: {passed}/{total}")
    if passed == total:
        print("🎉 所有测试通过！")
    else:
        print("⚠️ 部分测试失败，请检查")
