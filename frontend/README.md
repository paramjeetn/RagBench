# RagBench Frontend

Next.js 16 web application and evaluation dashboard for **RagBench**, an open-source platform for evaluating, comparing, and optimizing RAG (Retrieval-Augmented Generation) pipelines.

The frontend provides the main interface for managing projects, testing RAG pipelines, running evaluations, and comparing results.

## 🚀 Quick Start with Docker Compose

The recommended way to run RagBench is with the prebuilt Docker images and Docker Compose.

### 1. Download the Compose file

```bash
curl -O https://raw.githubusercontent.com/paramjeetn/RagBench/main/docker-compose.hub.yml
```

### 2. Start the stack

```bash
docker compose -f docker-compose.hub.yml up -d
```

This starts the complete RagBench stack, including the frontend, FastAPI backend, PostgreSQL, and Qdrant.

### 3. Open the dashboard

```text
http://localhost:3000
```

The frontend is configured to communicate with the backend at:

```text
http://localhost:8000
```

## 🎨 What You Can Do

### Projects

Organize evaluation datasets, pipeline configurations, and evaluation runs into separate projects.

### Document Studio

Upload PDF, Markdown, and TXT documents and inspect the ingestion process, including chunking and vector indexing.

### Interactive Chat

Test your RAG pipeline interactively with live retrieval and generation, including source citations for retrieved context.

### Evaluation Runner

Run RAG evaluation suites and inspect metric scores for individual questions and complete evaluation runs.

### Side-by-Side Comparison

Compare two evaluation runs with visual metric comparisons and radar charts to see whether a pipeline change improved results.

### Pipeline Settings

Configure the main RAG pipeline components directly from the UI, including:

- Chunking strategy
- Embedding model
- Retrieval mode
- Reranker
- LLM provider and model
- API keys

API keys configured in the dashboard are stored in the browser's local storage and are not committed to the repository.

## 🏗️ Frontend Architecture

```text
Next.js 16
    │
    ├── Dashboard
    ├── Projects
    ├── Documents
    ├── Interactive Chat
    ├── Evaluation Runner
    ├── Run Comparison
    └── Pipeline Settings
            │
            ▼
       FastAPI Backend
            │
            ├── PostgreSQL
            └── Qdrant
```

## ⚙️ Configuration

The Docker Compose deployment sets the frontend API endpoint automatically:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For local development, configure the same variable in your environment if the backend is running on a different address.

## 💻 Local Development

For frontend-only development:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

The frontend requires a running RagBench backend for API-backed functionality.

## 🔗 Links

- **GitHub Repository:** https://github.com/paramjeetn/RagBench
- **Website & Documentation:** https://ragbench-web.vercel.app
- **Backend API:** http://localhost:8000
- **Swagger Docs:** http://localhost:8000/docs

## 📄 License

MIT © [Paramjeet](https://github.com/paramjeetn)
