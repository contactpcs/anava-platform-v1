FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
        libreoffice \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY app/ ./app/
COPY scripts/ ./scripts/
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV QT_QPA_PLATFORM=offscreen
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -f http://localhost:8000/health || exit 1
# Socket.IO is served by asgi_app. Run a single worker unless REDIS_URL is set
# (the Redis client manager is required to fan out events across >1 worker).
CMD ["uvicorn", "app.main:asgi_app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
