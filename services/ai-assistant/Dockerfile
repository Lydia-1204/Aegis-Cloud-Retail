FROM python:3.10-slim AS builder
ENV DEBIAN_FRONTEND=noninteractive
ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ENV PIP_DEFAULT_TIMEOUT=120

RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g; s/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gfortran \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY services/ai-assistant/pyproject.toml ./
COPY services/ai-assistant/src/ ./src/
RUN pip install --no-cache-dir --prefix=/install .

FROM python:3.10-slim
ENV DEBIAN_FRONTEND=noninteractive

RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g; s/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y --no-install-recommends \
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
