import requests
import json
import time


def test_save_and_verify():
    """测试保存对话日志并验证数据确实写入数据库"""
    base_url = "http://localhost:8084"
    session = requests.Session()
    
    print("=" * 70)
    print("测试：保存对话日志并验证")
    print("=" * 70)
    
    # 准备测试数据
    test_session_id = f"session_{int(time.time())}"
    test_data = {
        "store_id": 1,
        "session_id": test_session_id,
        "query": "门店1的可口可乐库存好像不太够，能帮我分析一下吗？",
        "context_snapshot": json.dumps({
            "sku_id": 101,
            "sku_name": "可口可乐 330ml",
            "store_id": 1,
            "actual_quantity": 23,
            "daily_sales_avg": 15
        }),
        "final_prompt": "Based on store inventory and historical sales data analysis, generate inventory shortage warning...",
        "response": "根据分析，门店1可口可乐（SKU001）当前库存为23瓶，日均销量约15瓶，按此趋势仅够销售1.5天。建议：1) 检查总部仓库库存；2) 从总部调拨50瓶；3) 或从门店2临时调拨30瓶。"
    }
    
    # 1. 保存日志
    print("\n1. 保存对话日志")
    try:
        response = session.post(
            f"{base_url}/api/ai/chat/logs",
            json=test_data,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            chat_id = result['data']['chat_id']
            print(f"✅ 保存成功")
            print(f"   chat_id: {chat_id}")
            print(f"   tokens_used: {result['data']['tokens_used']}")
        else:
            print(f"❌ 保存失败: {response.status_code}")
            print(f"   错误信息: {response.text}")
            return
    except Exception as e:
        print(f"❌ 请求异常: {e}")
        return
    
    # 2. 获取保存的数据进行验证
    print("\n2. 验证保存的数据")
    try:
        response = session.get(
            f"{base_url}/api/ai/chat/logs/{chat_id}",
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            saved_data = result['data']
            
            print(f"✅ 获取成功，数据如下：")
            print(f"   chat_id: {saved_data['chat_id']}")
            print(f"   store_id: {saved_data['store_id']}")
            print(f"   chat_session_id: {saved_data['chat_session_id']}")
            print(f"   chat_query: {saved_data['chat_query']}")
            print(f"   context_snapshot: {json.dumps(saved_data['context_snapshot'], ensure_ascii=False)}")
            print(f"   chat_tokens_used: {saved_data['chat_tokens_used']}")
            print(f"   chat_time: {saved_data['chat_time']}")
            
            # 验证数据完整性
            assert saved_data['store_id'] == test_data['store_id'], "store_id 不匹配"
            assert saved_data['chat_session_id'] == test_data['session_id'], "session_id 不匹配"
            assert saved_data['chat_query'] == test_data['query'], "query 不匹配"
            assert saved_data['ai_response'] == test_data['response'], "response 不匹配"
            
            print("\n✅ 数据验证通过！数据已成功写入数据库")
            
        else:
            print(f"❌ 获取失败: {response.status_code}")
            
    except Exception as e:
        print(f"❌ 请求异常: {e}")
        return
    
    # 3. 查询会话列表确认数据存在
    print("\n3. 检查会话列表")
    try:
        response = session.get(
            f"{base_url}/api/ai/chat/sessions",
            params={"store_id": 1},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            sessions = result['data']['data']
            session_ids = [s['session_id'] for s in sessions]
            
            if test_session_id in session_ids:
                print(f"✅ 会话 {test_session_id} 已在会话列表中")
            else:
                print(f"❌ 会话 {test_session_id} 不在列表中")
                
    except Exception as e:
        print(f"❌ 请求异常: {e}")


if __name__ == "__main__":
    test_save_verify()