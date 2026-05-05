from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from traffic_sense.db_models import Base

engine = None
async_session_maker = None


async def init_db(database_url: str):
    global engine, async_session_maker
    engine = create_async_engine(database_url, echo=False)
    async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    async with async_session_maker() as session:
        yield session


async def close_db():
    global engine
    if engine:
        await engine.dispose()
