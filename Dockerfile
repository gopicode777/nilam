# ---- 1. build the React app ----
FROM node:22-alpine AS web
WORKDIR /client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- 2. Python API + built web app ----
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 ENV=production DATA_DIR=/data
RUN apt-get update && apt-get install -y --no-install-recommends \
      tesseract-ocr tesseract-ocr-eng tesseract-ocr-tam poppler-utils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=web /client/dist client/dist
RUN useradd -r app && mkdir /data && chown app /data
USER app
WORKDIR /srv/backend
VOLUME /data
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
