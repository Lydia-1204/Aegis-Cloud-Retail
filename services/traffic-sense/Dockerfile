FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY services/traffic-sense/ ./
RUN pip install --no-cache-dir -e .
EXPOSE 8083
CMD ["uvicorn", "traffic_sense.main:app", "--host", "0.0.0.0", "--port", "8083"]
