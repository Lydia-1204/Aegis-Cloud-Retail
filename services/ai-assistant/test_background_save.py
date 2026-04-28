import requests
import json
import time

def test_background_save():
    """测试后台任务保存对话日志"""
    base_url = "http://localhost:8084"
    
    print("测试后台任务保存对话日志")
    print("=" * 60)
    
    # 发起对话
    payload = {
        "store_id": 1,
        "query": "测试后台任务保存功能"
    }
    
    response = requests.post(
        f"{base_url}/api/ai/chat/completions",
        json=payload,
        stream=True,
        timeout=60
    )
    
    session_id = None
    full_response = ""
    
    if response.status_code == 200:
        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')
                if line.startswith('data: '):
                    try:
                        data = json.loads(line[5:])
                        session_id = data.get('session_id', session_id)
                        if data.get('content'):
                            full_response += data['content']
                    except json.JSONDecodeError:
                        pass
    
    print(f"会话 ID: {session_id}")
    print(f"响应长度: {len(full_response)} 字符")
    
    # 等待后台任务执行（2秒）
    print("\n等待后台任务执行...")
    time.sleep(2)
    
    # 查询会话列表
    response = requests.get(
        f"{base_url}/api/ai/chat/sessions",
        params={"store_id": 1},
        timeout=10
    )
    
    if response.status_code == 200:
        result = response.json()
        sessions = result['data']['data']
        session_ids = [s['session_id'] for s in sessions]
        
        print(f"\n会话列表中的会话ID:")
        for sid in session_ids:
            print(f"  - {sid}")
        
        if session_id in session_ids:
            print(f"\n✅ 会话 {session_id} 已成功保存到数据库！")
        else:
            print(f"\n❌ 会话 {session_id} 未保存到数据库")
    
    # 查询对话历史
    print("\n查询对话历史...")
    response = requests.get(
        f"{base_url}/api/ai/chat/history",
        params={"session_id": session_id},
        timeout=10
    )
    
    if response.status_code == 200:
        result = response.json()
        messages = result['data']['messages']
        print(f"✅ 对话历史获取成功")
        print(f"消息数量: {len(messages)}")
        for i, msg in enumerate(messages):
            print(f"消息 {i+1}: {msg['role']} - {msg['content'][:50]}...")
    elif response.status_code == 404:
        print("❌ 对话历史不存在，后台任务可能未执行")
    else:
        print(f"❌ 获取失败: {response.status_code}")

if __name__ == "__main__":
    test_background_save()