from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
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
    strategy_key = Column(String(100), nullable=False)
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
