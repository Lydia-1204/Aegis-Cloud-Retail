import os
from typing import AsyncGenerator, Optional, List, Dict
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ai_assistant.config import deepseek_api_key, deepseek_base_url
from ai_assistant.db_models import AIExpertKnowledge
from ai_assistant.mock_data import MockBusinessData


class LLMService:
    """LLM服务封装"""
    
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=deepseek_api_key(),
            base_url=deepseek_base_url()
        )
    
    async def _get_expert_knowledge(self, db: AsyncSession, scenario_key: str = None) -> str:
        """从专家知识库获取知识"""
        try:
            query = select(AIExpertKnowledge).filter(AIExpertKnowledge.is_active == True)
            if scenario_key:
                query = query.filter(AIExpertKnowledge.strategy_key == scenario_key)
            
            result = await db.execute(query)
            knowledge_list = result.scalars().all()
            
            if not knowledge_list:
                return ""
            
            knowledge_text = "\n\n专家知识库：\n"
            for knowledge in knowledge_list:
                knowledge_text += f"- {knowledge.scenario_name}：{knowledge.expert_prompt}\n"
            
            return knowledge_text
        except Exception:
            return ""
    
    async def _build_prompt(self, db: AsyncSession, store_id: int, query: str, history: List[Dict] = None) -> str:
        """构建提示词"""
        # 获取业务数据
        business_context = MockBusinessData.get_business_context(store_id)
        
        # 获取专家知识
        expert_knowledge = await self._get_expert_knowledge(db)
        
        # 构建系统提示词
        system_prompt = f"""你是一个智能零售数据分析助手，擅长分析门店的销售、客流和库存数据。

{expert_knowledge}

当前门店业务数据：
{business_context}

请基于以上数据，用中文回答用户的问题。回答要简洁明了，提供具体的分析和建议。
"""
        
        # 构建消息列表
        messages = [{"role": "system", "content": system_prompt}]
        
        # 添加历史对话
        if history:
            for msg in history:
                messages.append({"role": msg["role"], "content": msg["content"]})
        
        # 添加当前问题
        messages.append({"role": "user", "content": query})
        
        return messages
    
    async def chat_completion(self, db: AsyncSession, store_id: int, query: str, 
                              history: List[Dict] = None) -> str:
        """同步调用LLM"""
        messages = await self._build_prompt(db, store_id, query, history)
        
        try:
            response = await self.client.chat.completions.create(
                model="deepseek-v4-pro",
                messages=messages,
                stream=False,
                reasoning_effort="high",
                extra_body={"thinking": {"type": "enabled"}}
            )
            return response.choices[0].message.content
        except Exception as e:
            # 如果LLM调用失败，返回mock响应
            return f"由于API调用问题，我将基于本地数据为您分析：\n\n用户问：{query}\n\n根据业务数据，我为您提供以下分析和建议：\n\n（此处应有AI分析内容，实际部署时将调用DeepSeek API）"
    
    async def chat_completion_stream(self, db: AsyncSession, store_id: int, query: str,
                                     history: List[Dict] = None) -> AsyncGenerator[str, None]:
        """流式调用LLM"""
        messages = await self._build_prompt(db, store_id, query, history)
        
        try:
            stream = await self.client.chat.completions.create(
                model="deepseek-v4-pro",
                messages=messages,
                stream=True,
                reasoning_effort="high",
                extra_body={"thinking": {"type": "enabled"}}
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            # 如果LLM调用失败，返回mock响应
            mock_response = f"根据业务数据，我为您分析：\n\n用户问题：{query}\n\n分析结果：基于门店数据，我认为可以从以下几个方面进行优化..."
            async for chunk in self._mock_stream_response(mock_response):
                yield chunk
    
    async def _mock_stream_response(self, response: str) -> AsyncGenerator[str, None]:
        """模拟流式响应"""
        import asyncio
        
        # 逐个字符返回，模拟流式输出
        for char in response:
            yield char
            await asyncio.sleep(0.02)
    
    async def get_final_prompt(self, db: AsyncSession, store_id: int, query: str,
                               history: List[Dict] = None) -> str:
        """获取最终拼接的提示词（用于日志记录）"""
        messages = await self._build_prompt(db, store_id, query, history)
        return str(messages)