FROM python:3.10-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gfortran \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY services/ai-assistant/pyproject.toml ./
COPY services/ai-assistant/src/ ./src/
RUN pip install --no-cache-dir --prefix=/install .

FROM python:3.10-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/src

COPY --from=builder /install /usr/local
COPY services/ai-assistant/src/ ./src/
COPY services/ai-assistant/proto/ ./proto/

EXPOSE 8084 50053

CMD ["sh", "-c", "uvicorn ai_assistant.main:app --host 0.0.0.0 --port ${AI_ASSISTANT_PORT:-8084}"]
