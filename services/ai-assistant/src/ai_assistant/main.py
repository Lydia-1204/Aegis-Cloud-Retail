import os
from contextlib import asynccontextmanager
from fastapi import FastAPI

from ai_assistant.config import database_url
from ai_assistant.database import init_db, close_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_url = database_url()
    if db_url:
        await init_db(db_url)
    yield
    if db_url:
        await close_db()


app = FastAPI(title="ai-assistant", version="0.1.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "ai-assistant", "status": "ok"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AI_ASSISTANT_PORT", "8084"))
    uvicorn.run("ai_assistant.main:app", host="0.0.0.0", port=port, reload=True)
