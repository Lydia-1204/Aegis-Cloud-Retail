from sqlalchemy import Column, Integer, BigInteger, String, Text, DateTime, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class AIChatLogs(Base):
    __tablename__ = "ai_chat_logs"
    
    chat_id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, nullable=False)
    chat_session_id = Column(String(64), nullable=False)
    chat_query = Column(Text, nullable=False)
    context_snapshot = Column(JSONB)
    chat_final_prompt = Column(Text)
    ai_response = Column(Text)
    chat_tokens_used = Column(Integer)
    chat_time = Column(DateTime(timezone=True), server_default=func.now())
    
    def to_dict(self):
        return {
            "chat_id": self.chat_id,
            "store_id": self.store_id,
            "chat_session_id": self.chat_session_id,
            "chat_query": self.chat_query,
            "context_snapshot": self.context_snapshot,
            "chat_final_prompt": self.chat_final_prompt,
            "ai_response": self.ai_response,
            "chat_tokens_used": self.chat_tokens_used,
            "chat_time": self.chat_time.isoformat() if self.chat_time else None
        }


class AIExpertKnowledge(Base):
    __tablename__ = "ai_expert_knowledge"
    
    knowledge_id = Column(Integer, primary_key=True, autoincrement=True)
    strategy_key = Column(String(100), nullable=False, unique=True)
    scenario_name = Column(String(255), nullable=False)
    expert_prompt = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    knowledge_time = Column(DateTime(timezone=True), server_default=func.now())
    knowledge_updated_time = Column(DateTime(timezone=True), onupdate=func.now())
    
    def to_dict(self):
        return {
            "knowledge_id": self.knowledge_id,
            "strategy_key": self.strategy_key,
            "scenario_name": self.scenario_name,
            "expert_prompt": self.expert_prompt,
            "is_active": self.is_active,
            "knowledge_time": self.knowledge_time.isoformat() if self.knowledge_time else None,
            "knowledge_updated_time": self.knowledge_updated_time.isoformat() if self.knowledge_updated_time else None
        }


class AIAnalysis(Base):
    __tablename__ = "ai_analysis"

    ai_analysis_id = Column(BigInteger, primary_key=True, autoincrement=True)
    store_id = Column(Integer, nullable=False)
    sku_id = Column(Integer, nullable=True, default=0)
    analysis_label = Column(String(50), nullable=True)
    strategy_key = Column(String(100), nullable=True)
    analysis_data = Column(JSONB, nullable=True)
    analysis_time = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "ai_analysis_id": self.ai_analysis_id,
            "store_id": self.store_id,
            "sku_id": self.sku_id,
            "analysis_label": self.analysis_label,
            "strategy_key": self.strategy_key,
            "analysis_data": self.analysis_data,
            "analysis_time": self.analysis_time.isoformat() if self.analysis_time else None
        }


class AICustomer(Base):
    __tablename__ = "ai_customer"

    ai_customer_id = Column(BigInteger, primary_key=True, autoincrement=True)
    store_id = Column(Integer, nullable=False)
    customer_start_time = Column(DateTime(timezone=True), nullable=False)
    customer_end_time = Column(DateTime(timezone=True), nullable=False)
    customer_enter_total = Column(Integer, nullable=False, default=0)
    customer_leave_total = Column(Integer, nullable=False, default=0)
    ai_customer_stats_time = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "ai_customer_id": self.ai_customer_id,
            "store_id": self.store_id,
            "customer_start_time": self.customer_start_time.isoformat() if self.customer_start_time else None,
            "customer_end_time": self.customer_end_time.isoformat() if self.customer_end_time else None,
            "customer_enter_total": self.customer_enter_total,
            "customer_leave_total": self.customer_leave_total,
            "ai_customer_stats_time": self.ai_customer_stats_time.isoformat() if self.ai_customer_stats_time else None
        }
