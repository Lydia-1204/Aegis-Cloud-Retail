import logging
from typing import AsyncGenerator, Dict, List, Optional

from openai import AsyncOpenAI
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ai_assistant.config import deepseek_api_key, deepseek_base_url
from ai_assistant.db_models import AICustomer, AIExpertKnowledge
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

    @staticmethod
    def _format_datetime(value) -> str:
        if not value:
            return ""
        try:
            return value.isoformat().replace("+00:00", "Z")
        except AttributeError:
            return str(value)

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

    async def build_context_snapshot(self, store_id: int, db: Optional[AsyncSession] = None) -> Dict:
        if store_id == 0:
            return await self._build_headquarters_context_snapshot(db)

        store_ctx = await go_client.get_store_context(store_id)
        snapshot = await go_client.get_business_snapshot(store_id)
        traffic = await self._get_store_traffic_summary(db, store_id)
        return {
            "scope": "store",
            "store": store_ctx,
            "snapshot": snapshot,
            "traffic": traffic,
        }

    async def _build_headquarters_context_snapshot(self, db: Optional[AsyncSession] = None) -> Dict:
        hq_ctx = await go_client.get_store_context(0)
        stores = await go_client.list_stores("active")
        snapshots = []
        traffic_summary = await self._get_headquarters_traffic_summary(db, stores)
        traffic_by_store = {
            self._format_int(item.get("store_id")): item
            for item in traffic_summary.get("stores", [])
        }
        for store in stores:
            real_store_id = self._format_int(store.get("store_id"))
            if real_store_id <= 0:
                continue
            snapshot = await go_client.get_business_snapshot(real_store_id)
            snapshots.append({
                "store": store,
                "snapshot": snapshot,
                "traffic": traffic_by_store.get(real_store_id, self._empty_traffic_summary(real_store_id)),
            })

        return {
            "scope": "headquarters",
            "store": hq_ctx,
            "stores": stores,
            "snapshots": snapshots,
            "summary": self._summarize_headquarters_snapshots(snapshots),
            "traffic_summary": traffic_summary,
        }

    def _empty_traffic_summary(self, store_id: int) -> Dict:
        return {
            "store_id": store_id,
            "has_data": False,
            "batch_count": 0,
            "total_enter": 0,
            "total_leave": 0,
            "net_flow": 0,
            "first_start_time": "",
            "last_end_time": "",
            "recent_batches": [],
        }

    async def _get_store_traffic_summary(
        self,
        db: Optional[AsyncSession],
        store_id: int,
    ) -> Dict:
        traffic = self._empty_traffic_summary(store_id)
        if db is None or store_id <= 0:
            return traffic

        try:
            summary_stmt = (
                select(
                    func.count(AICustomer.ai_customer_id),
                    func.coalesce(func.sum(AICustomer.customer_enter_total), 0),
                    func.coalesce(func.sum(AICustomer.customer_leave_total), 0),
                    func.min(AICustomer.customer_start_time),
                    func.max(AICustomer.customer_end_time),
                )
                .where(AICustomer.store_id == store_id)
            )
            result = await db.execute(summary_stmt)
            count, total_enter, total_leave, first_start, last_end = result.one()
            count = self._format_int(count)
            total_enter = self._format_int(total_enter)
            total_leave = self._format_int(total_leave)

            if count <= 0:
                return traffic

            batch_stmt = (
                select(AICustomer)
                .where(AICustomer.store_id == store_id)
                .order_by(AICustomer.customer_start_time)
            )
            batch_result = await db.execute(batch_stmt)
            recent_batches = []
            for item in batch_result.scalars().all():
                recent_batches.append({
                    "customer_start_time": self._format_datetime(item.customer_start_time),
                    "customer_end_time": self._format_datetime(item.customer_end_time),
                    "customer_enter_total": self._format_int(item.customer_enter_total),
                    "customer_leave_total": self._format_int(item.customer_leave_total),
                })

            traffic.update({
                "has_data": True,
                "batch_count": count,
                "total_enter": total_enter,
                "total_leave": total_leave,
                "net_flow": total_enter - total_leave,
                "first_start_time": self._format_datetime(first_start),
                "last_end_time": self._format_datetime(last_end),
                "recent_batches": recent_batches,
            })
            return traffic
        except Exception:
            logger.exception("Failed to load traffic summary for store_id=%s", store_id)
            return traffic

    async def _get_headquarters_traffic_summary(
        self,
        db: Optional[AsyncSession],
        stores: List[Dict],
    ) -> Dict:
        store_ids = [
            self._format_int(store.get("store_id"))
            for store in stores
            if self._format_int(store.get("store_id")) > 0
        ]
        empty_summary = {
            "has_data": False,
            "store_count": len(store_ids),
            "total_enter": 0,
            "total_leave": 0,
            "net_flow": 0,
            "first_start_time": "",
            "last_end_time": "",
            "stores": [self._empty_traffic_summary(store_id) for store_id in store_ids],
        }
        if db is None or not store_ids:
            return empty_summary

        try:
            stmt = (
                select(
                    AICustomer.store_id,
                    func.count(AICustomer.ai_customer_id),
                    func.coalesce(func.sum(AICustomer.customer_enter_total), 0),
                    func.coalesce(func.sum(AICustomer.customer_leave_total), 0),
                    func.min(AICustomer.customer_start_time),
                    func.max(AICustomer.customer_end_time),
                )
                .where(AICustomer.store_id.in_(store_ids))
                .group_by(AICustomer.store_id)
            )
            result = await db.execute(stmt)
            rows = result.all()
            rows_by_store = {self._format_int(row[0]): row for row in rows}

            batch_stmt = (
                select(AICustomer)
                .where(AICustomer.store_id.in_(store_ids))
                .order_by(AICustomer.store_id, AICustomer.customer_start_time)
            )
            batch_result = await db.execute(batch_stmt)
            batches_by_store: Dict[int, List[Dict]] = {}
            for item in batch_result.scalars().all():
                batches_by_store.setdefault(self._format_int(item.store_id), []).append({
                    "customer_start_time": self._format_datetime(item.customer_start_time),
                    "customer_end_time": self._format_datetime(item.customer_end_time),
                    "customer_enter_total": self._format_int(item.customer_enter_total),
                    "customer_leave_total": self._format_int(item.customer_leave_total),
                })

            store_summaries = []
            total_enter = 0
            total_leave = 0
            first_start = None
            last_end = None
            for store_id in store_ids:
                row = rows_by_store.get(store_id)
                if row is None:
                    store_summaries.append(self._empty_traffic_summary(store_id))
                    continue

                _, count, enter_sum, leave_sum, store_first_start, store_last_end = row
                enter_sum = self._format_int(enter_sum)
                leave_sum = self._format_int(leave_sum)
                total_enter += enter_sum
                total_leave += leave_sum
                if store_first_start and (first_start is None or store_first_start < first_start):
                    first_start = store_first_start
                if store_last_end and (last_end is None or store_last_end > last_end):
                    last_end = store_last_end

                store_summaries.append({
                    "store_id": store_id,
                    "has_data": True,
                    "batch_count": self._format_int(count),
                    "total_enter": enter_sum,
                    "total_leave": leave_sum,
                    "net_flow": enter_sum - leave_sum,
                    "first_start_time": self._format_datetime(store_first_start),
                    "last_end_time": self._format_datetime(store_last_end),
                    "recent_batches": batches_by_store.get(store_id, []),
                })

            return {
                "has_data": any(item.get("has_data") for item in store_summaries),
                "store_count": len(store_ids),
                "total_enter": total_enter,
                "total_leave": total_leave,
                "net_flow": total_enter - total_leave,
                "first_start_time": self._format_datetime(first_start),
                "last_end_time": self._format_datetime(last_end),
                "stores": sorted(
                    store_summaries,
                    key=lambda item: self._format_int(item.get("total_enter")),
                    reverse=True,
                ),
            }
        except Exception:
            logger.exception("Failed to load headquarters traffic summary")
            return empty_summary

    def _format_store_traffic_context(self, traffic: Dict) -> str:
        lines = [
            "客流数据口径说明：",
            "- 数据来源：Python 数据库 ai_customer 表，即 YOLO/边缘节点 history-batch 入库后的历史客流批次。",
            "- customer_enter_total 表示统计窗口内进店人数，customer_leave_total 表示统计窗口内离店人数。",
            "- 客流数据用于经营分析，不等同于实时画面 current_people_count。",
        ]

        if not traffic.get("has_data"):
            lines.append("- 暂无客流历史数据。")
            return "\n".join(lines)

        lines.extend([
            "",
            "当前门店客流汇总：",
            f"- 数据时间范围：{traffic.get('first_start_time', '')} 至 {traffic.get('last_end_time', '')}",
            f"- 客流批次数：{traffic.get('batch_count', 0)}",
            f"- 累计进店人数：{traffic.get('total_enter', 0)}人",
            f"- 累计离店人数：{traffic.get('total_leave', 0)}人",
            f"- 净流入人数：{traffic.get('net_flow', 0)}人",
        ])

        recent_batches = traffic.get("recent_batches") or []
        if recent_batches:
            lines.append("- 全部客流批次：")
            for batch in recent_batches:
                lines.append(
                    f"  - {batch.get('customer_start_time', '')} 至 {batch.get('customer_end_time', '')}："
                    f"进店 {batch.get('customer_enter_total', 0)} 人，"
                    f"离店 {batch.get('customer_leave_total', 0)} 人"
                )

        return "\n".join(lines)

    def _format_headquarters_traffic_context(self, context_snapshot: Dict) -> str:
        traffic_summary = context_snapshot.get("traffic_summary") or {}
        stores = context_snapshot.get("stores") or []
        store_name_map = {
            self._format_int(store.get("store_id")): store.get("store_name") or f"门店{store.get('store_id')}"
            for store in stores
        }
        lines = [
            "总部客流数据口径说明：",
            "- 数据来源：Python 数据库 ai_customer 表，即 YOLO/边缘节点 history-batch 入库后的历史客流批次。",
            "- 当前为总部视角，客流数据按全部启用门店聚合，并可按门店拆分。",
        ]

        if not traffic_summary.get("has_data"):
            lines.append("- 全部启用门店暂无客流历史数据。")
            return "\n".join(lines)

        lines.extend([
            "",
            "全部门店客流汇总：",
            f"- 纳入门店数：{traffic_summary.get('store_count', 0)}",
            f"- 数据时间范围：{traffic_summary.get('first_start_time', '')} 至 {traffic_summary.get('last_end_time', '')}",
            f"- 累计进店人数：{traffic_summary.get('total_enter', 0)}人",
            f"- 累计离店人数：{traffic_summary.get('total_leave', 0)}人",
            f"- 净流入人数：{traffic_summary.get('net_flow', 0)}人",
            "- 按进店人数排序的门店客流概览：",
        ])

        for item in traffic_summary.get("stores", []):
            store_id = self._format_int(item.get("store_id"))
            store_name = store_name_map.get(store_id, f"门店{store_id}")
            if not item.get("has_data"):
                lines.append(f"  - store_id={store_id}，{store_name}：暂无客流历史数据")
                continue
            lines.append(
                f"  - store_id={store_id}，{store_name}："
                f"进店 {item.get('total_enter', 0)} 人，"
                f"离店 {item.get('total_leave', 0)} 人，"
                f"净流入 {item.get('net_flow', 0)} 人，"
                f"批次 {item.get('batch_count', 0)}，"
                f"时间范围 {item.get('first_start_time', '')} 至 {item.get('last_end_time', '')}"
            )

        return "\n".join(lines)

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
        db: AsyncSession,
        store_id: int,
        context_snapshot: Optional[Dict] = None,
    ) -> str:
        if context_snapshot is None:
            context_snapshot = await self.build_context_snapshot(store_id, db)
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

        store_id = self._format_int(store_ctx.get("store_id"))
        traffic = context_snapshot.get("traffic") or self._empty_traffic_summary(store_id)
        parts.append(self._format_store_traffic_context(traffic))

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
        parts.append(self._format_headquarters_traffic_context(context_snapshot))

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
            traffic = item.get("traffic") or self._empty_traffic_summary(
                self._format_int(store.get("store_id"))
            )
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

            if traffic.get("has_data"):
                per_store_lines.append(
                    "  客流汇总："
                    f"进店={traffic.get('total_enter', 0)}人，"
                    f"离店={traffic.get('total_leave', 0)}人，"
                    f"净流入={traffic.get('net_flow', 0)}人，"
                    f"批次={traffic.get('batch_count', 0)}，"
                    f"时间范围={traffic.get('first_start_time', '')} 至 {traffic.get('last_end_time', '')}"
                )
                traffic_batches = traffic.get("recent_batches") or []
                if traffic_batches:
                    per_store_lines.append("  全部客流批次：")
                    for batch in traffic_batches:
                        per_store_lines.append(
                            f"  - {batch.get('customer_start_time', '')} 至 {batch.get('customer_end_time', '')}："
                            f"进店 {batch.get('customer_enter_total', 0)} 人，"
                            f"离店 {batch.get('customer_leave_total', 0)} 人"
                        )
            else:
                per_store_lines.append("  客流汇总：暂无客流历史数据")

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
        business_context = await self._build_business_context(db, store_id, context_snapshot)
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
