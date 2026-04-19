from datetime import datetime
from sqlalchemy import BigInteger, Integer, String, Text, JSON, DateTime, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AiCustomer(Base):
    __tablename__ = "ai_customer"

    ai_customer_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(Integer, nullable=False)
    customer_start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    customer_end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    customer_enter_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    customer_leave_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ai_customer_stats_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )

    __table_args__ = (
        Index("ix_ai_customer_store_id", "store_id"),
        Index("ix_ai_customer_stats_time", "ai_customer_stats_time"),
    )
