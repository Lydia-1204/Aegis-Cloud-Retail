import logging
from typing import AsyncGenerator, Optional, List, Dict

from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ai_assistant.config import deepseek_api_key, deepseek_base_url
from ai_assistant.db_models import AIExpertKnowledge
from ai_assistant.grpc_client import go_client


logger = logging.getLogger(__name__)


class LLMService:

    def __init__(self):
        api_key = deepseek_api_key()
        self.client: Optional[AsyncOpenAI] = None
        if not api_key:
            logger.warning("LLM API key not configured, using local fallback")
            return

        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=deepseek_base_url()
        )

    @staticmethod
    def _format_money(value) -> str:
        try:
            return f"{float(value):.2f}"
        except (TypeError, ValueError):
            return "0.00"

    @staticmethod
    def _format_int(value) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return 0

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
        sku_map = {}

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

            if inventory or daily_sales:
                sku_dict = await go_client.get_sku_dictionary()
                sku_map = {self._format_int(s.get("sku_id")): s for s in sku_dict}

            if daily_sales:
                latest = daily_sales[-1]
                sales_lines = [
                    "销售数据口径说明：",
                    "- total_orders 表示门店当日订单总数，单位：单。",
                    "- total_income 表示门店当日总销售收入，单位：元。",
                    "- sku_amount 表示该 SKU 当日售出数量，单位：件/瓶/包等销售单位；sku_amount 不是金额。",
                    "- 如果回答某个 SKU 卖了多少，必须使用 sku_amount 作为售出数量；不要把 sku_amount 说成收入。",
                    "",
                    f"最近一天销售汇总（数据日期：{latest.get('sales_date', '')}）：",
                    f"- 订单总数：{latest.get('total_orders', 0)}单",
                    f"- 门店总收入：{self._format_money(latest.get('total_income', 0))}元",
                    "- 最近一天 SKU 销售明细：",
                ]

                for detail in latest.get("details", []):
                    sku_id = self._format_int(detail.get("sku_id"))
                    sku_amount = self._format_int(detail.get("sku_amount"))
                    sku = sku_map.get(sku_id, {})
                    sku_name = sku.get("sku_name", f"SKU {sku_id}")
                    sug_price = sku.get("sug_price")
                    if sug_price is not None:
                        estimated_income = sku_amount * float(sug_price)
                        sales_lines.append(
                            f"  - sku_id={sku_id}，商品={sku_name}，售出数量={sku_amount}，"
                            f"建议售价={self._format_money(sug_price)}元，"
                            f"按建议售价估算销售额={self._format_money(estimated_income)}元"
                        )
                    else:
                        sales_lines.append(
                            f"  - sku_id={sku_id}，商品={sku_name}，售出数量={sku_amount}"
                        )

                recent_sales = daily_sales[-14:]
                sales_lines.append("")
                sales_lines.append("最近销售数量历史（每个商品后的数字都是售出数量，不是收入）：")
                for day in recent_sales:
                    day_parts = []
                    for detail in day.get("details", []):
                        sku_id = self._format_int(detail.get("sku_id"))
                        sku_amount = self._format_int(detail.get("sku_amount"))
                        sku_name = sku_map.get(sku_id, {}).get("sku_name", f"SKU {sku_id}")
                        day_parts.append(f"{sku_name}={sku_amount}")
                    sales_lines.append(
                        f"- {day.get('sales_date', '')}：{'; '.join(day_parts)}；"
                        f"门店总收入={self._format_money(day.get('total_income', 0))}元；"
                        f"订单数={day.get('total_orders', 0)}单"
                    )

                parts.append("\n".join(sales_lines))

            if inventory:
                inventory_lines = [
                    "库存数据口径说明：",
                    "- actual_quantity/stock 表示当前库存数量，单位与 SKU 销售单位一致。",
                    "- 库存不是销量；回答补货建议时需要同时参考近期 sku_amount 和当前库存。",
                    "",
                    "当前库存明细：",
                ]
                for item in inventory:
                    sku_id = self._format_int(item.get("sku_id"))
                    sku_name = sku_map.get(sku_id, {}).get("sku_name", f"SKU {sku_id}")
                    stock = self._format_int(item.get("actual_quantity"))
                    inventory_lines.append(f"- sku_id={sku_id}，商品={sku_name}，当前库存={stock}")

                parts.append("\n".join(inventory_lines))

        return "\n\n".join(parts)

    async def _build_prompt(self, db: AsyncSession, store_id: int, query: str, history: List[Dict] = None) -> List[Dict]:
        business_context = await self._build_business_context(store_id)
        expert_knowledge = await self._get_expert_knowledge(db)

        system_prompt = f"""你是 Aegis 智能零售经营分析助手，擅长基于门店销售、客流、库存和调拨数据回答经营问题。

回答规则：
1. 优先回答用户真正问的问题，不要泛泛而谈。
2. 所有结论必须基于【当前门店业务数据】或【专家知识库】；数据没有提供时要明确说明“当前数据未提供”，不要编造。
3. 用户问具体商品时，必须先通过商品名称或 sku_id 匹配 SKU，再回答该 SKU 的销量、库存或补货建议。
4. 字段含义必须严格遵守：
   - sku_amount = SKU 售出数量，单位是件/瓶/包等销售单位，不是金额。
   - total_income = 门店当日总收入，单位是元，不是单个 SKU 的收入。
   - actual_quantity/stock = 当前库存数量，不是销量。
5. 如果需要估算 SKU 销售额，只能用“售出数量 * 建议售价”估算，并必须说明这是估算；不要把估算值当成数据库真实收入。
6. 回答涉及“今天、昨天、最近一天”时，以销售数据里的 sales_date 为准，并在回答中写明使用的数据日期。
7. 历史对话只用于理解上下文，不能覆盖本轮提供的最新业务数据。
8. 回答保持中文、简洁、可执行。能直接给数字时直接给数字，再补充简短分析。

{expert_knowledge}

当前门店业务数据：
{business_context}

请基于以上数据回答用户问题。
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
            if self.client is None:
                raise RuntimeError("LLM client is not configured")

            response = await self.client.chat.completions.create(
                model="deepseek-v4-pro",
                messages=messages,
                stream=False,
                reasoning_effort="high",
                extra_body={"thinking": {"type": "enabled"}}
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.warning("LLM chat completion failed: %s", e)
            return (
                "由于 LLM API 调用异常，暂时无法生成完整智能分析。\n\n"
                f"用户问题：{query}\n\n"
                "请稍后重试，或查看系统注入的门店经营数据进行人工核对。"
            )

    async def chat_completion_stream(self, db: AsyncSession, store_id: int, query: str,
                                     history: List[Dict] = None) -> AsyncGenerator[str, None]:
        messages = await self._build_prompt(db, store_id, query, history)

        try:
            if self.client is None:
                raise RuntimeError("LLM client is not configured")

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
            logger.warning("LLM chat completion stream failed: %s", e)
            mock_response = (
                "由于 LLM API 调用异常，暂时无法生成完整智能分析。\n\n"
                f"用户问题：{query}\n\n"
                "请稍后重试，或查看系统注入的门店经营数据进行人工核对。"
            )
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
