FROM python:3.10-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/src

COPY services/traffic-sense/pyproject.toml ./
COPY services/traffic-sense/README.md ./
COPY services/traffic-sense/src/ ./src/
RUN pip install --no-cache-dir .

COPY services/traffic-sense/proto/ ./proto/

EXPOSE 8083 50051

CMD ["sh", "-c", "uvicorn traffic_sense.main:app --host 0.0.0.0 --port ${TRAFFIC_SENSE_PORT:-8083}"]
