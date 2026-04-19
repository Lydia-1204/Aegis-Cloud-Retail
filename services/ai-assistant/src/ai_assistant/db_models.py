from datetime import datetime
from sqlalchemy import BigInteger, Integer, String, Text, JSON, DateTime, SmallInteger, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AiChatLogs(Base):
    __tablename__ = "ai_chat_logs"

    chat_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(Integer, nullable=False)
    chat_session_id: Mapped[str] = mapped_column(String(128), nullable=False)
    chat_query: Mapped[str] = mapped_column(Text, nullable=False)
    context_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    chat_final_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    chat_tokens_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    chat_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_ai_chat_logs_store_id", "store_id"),
        Index("ix_ai_chat_logs_session_id", "chat_session_id"),
        Index("ix_ai_chat_logs_time", "chat_time"),
    )


class AiAnalysis(Base):
    __tablename__ = "ai_analysis"

    ai_analysis_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(Integer, nullable=False)
    sku_id: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    analysis_label: Mapped[str] = mapped_column(String(64), nullable=False)
    strategy_key: Mapped[str] = mapped_column(String(64), nullable=False)
    analysis_data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    analysis_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_ai_analysis_store_id", "store_id"),
        Index("ix_ai_analysis_sku_id", "sku_id"),
        Index("ix_ai_analysis_strategy_key", "strategy_key"),
        Index("ix_ai_analysis_time", "analysis_time"),
    )


class AiExpertKnowledge(Base):
    __tablename__ = "ai_expert_knowledge"

    knowledge_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    strategy_key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    scenario_name: Mapped[str] = mapped_column(Text, nullable=False)
    expert_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    knowledge_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    knowledge_updated_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )

    __table_args__ = (
        Index("ix_ai_expert_knowledge_active", "is_active"),
    )
