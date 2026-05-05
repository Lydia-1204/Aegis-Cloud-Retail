import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select
from ai_assistant.config import database_url
from ai_assistant.db_models import AIAnalysis, AICustomer, Base


async def check_analysis_data():
    db_url = database_url()
    engine = create_async_engine(db_url, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        result = await db.execute(
            select(AIAnalysis).order_by(AIAnalysis.ai_analysis_id.desc()).limit(10)
        )
        rows = result.scalars().all()

        print(f"AIAnalysis 表中共有 {len(rows)} 条最新记录:")
        print("-" * 80)
        for r in rows:
            d = r.to_dict()
            print(f"  ID: {d['ai_analysis_id']}, store_id: {d['store_id']}, "
                  f"sku_id: {d['sku_id']}, label: {d['analysis_label']}, "
                  f"strategy_key: {d['strategy_key']}, time: {d['analysis_time']}")

    async with async_session() as db:
        result = await db.execute(select(AICustomer).limit(5))
        rows = result.scalars().all()
        print(f"\nAICustomer 表中共有 {len(rows)} 条记录:")
        for r in rows:
            d = r.to_dict()
            print(f"  ID: {d['ai_customer_id']}, store_id: {d['store_id']}, "
                  f"enter: {d['customer_enter_total']}, leave: {d['customer_leave_total']}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(check_analysis_data())
