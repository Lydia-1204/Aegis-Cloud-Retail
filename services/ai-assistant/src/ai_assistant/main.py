import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI

from ai_assistant.config import database_url
from ai_assistant.database import init_db, close_db
from ai_assistant.api import chat_router
from ai_assistant.grpc_service import serve_grpc

grpc_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global grpc_task
    db_url = database_url()
    if db_url:
        await init_db(db_url)
    grpc_task = asyncio.create_task(serve_grpc())
    yield
    if grpc_task:
        grpc_task.cancel()
        try:
            await grpc_task
        except asyncio.CancelledError:
            pass
    if db_url:
        await close_db()


app = FastAPI(title="ai-assistant", version="0.1.0", lifespan=lifespan)

app.include_router(chat_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "ai-assistant", "status": "ok"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AI_ASSISTANT_PORT", "8084"))
    uvicorn.run("ai_assistant.main:app", host="0.0.0.0", port=port, reload=True)
