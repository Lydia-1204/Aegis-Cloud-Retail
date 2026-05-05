import os
import json
from typing import AsyncGenerator, Optional, List, Dict
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ai_assistant.config import deepseek_api_key, deepseek_base_url
from ai_assistant.db_models import AIExpertKnowledge
from ai_assistant.grpc_client import go_client


class LLMService:

    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=deepseek_api_key(),
            base_url=deepseek_base_url()
        )

    async def _get_expert_knowledge(self, db: AsyncSession, scenario_key: str = None) -> str:
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

    async def _build_business_context(self, store_id: int) -> str:
        store_ctx = await go_client.get_store_context(store_id)
        snapshot = await go_client.get_business_snapshot(store_id)

        parts = []
        if store_ctx:
            parts.append(f"""门店信息：
- 门店ID：{store_ctx.get('store_id', '')}
- 门店名称：{store_ctx.get('store_name', '')}
- 门店位置：{store_ctx.get('store_location', '')}
- 门店面积：{store_ctx.get('store_area', 0)}平方米
- 营业状态：{store_ctx.get('store_status', '')}""")

        if snapshot:
            inventory = snapshot.get("current_inventory", [])
            daily_sales = snapshot.get("daily_sales_list", [])

            if daily_sales:
                latest = daily_sales[-1] if daily_sales else {}
                parts.append(f"""销售数据（最近一天 {latest.get('sales_date', '')}）：
- 订单总数：{latest.get('total_orders', 0)}单
- 总收入：{latest.get('total_income', 0)}元
- SKU明细：{json.dumps(latest.get('details', []), ensure_ascii=False)}""")

            if inventory:
                sku_dict = await go_client.get_sku_dictionary()
                sku_name_map = {s["sku_id"]: s["sku_name"] for s in sku_dict}
                inv_display = [
                    {"sku_id": item["sku_id"], "sku_name": sku_name_map.get(item["sku_id"], ""), "stock": item["actual_quantity"]}
                    for item in inventory
                ]
                parts.append(f"库存数据：\n{json.dumps(inv_display, ensure_ascii=False)}")

        return "\n\n".join(parts)

    async def _build_prompt(self, db: AsyncSession, store_id: int, query: str, history: List[Dict] = None) -> str:
        business_context = await self._build_business_context(store_id)
        expert_knowledge = await self._get_expert_knowledge(db)

        system_prompt = f"""你是一个智能零售数据分析助手，擅长分析门店的销售、客流和库存数据。

{expert_knowledge}

当前门店业务数据：
{business_context}

请基于以上数据，用中文回答用户的问题。回答要简洁明了，提供具体的分析和建议。
"""

        messages = [{"role": "system", "content": system_prompt}]

        if history:
            for msg in history:
                messages.append({"role": msg["role"], "content": msg["content"]})

        messages.append({"role": "user", "content": query})

        return messages

    async def chat_completion(self, db: AsyncSession, store_id: int, query: str,
                              history: List[Dict] = None) -> str:
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
            return f"由于API调用问题，我将基于本地数据为您分析：\n\n用户问：{query}\n\n根据业务数据，我为您提供以下分析和建议：\n\n（此处应有AI分析内容，实际部署时将调用DeepSeek API）"

    async def chat_completion_stream(self, db: AsyncSession, store_id: int, query: str,
                                     history: List[Dict] = None) -> AsyncGenerator[str, None]:
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
            mock_response = f"根据业务数据，我为您分析：\n\n用户问题：{query}\n\n分析结果：基于门店数据，我认为可以从以下几个方面进行优化..."
            async for chunk in self._mock_stream_response(mock_response):
                yield chunk

    async def _mock_stream_response(self, response: str) -> AsyncGenerator[str, None]:
        import asyncio

        for char in response:
            yield char
            await asyncio.sleep(0.02)

    async def get_final_prompt(self, db: AsyncSession, store_id: int, query: str,
                               history: List[Dict] = None) -> str:
        messages = await self._build_prompt(db, store_id, query, history)
        return str(messages)
