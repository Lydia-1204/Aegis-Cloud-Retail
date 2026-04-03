import os

from fastapi import FastAPI

app = FastAPI(title="ai-assistant", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "ai-assistant", "status": "ok"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AI_ASSISTANT_PORT", "8084"))
    uvicorn.run("ai_assistant.main:app", host="0.0.0.0", port=port, reload=True)
