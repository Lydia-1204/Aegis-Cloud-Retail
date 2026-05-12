FROM python:3.10-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/src

COPY services/traffic-sense/pyproject.toml ./
RUN pip install --no-cache-dir .

COPY services/traffic-sense/src/ ./src/
COPY services/traffic-sense/proto/ ./proto/

EXPOSE 8083 50051

CMD ["uvicorn", "traffic_sense.main:app", "--host", "0.0.0.0", "--port", "8083"]
