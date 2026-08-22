# Deploy RagBench to Railway

## Prerequisites
- [Railway account](https://railway.app) (free tier available)
- [Railway CLI](https://docs.railway.app/develop/cli): `npm install -g @railway/cli`
- At least one LLM API key (Gemini recommended — free tier)

## Option A: One-Click Deploy (Recommended)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

## Option B: Deploy via CLI

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Create new project
railway init

# 4. Add Postgres plugin in Railway dashboard
# Project → New Service → Database → PostgreSQL

# 5. Set environment variables
railway variables set GEMINI_API_KEY=your_key_here

# 6. Deploy
railway up
```

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | One of these | Google Gemini API key |
| `OPENAI_API_KEY` | One of these | OpenAI API key |
| `ANTHROPIC_API_KEY` | One of these | Anthropic Claude API key |
| `QDRANT_URL` | Yes | Qdrant endpoint (cloud.qdrant.io or Railway internal) |
| `QDRANT_API_KEY` | If using Qdrant Cloud | Qdrant Cloud API key |
| `DATABASE_URL` | Auto | Auto-injected by Railway Postgres plugin |

## Cloud Limitations vs Local

| Feature | Cloud | Local |
|---------|-------|-------|
| File upload size | 10MB max | Unlimited |
| Ollama (local LLM) | ❌ Not available | ✅ Full support |
| Data privacy | Hosted | Your machine |
| Setup time | ~5 min | ~10 min (Docker) |
| Cost | Railway free tier | Free (your hardware) |

## Qdrant Options

### Option 1: Qdrant Cloud (Recommended)
1. Sign up at [cloud.qdrant.io](https://cloud.qdrant.io)
2. Create a free cluster
3. Set `QDRANT_URL` and `QDRANT_API_KEY` in Railway

### Option 2: Self-hosted on Railway
1. In Railway: New Service → Docker Image → `qdrant/qdrant:latest`
2. Set `QDRANT_URL=http://qdrant.railway.internal:6333`
