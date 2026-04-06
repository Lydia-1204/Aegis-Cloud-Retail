import os

from fastapi import FastAPI

app = FastAPI(title="traffic-sense", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "traffic-sense", "status": "ok"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("TRAFFIC_SENSE_PORT", "8083"))
    uvicorn.run("traffic_sense.main:app", host="0.0.0.0", port=port, reload=True)
