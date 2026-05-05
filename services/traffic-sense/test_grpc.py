import grpc
from traffic_sense.proto.perception_pb2 import GetRawFlowRequest
from traffic_sense.proto.perception_pb2_grpc import AiPerceptionServiceStub


def test_get_raw_customer_flow():
    with grpc.insecure_channel('localhost:50051') as channel:
        stub = AiPerceptionServiceStub(channel)
        request = GetRawFlowRequest(
            store_id=2,
            start_time="2026-04-19T00:00:00Z",
            end_time="2026-04-19T23:59:59Z"
        )
        response = stub.GetRawCustomerFlow(request)
        print(f"Response: {response}")
        print(f"Code: {response.code}")
        print(f"Message: {response.message}")
        print(f"Flow list count: {len(response.flow_list)}")
        for item in response.flow_list:
            print(f"  Item: id={item.ai_customer_id}, store_id={item.store_id}, enter={item.customer_enter_total}")


if __name__ == "__main__":
    test_get_raw_customer_flow()
