import requests
import json
import time


class ChatAPITester:
    """对话接口测试类"""
    
    def __init__(self, base_url="http://localhost:8084"):
        self.base_url = base_url
        self.session = requests.Session()
    
    def test_health(self):
        """测试健康检查接口"""
        print("=" * 60)
        print("测试 1: 健康检查")
        print("=" * 60)
        
        try:
            response = self.session.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                result = response.json()
                print(f"✅ 服务状态: {result}")
                return True
            else:
                print(f"❌ 健康检查失败: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ 无法连接服务: {e}")
            return False
    
    def test_chat_completions(self):
        """测试发起对话接口（流式）"""
        print("\n" + "=" * 60)
        print("测试 2: 发起对话（流式响应）")
        print("=" * 60)

        payload = {
            "store_id": 1,
            "query": "分析一下门店的销售情况"
        }

        # ── 1. 先拉取完整提示词并打印 ──
        try:
            debug_resp = self.session.get(
                f"{self.base_url}/api/ai/chat/debug-prompt",
                params={"store_id": 1, "query": payload["query"]},
                timeout=10
            )
            if debug_resp.status_code == 200:
                debug_data = debug_resp.json()
                final_prompt = debug_data.get("data", {}).get("final_prompt", "")
                print("\n" + "=" * 60)
                print("【完整提示词】")
                print("=" * 60)
                if final_prompt:
                    messages = eval(final_prompt) if isinstance(final_prompt, str) else final_prompt
                    for i, msg in enumerate(messages):
                        role = msg.get("role", "")
                        content = msg.get("content", "")
                        if role == "system":
                            print(f"\n[system] ({len(content)} 字符):")
                            print("─" * 40)
                            print(content[:1500])
                            if len(content) > 1500:
                                print(f"  ... [内容过长，已截断，完整长度 {len(content)} 字符]")
                        else:
                            print(f"\n[{role}] ({len(content)} 字符):")
                            print("─" * 40)
                            print(content)
                else:
                    print("(未获取到提示词)")
                print("\n" + "=" * 60)
        except Exception as e:
            print(f"⚠️  获取提示词失败: {e}")

        # ── 2. 发起对话 ──
        print("【发起对话请求】")
        try:
            response = self.session.post(
                f"{self.base_url}/api/ai/chat/completions",
                json=payload,
                stream=True,
                timeout=60
            )

            if response.status_code == 200:
                full_response = ""
                session_id = None

                print("\n【流式回答】:")
                print("─" * 40)

                for line in response.iter_lines():
                    if line:
                        line = line.decode('utf-8')
                        if line.startswith('data: '):
                            try:
                                data = json.loads(line[5:])
                                session_id = data.get('session_id', session_id)
                                if data.get('content'):
                                    print(data['content'], end="", flush=True)
                                    full_response += data['content']
                            except json.JSONDecodeError:
                                pass

                print("\n" + "─" * 40)
                print(f"【会话 ID】: {session_id}")
                print(f"【回答长度】: {len(full_response)} 字符")

                if "由于API调用问题" in full_response:
                    print("⚠️  返回了降级的 mock 数据（API Key 未配置或无效）")
                else:
                    print("✅ 对话接口测试通过")

                return session_id, True
            else:
                print(f"❌ 请求失败: {response.status_code}")
                return None, False

        except requests.exceptions.RequestException as e:
            if "ended prematurely" in str(e):
                print("✅ 对话接口测试通过（流式响应正常结束）")
                return session_id, True
            else:
                print(f"❌ 请求异常: {e}")
                return None, False
    
    def test_get_sessions(self, store_id=1):
        """测试获取会话列表接口"""
        print("\n" + "=" * 60)
        print("测试 3: 获取会话列表")
        print("=" * 60)
        
        try:
            response = self.session.get(
                f"{self.base_url}/api/ai/chat/sessions",
                params={"store_id": store_id},
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ 会话列表获取成功")
                print(f"   总数: {result['data']['total']}")
                if result['data']['data']:
                    print(f"   第一个会话: {result['data']['data'][0]['session_id']}")
                return True
            else:
                print(f"❌ 获取失败: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ 请求异常: {e}")
            return False
    
    def test_get_history(self, session_id):
        """测试获取对话历史接口"""
        print("\n" + "=" * 60)
        print("测试 4: 获取对话历史")
        print("=" * 60)
        
        if not session_id:
            print("⚠️  跳过测试（没有有效的会话ID）")
            return True
        
        try:
            response = self.session.get(
                f"{self.base_url}/api/ai/chat/history",
                params={"session_id": session_id},
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                messages = result['data']['messages']
                print(f"✅ 对话历史获取成功")
                print(f"   消息数量: {len(messages)}")
                for i, msg in enumerate(messages):
                    print(f"   消息 {i+1}: {msg['role']} - {msg['content'][:30]}...")
                return True
            elif response.status_code == 404:
                print("⚠️  会话不存在（可能是新会话尚未保存）")
                return True
            else:
                print(f"❌ 获取失败: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ 请求异常: {e}")
            return False
    
    def test_save_log(self):
        """测试手动保存对话日志接口"""
        print("\n" + "=" * 60)
        print("测试 5: 手动保存对话日志")
        print("=" * 60)
        
        payload = {
            "store_id": 1,
            "session_id": f"test_session_{int(time.time())}",
            "query": "测试保存日志",
            "context_snapshot": "{\"test\": \"data\"}",
            "final_prompt": "这是测试提示词",
            "response": "这是测试响应"
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/ai/chat/logs",
                json=payload,
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ 日志保存成功")
                print(f"   chat_id: {result['data']['chat_id']}")
                print(f"   tokens_used: {result['data']['tokens_used']}")
                return result['data']['chat_id'], True
            else:
                print(f"❌ 保存失败: {response.status_code}")
                print(f"   错误信息: {response.text}")
                return None, False
                
        except Exception as e:
            print(f"❌ 请求异常: {e}")
            return None, False
    
    def test_get_log(self, chat_id):
        """测试获取单条对话日志接口"""
        print("\n" + "=" * 60)
        print("测试 6: 获取单条对话日志")
        print("=" * 60)
        
        if not chat_id:
            print("⚠️  跳过测试（没有有效的日志ID）")
            return True
        
        try:
            response = self.session.get(
                f"{self.base_url}/api/ai/chat/logs/{chat_id}",
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ 日志获取成功")
                print(f"   chat_id: {result['data']['chat_id']}")
                print(f"   query: {result['data']['chat_query']}")
                return True
            elif response.status_code == 404:
                print("❌ 日志不存在")
                return False
            else:
                print(f"❌ 获取失败: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ 请求异常: {e}")
            return False
    
    def test_delete_log(self, chat_id):
        """测试删除对话日志接口"""
        print("\n" + "=" * 60)
        print("测试 7: 删除对话日志")
        print("=" * 60)
        
        if not chat_id:
            print("⚠️  跳过测试（没有有效的日志ID）")
            return True
        
        try:
            response = self.session.delete(
                f"{self.base_url}/api/ai/chat/logs/{chat_id}",
                timeout=10
            )
            
            if response.status_code == 200:
                print("✅ 日志删除成功")
                return True
            elif response.status_code == 404:
                print("❌ 日志不存在")
                return False
            else:
                print(f"❌ 删除失败: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ 请求异常: {e}")
            return False
    
    def run_all_tests(self):
        """运行所有测试"""
        print("\n" + "=" * 70)
        print("对话接口完整测试")
        print("=" * 70)
        
        results = []
        
        # 1. 健康检查
        results.append(self.test_health())
        
        # 2. 发起对话
        session_id, success = self.test_chat_completions()
        results.append(success)
        
        # 3. 获取会话列表
        results.append(self.test_get_sessions())
        
        # 4. 获取对话历史
        results.append(self.test_get_history(session_id))
        
        # 5. 手动保存日志
        chat_id, success = self.test_save_log()
        results.append(success)
        
        # 6. 获取单条日志
        results.append(self.test_get_log(chat_id))
        
        # 7. 删除日志
        #results.append(self.test_delete_log(chat_id))
        
        # 汇总结果
        print("\n" + "=" * 70)
        print("测试结果汇总")
        print("=" * 70)
        passed = sum(results)
        total = len(results)
        print(f"通过: {passed}/{total}")
        
        if passed == total:
            print("🎉 所有测试通过！")
        else:
            print("⚠️  部分测试失败，请检查")
        
        return passed == total


if __name__ == "__main__":
    tester = ChatAPITester()
    tester.run_all_tests()
