import logging
from typing import AsyncGenerator, Dict, List, Optional

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
            base_url=deepseek_base_url(),
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

    async def build_context_snapshot(self, store_id: int) -> Dict:
        if store_id == 0:
            return await self._build_headquarters_context_snapshot()

        store_ctx = await go_client.get_store_context(store_id)
        snapshot = await go_client.get_business_snapshot(store_id)
        return {
            "scope": "store",
            "store": store_ctx,
            "snapshot": snapshot,
        }

    async def _build_headquarters_context_snapshot(self) -> Dict:
        hq_ctx = await go_client.get_store_context(0)
        stores = await go_client.list_stores("active")
        snapshots = []
        for store in stores:
            real_store_id = self._format_int(store.get("store_id"))
            if real_store_id <= 0:
                continue
            snapshot = await go_client.get_business_snapshot(real_store_id)
            snapshots.append({
                "store": store,
                "snapshot": snapshot,
            })

        return {
            "scope": "headquarters",
            "store": hq_ctx,
            "stores": stores,
            "snapshots": snapshots,
            "summary": self._summarize_headquarters_snapshots(snapshots),
        }

    def _summarize_headquarters_snapshots(self, snapshots: List[Dict]) -> Dict:
        daily_totals: Dict[str, Dict] = {}
        sku_sales_totals: Dict[int, int] = {}
        inventory_totals: Dict[int, int] = {}
        period_store_rank = []
        latest_store_rank = []

        for item in snapshots:
            store = item.get("store") or {}
            snapshot = item.get("snapshot") or {}
            store_id = self._format_int(store.get("store_id"))
            store_name = store.get("store_name") or f"门店{store_id}"
            daily_sales = snapshot.get("daily_sales_list", [])
            inventory = snapshot.get("current_inventory", [])

            period_income = 0.0
            period_orders = 0
            latest_day = None
            for day in daily_sales:
                sales_date = day.get("sales_date") or ""
                total_income = float(day.get("total_income") or 0)
                total_orders = self._format_int(day.get("total_orders"))
                period_income += total_income
                period_orders += total_orders
                if sales_date:
                    daily = daily_totals.setdefault(
                        sales_date,
                        {"sales_date": sales_date, "total_income": 0.0, "total_orders": 0},
                    )
                    daily["total_income"] += total_income
                    daily["total_orders"] += total_orders
                if latest_day is None or sales_date > (latest_day.get("sales_date") or ""):
                    latest_day = day

                for detail in day.get("details", []):
                    sku_id = self._format_int(detail.get("sku_id"))
                    sku_amount = self._format_int(detail.get("sku_amount"))
                    sku_sales_totals[sku_id] = sku_sales_totals.get(sku_id, 0) + sku_amount

            for inv in inventory:
                sku_id = self._format_int(inv.get("sku_id"))
                actual_quantity = self._format_int(inv.get("actual_quantity"))
                inventory_totals[sku_id] = inventory_totals.get(sku_id, 0) + actual_quantity

            period_store_rank.append({
                "store_id": store_id,
                "store_name": store_name,
                "total_income": round(period_income, 2),
                "total_orders": period_orders,
            })
            if latest_day:
                latest_store_rank.append({
                    "store_id": store_id,
                    "store_name": store_name,
                    "sales_date": latest_day.get("sales_date"),
                    "total_income": round(float(latest_day.get("total_income") or 0), 2),
                    "total_orders": self._format_int(latest_day.get("total_orders")),
                })

        daily_list = sorted(daily_totals.values(), key=lambda row: row["sales_date"])
        latest_sales_date = daily_list[-1]["sales_date"] if daily_list else ""
        latest_total = daily_totals.get(
            latest_sales_date,
            {"total_income": 0.0, "total_orders": 0},
        )
        period_total_income = sum(float(day["total_income"]) for day in daily_list)
        period_total_orders = sum(self._format_int(day["total_orders"]) for day in daily_list)

        return {
            "store_count": len(snapshots),
            "latest_sales_date": latest_sales_date,
            "latest_total_income": round(float(latest_total["total_income"]), 2),
            "latest_total_orders": self._format_int(latest_total["total_orders"]),
            "period_total_income": round(period_total_income, 2),
            "period_total_orders": period_total_orders,
            "daily_totals": [
                {
                    "sales_date": day["sales_date"],
                    "total_income": round(float(day["total_income"]), 2),
                    "total_orders": self._format_int(day["total_orders"]),
                }
                for day in daily_list[-14:]
            ],
            "store_sales_rank": sorted(
                latest_store_rank,
                key=lambda row: row["total_income"],
                reverse=True,
            ),
            "period_store_sales_rank": sorted(
                period_store_rank,
                key=lambda row: row["total_income"],
                reverse=True,
            ),
            "sku_sales_totals": [
                {"sku_id": sku_id, "sku_amount": amount}
                for sku_id, amount in sorted(sku_sales_totals.items())
            ],
            "inventory_totals": [
                {"sku_id": sku_id, "actual_quantity": quantity}
                for sku_id, quantity in sorted(inventory_totals.items())
            ],
        }

    async def _build_business_context(
        self,
        store_id: int,
        context_snapshot: Optional[Dict] = None,
    ) -> str:
        if context_snapshot is None:
            context_snapshot = await self.build_context_snapshot(store_id)
        if context_snapshot.get("scope") == "headquarters":
            return await self._format_headquarters_context(context_snapshot)
        return await self._format_store_context(context_snapshot)

    async def _format_store_context(self, context_snapshot: Dict) -> str:
        store_ctx = context_snapshot.get("store") or {}
        snapshot = context_snapshot.get("snapshot") or {}
        parts = []
        sku_map = {}

        if store_ctx:
            parts.append(f"""门店信息：
- 门店ID：{store_ctx.get('store_id', '')}
- 门店名称：{store_ctx.get('store_name', '')}
- 门店位置：{store_ctx.get('store_location', '')}
- 门店面积：{store_ctx.get('store_area', 0)}平方米
- 营业状态：{store_ctx.get('store_status', '')}""")

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
                "- sku_amount 表示该 SKU 当日售出数量，不是金额。",
                "",
                f"最近一天销售汇总（数据日期：{latest.get('sales_date', '')}）：",
                f"- 订单总数：{latest.get('total_orders', 0)}单",
                f"- 门店总收入：{self._format_money(latest.get('total_income', 0))}元",
                "- 最近一天 SKU 销售明细：",
            ]

            for detail in latest.get("details", []):
                sku_id = self._format_int(detail.get("sku_id"))
                sku_amount = self._format_int(detail.get("sku_amount"))
                sku_name = sku_map.get(sku_id, {}).get("sku_name", f"SKU {sku_id}")
                sales_lines.append(f"  - sku_id={sku_id}，商品={sku_name}，售出数量={sku_amount}")

            sales_lines.append("")
            sales_lines.append("最近销售数量历史（每个商品后的数字都是售出数量，不是收入）：")
            for day in daily_sales[-14:]:
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
                "- actual_quantity/stock 表示当前库存数量，不是销量。",
                "- 回答补货建议时需要同时参考近期 sku_amount 和当前库存。",
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

    async def _format_headquarters_context(self, context_snapshot: Dict) -> str:
        hq_ctx = context_snapshot.get("store") or {}
        stores = context_snapshot.get("stores") or []
        snapshots = context_snapshot.get("snapshots") or []
        summary = context_snapshot.get("summary") or {}
        sku_dict = await go_client.get_sku_dictionary()
        sku_map = {self._format_int(s.get("sku_id")): s for s in sku_dict}

        def sku_name(sku_id: int) -> str:
            return sku_map.get(sku_id, {}).get("sku_name", f"SKU {sku_id}")

        parts = [
            "总部全局上下文说明：",
            "- 当前请求 store_id=0，表示总部视角，不是具体营业门店。",
            "- 当前数据已聚合所有启用真实门店，且不包含 store_id=0 总部虚拟门店。",
            "- 回答营业额、订单数、SKU 销量、库存时，优先使用全局汇总，并可按门店拆分。",
            "- 用户问具体门店时，必须优先使用下方“各门店完整明细”，不要只回答全门店汇总。",
            "- 用户问具体商品时，先按商品名称或 sku_id 匹配 SKU，再按门店、日期读取 sku_amount。",
            "- 如果具体门店、具体日期或具体 SKU 在明细中不存在，才说明当前快照未提供。",
            "- 如果用户说“昨日/最近一天”，以销售快照中的 sales_date 为准，并在回答中写明数据日期。",
        ]

        if hq_ctx:
            parts.append(f"""总部信息：
- 门店ID：{hq_ctx.get('store_id', '')}
- 名称：{hq_ctx.get('store_name', '')}
- 状态：{hq_ctx.get('store_status', '')}""")

        store_lines = ["纳入总部聚合的启用门店："]
        for store in stores:
            store_lines.append(
                f"- store_id={store.get('store_id')}，{store.get('store_name')}，"
                f"编码={store.get('store_code')}，状态={store.get('store_status')}"
            )
        parts.append("\n".join(store_lines))

        latest_date = summary.get("latest_sales_date") or ""
        summary_lines = [
            "总部销售汇总：",
            f"- 纳入门店数：{summary.get('store_count', 0)}",
            f"- 最近共同销售数据日期：{latest_date}",
            f"- 最近一天全部门店营业额：{self._format_money(summary.get('latest_total_income', 0))}元",
            f"- 最近一天全部门店订单数：{summary.get('latest_total_orders', 0)}单",
            f"- 当前快照周期内全部门店累计营业额：{self._format_money(summary.get('period_total_income', 0))}元",
            f"- 当前快照周期内全部门店累计订单数：{summary.get('period_total_orders', 0)}单",
        ]
        parts.append("\n".join(summary_lines))

        rank_lines = ["最近一天按门店营业额排名："]
        for row in summary.get("store_sales_rank", []):
            rank_lines.append(
                f"- store_id={row.get('store_id')}，{row.get('store_name')}，"
                f"日期={row.get('sales_date')}，营业额={self._format_money(row.get('total_income', 0))}元，"
                f"订单数={row.get('total_orders', 0)}单"
            )
        parts.append("\n".join(rank_lines))

        period_rank_lines = ["当前快照周期按门店累计营业额排名："]
        for row in summary.get("period_store_sales_rank", []):
            period_rank_lines.append(
                f"- store_id={row.get('store_id')}，{row.get('store_name')}，"
                f"累计营业额={self._format_money(row.get('total_income', 0))}元，"
                f"累计订单数={row.get('total_orders', 0)}单"
            )
        parts.append("\n".join(period_rank_lines))

        daily_lines = ["最近全门店每日汇总："]
        for day in summary.get("daily_totals", []):
            daily_lines.append(
                f"- {day.get('sales_date')}：营业额={self._format_money(day.get('total_income', 0))}元，"
                f"订单数={day.get('total_orders', 0)}单"
            )
        parts.append("\n".join(daily_lines))

        sku_lines = ["当前快照周期全门店 SKU 销量汇总（sku_amount 是售出数量，不是金额）："]
        for item in summary.get("sku_sales_totals", []):
            sku_id = self._format_int(item.get("sku_id"))
            sku_lines.append(f"- sku_id={sku_id}，商品={sku_name(sku_id)}，售出数量={item.get('sku_amount', 0)}")
        parts.append("\n".join(sku_lines))

        inventory_lines = ["当前全门店库存汇总："]
        for item in summary.get("inventory_totals", []):
            sku_id = self._format_int(item.get("sku_id"))
            inventory_lines.append(f"- sku_id={sku_id}，商品={sku_name(sku_id)}，当前库存合计={item.get('actual_quantity', 0)}")
        parts.append("\n".join(inventory_lines))

        per_store_lines = [
            "各门店完整明细（总部视角可用；sku_amount 是该门店该日期该 SKU 售出数量，不是金额）："
        ]
        for item in snapshots:
            store = item.get("store") or {}
            snapshot = item.get("snapshot") or {}
            daily_sales = snapshot.get("daily_sales_list", [])
            inventory = snapshot.get("current_inventory", [])
            per_store_lines.append(
                f"\n门店 store_id={store.get('store_id')}，名称={store.get('store_name')}，"
                f"编码={store.get('store_code')}，状态={store.get('store_status')}："
            )
            if inventory:
                per_store_lines.append("  当前库存明细：")
                for inv in inventory:
                    sku_id = self._format_int(inv.get("sku_id"))
                    per_store_lines.append(
                        f"  - sku_id={sku_id}，商品={sku_name(sku_id)}，"
                        f"actual_quantity={self._format_int(inv.get('actual_quantity'))}"
                    )
            else:
                per_store_lines.append("  当前库存明细：当前快照未提供")

            if daily_sales:
                per_store_lines.append("  每日销售明细：")
                for day in daily_sales:
                    per_store_lines.append(
                        f"  - 日期={day.get('sales_date', '')}，"
                        f"total_income={self._format_money(day.get('total_income', 0))}元，"
                        f"total_orders={day.get('total_orders', 0)}单"
                    )
                    details = day.get("details", [])
                    if details:
                        for detail in details:
                            sku_id = self._format_int(detail.get("sku_id"))
                            per_store_lines.append(
                                f"    * sku_id={sku_id}，商品={sku_name(sku_id)}，"
                                f"sku_amount={self._format_int(detail.get('sku_amount'))}"
                            )
                    else:
                        per_store_lines.append("    * SKU 明细：当前快照未提供")
            else:
                per_store_lines.append("  每日销售明细：当前快照未提供")
        parts.append("\n".join(per_store_lines))

        return "\n\n".join(parts)

    async def _build_prompt(
        self,
        db: AsyncSession,
        store_id: int,
        query: str,
        history: List[Dict] = None,
        context_snapshot: Optional[Dict] = None,
    ) -> List[Dict]:
        business_context = await self._build_business_context(store_id, context_snapshot)
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

    async def chat_completion(
        self,
        db: AsyncSession,
        store_id: int,
        query: str,
        history: List[Dict] = None,
        context_snapshot: Optional[Dict] = None,
    ) -> str:
        messages = await self._build_prompt(db, store_id, query, history, context_snapshot)

        try:
            if self.client is None:
                raise RuntimeError("LLM client is not configured")

            response = await self.client.chat.completions.create(
                model="deepseek-v4-pro",
                messages=messages,
                stream=False,
                reasoning_effort="high",
                extra_body={"thinking": {"type": "enabled"}},
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.warning("LLM chat completion failed: %s", e)
            return (
                "由于 LLM API 调用异常，暂时无法生成完整智能分析。\n\n"
                f"用户问题：{query}\n\n"
                "请稍后重试，或查看系统注入的门店经营数据进行人工核对。"
            )

    async def chat_completion_stream(
        self,
        db: AsyncSession,
        store_id: int,
        query: str,
        history: List[Dict] = None,
        context_snapshot: Optional[Dict] = None,
    ) -> AsyncGenerator[str, None]:
        messages = await self._build_prompt(db, store_id, query, history, context_snapshot)

        try:
            if self.client is None:
                raise RuntimeError("LLM client is not configured")

            stream = await self.client.chat.completions.create(
                model="deepseek-v4-pro",
                messages=messages,
                stream=True,
                reasoning_effort="high",
                extra_body={"thinking": {"type": "enabled"}},
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

    async def get_final_prompt(
        self,
        db: AsyncSession,
        store_id: int,
        query: str,
        history: List[Dict] = None,
        context_snapshot: Optional[Dict] = None,
    ) -> str:
        messages = await self._build_prompt(db, store_id, query, history, context_snapshot)
        return str(messages)
