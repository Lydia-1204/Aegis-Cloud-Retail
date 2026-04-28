import uuid
import json
from datetime import datetime
from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from ai_assistant.database import get_db
from ai_assistant.db_models import AIChatLogs
from ai_assistant.llm_service import LLMService


def parse_json_or_none(data: str) -> dict:
    if not data:
        return None
    try:
        if isinstance(data, str):
            return json.loads(data)
        return data
    except json.JSONDecodeError:
        return None


def calculate_tokens(text: str) -> int:
    if not text:
        return 0
    return int(len(text) * 0.8)

router = APIRouter()


class ChatCompletionReq(BaseModel):
    store_id: int = Field(..., gt=0)
    session_id: Optional[str] = None
    query: str = Field(..., min_length=1)


class ChatCompletionRes(BaseModel):
    session_id: str
    content: str
    is_finish: bool


class ChatSessionItem(BaseModel):
    session_id: str
    title: str
    session_time: str


class ChatMessage(BaseModel):
    role: str
    content: str
    chat_time: str


class ChatHistoryRes(BaseModel):
    session_id: str
    store_id: int
    messages: List[ChatMessage]


class PagedData(BaseModel):
    page: int
    limit: int
    total: int
    data: List[ChatSessionItem]


class ApiResponse(BaseModel):
    code: int
    message: str
    data: Optional[dict] = None


class SaveChatLogReq(BaseModel):
    store_id: int = Field(..., gt=0, description="门店ID")
    session_id: str = Field(..., min_length=1, description="对话会话ID")
    query: str = Field(..., min_length=1, description="用户原始提问")
    context_snapshot: Optional[str] = Field(None, description="注入的经营数据/诊断结果快照")
    final_prompt: Optional[str] = Field(None, description="最终提示词")
    response: str = Field(..., min_length=1, description="AI生成的最终业务建议")


class SaveChatLogRes(BaseModel):
    chat_id: int
    session_id: str
    tokens_used: int


llm_service = LLMService()


async def _get_session_history(db: AsyncSession, session_id: str) -> List[Dict]:
    query = select(AIChatLogs).filter(
        AIChatLogs.chat_session_id == session_id
    ).order_by(AIChatLogs.chat_time)

    result = await db.execute(query)
    logs = result.scalars().all()

    history = []
    for log in logs:
        if log.chat_query:
            history.append({"role": "user", "content": log.chat_query})
        if log.ai_response:
            history.append({"role": "assistant", "content": log.ai_response})

    return history


async def _save_chat_log_async(store_id: int, session_id: str,
                               query: str, context_snapshot: str,
                               final_prompt: str, response: str):
    """异步保存对话日志（用于后台任务）"""
    from ai_assistant.database import create_session
    db = await create_session()
    try:
        input_tokens = calculate_tokens(final_prompt)
        output_tokens = calculate_tokens(response)
        total_tokens = input_tokens + output_tokens

        context_json = parse_json_or_none(context_snapshot)

        new_log = AIChatLogs(
            store_id=store_id,
            chat_session_id=session_id,
            chat_query=query,
            context_snapshot=context_json,
            chat_final_prompt=final_prompt,
            ai_response=response,
            chat_tokens_used=total_tokens
        )

        db.add(new_log)
        await db.commit()
    finally:
        await db.close()


@router.post("/api/ai/chat/completions")
async def chat_completions(
    req: ChatCompletionReq,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    session_id = req.session_id if req.session_id else f"sess_{uuid.uuid4().hex[:8]}"

    history = []
    if req.session_id:
        history = await _get_session_history(db, req.session_id)

    from ai_assistant.mock_data import MockBusinessData
    context_snapshot = MockBusinessData.get_business_context(req.store_id)

    final_prompt = await llm_service.get_final_prompt(db, req.store_id, req.query, history)

    full_response = ""
    
    async for chunk in llm_service.chat_completion_stream(db, req.store_id, req.query, history):
        full_response += chunk

    background_tasks.add_task(
        _save_chat_log_async,
        req.store_id,
        session_id,
        req.query,
        context_snapshot,
        final_prompt,
        full_response
    )

    async def generate_response():
        for chunk in [full_response]:
            response_item = ChatCompletionRes(
                session_id=session_id,
                content=chunk,
                is_finish=False
            )
            yield f"data: {response_item.json()}\n\n"

        end_response = ChatCompletionRes(
            session_id=session_id,
            content="",
            is_finish=True
        )
        yield f"data: {end_response.json()}\n\n"

    return StreamingResponse(
        generate_response(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )


@router.get("/api/ai/chat/sessions")
async def get_chat_sessions(
    store_id: int,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    query = select(AIChatLogs).filter(
        AIChatLogs.store_id == store_id
    ).order_by(desc(AIChatLogs.chat_time)).limit(limit)

    result = await db.execute(query)
    logs = result.scalars().all()

    sessions = {}
    for log in logs:
        if log.chat_session_id not in sessions:
            sessions[log.chat_session_id] = {
                "session_id": log.chat_session_id,
                "title": log.chat_query[:30] + "..." if len(log.chat_query) > 30 else log.chat_query,
                "session_time": log.chat_time.isoformat() if log.chat_time else ""
            }

    session_list = list(sessions.values())

    return ApiResponse(
        code=0,
        message="success",
        data={
            "page": 1,
            "limit": limit,
            "total": len(session_list),
            "data": session_list
        }
    )


@router.get("/api/ai/chat/history")
async def get_chat_history(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    query = select(AIChatLogs).filter(
        AIChatLogs.chat_session_id == session_id
    ).order_by(AIChatLogs.chat_time)

    result = await db.execute(query)
    logs = result.scalars().all()

    if not logs:
        raise HTTPException(status_code=404, detail="会话不存在")

    store_id = logs[0].store_id

    messages = []
    for log in logs:
        if log.chat_query:
            messages.append(ChatMessage(
                role="user",
                content=log.chat_query,
                chat_time=log.chat_time.isoformat() if log.chat_time else ""
            ))
        if log.ai_response:
            messages.append(ChatMessage(
                role="assistant",
                content=log.ai_response,
                chat_time=log.chat_time.isoformat() if log.chat_time else ""
            ))

    return ApiResponse(
        code=0,
        message="success",
        data={
            "session_id": session_id,
            "store_id": store_id,
            "messages": messages
        }
    )


@router.post("/api/ai/chat/logs", response_model=ApiResponse)
async def save_chat_log(
    req: SaveChatLogReq,
    db: AsyncSession = Depends(get_db)
):
    input_tokens = calculate_tokens(req.final_prompt or "")
    output_tokens = calculate_tokens(req.response)
    total_tokens = input_tokens + output_tokens

    context_json = parse_json_or_none(req.context_snapshot)

    new_log = AIChatLogs(
        store_id=req.store_id,
        chat_session_id=req.session_id,
        chat_query=req.query,
        context_snapshot=context_json,
        chat_final_prompt=req.final_prompt,
        ai_response=req.response,
        chat_tokens_used=total_tokens
    )

    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)

    return ApiResponse(
        code=0,
        message="保存成功",
        data={
            "chat_id": new_log.chat_id,
            "session_id": new_log.chat_session_id,
            "tokens_used": new_log.chat_tokens_used
        }
    )


@router.get("/api/ai/chat/logs/{chat_id}", response_model=ApiResponse)
async def get_chat_log(
    chat_id: int,
    db: AsyncSession = Depends(get_db)
):
    query = select(AIChatLogs).filter(AIChatLogs.chat_id == chat_id)
    result = await db.execute(query)
    chat_log = result.scalar_one_or_none()

    if not chat_log:
        raise HTTPException(status_code=404, detail="对话日志不存在")

    return ApiResponse(
        code=0,
        message="success",
        data=chat_log.to_dict()
    )


@router.delete("/api/ai/chat/logs/{chat_id}", response_model=ApiResponse)
async def delete_chat_log(
    chat_id: int,
    db: AsyncSession = Depends(get_db)
):
    query = select(AIChatLogs).filter(AIChatLogs.chat_id == chat_id)
    result = await db.execute(query)
    chat_log = result.scalar_one_or_none()

    if not chat_log:
        raise HTTPException(status_code=404, detail="对话日志不存在")

    await db.delete(chat_log)
    await db.commit()

    return ApiResponse(
        code=0,
        message="删除成功",
        data={"chat_id": chat_id}
    )