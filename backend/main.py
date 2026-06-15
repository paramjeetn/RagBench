"""FastAPI application entry point for the RAG Eval System."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from database.session import engine, init_db
from api.dependencies import get_vector_store
from exceptions import RAGEvalError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    # Startup
    logger.info("Initializing database...")
    await init_db()
    logger.info("Ensuring Qdrant collection...")
    try:
        vs = get_vector_store()
        await vs.ensure_collection()
    except Exception as e:
        logger.warning("Qdrant not available: %s", e)
    logger.info("Backend ready.")
    yield
    # Shutdown
    logger.info("Shutting down...")


app = FastAPI(
    title="RAG Eval System",
    description="Backend for RAG pipeline evaluation and comparison",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------

@app.exception_handler(RAGEvalError)
async def rag_eval_error_handler(request: Request, exc: RAGEvalError):
    """Return structured JSON for all known RAG Eval errors."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Check database and Qdrant connectivity."""
    db_status = "connected"
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"

    qdrant_status = "connected"
    try:
        vs = get_vector_store()
        if not await vs.health_check():
            qdrant_status = "disconnected"
    except Exception:
        qdrant_status = "disconnected"

    return {"status": "ok", "database": db_status, "qdrant": qdrant_status}


# ---------------------------------------------------------------------------
# Include routers
# ---------------------------------------------------------------------------

from api.routes_projects import router as projects_router
from api.routes_documents import router as documents_router
from api.routes_query import router as query_router
from api.routes_datasets import router as datasets_router
from api.routes_eval import router as eval_router
from api.routes_config import router as config_router

app.include_router(projects_router)
app.include_router(documents_router)
app.include_router(query_router)
app.include_router(datasets_router)
app.include_router(eval_router)
app.include_router(config_router)
