FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY services/ai-assistant/ ./
RUN pip install --no-cache-dir -e .
EXPOSE 8084
CMD ["uvicorn", "ai_assistant.main:app", "--host", "0.0.0.0", "--port", "8084"]
