FROM python:3.12-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt
    
# Pre-download ML models so first query isn't slow
RUN python -c "\
from fastembed import TextEmbedding; \
from fastembed.rerank.cross_encoder import TextCrossEncoder; \
TextEmbedding(model_name='BAAI/bge-small-en-v1.5'); \
TextCrossEncoder(model_name='Xenova/ms-marco-MiniLM-L-6-v2')"

# Copy app code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
