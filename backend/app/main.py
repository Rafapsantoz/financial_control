import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine
from app.db.init_db import init_db
from app.api.v1.router import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("rpsec_financeiro")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application Lifespan Event Handler.
    Startup: Initializes database tables and runs initial seed.
    Shutdown: Disposes the async engine pool cleanly.
    """
    logger.info("Initializing Financial Organizer database...")
    try:
        await init_db()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.critical(f"Failed to initialize database: {e}", exc_info=True)
        raise e

    yield

    logger.info("Disposing database connections...")
    await engine.dispose()
    logger.info("Application shutdown complete.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for personal and family credit card expense tracking and Gemini AI invoice parsing.",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Configuration
origins = settings.BACKEND_CORS_ORIGINS if not settings.DEBUG else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Frontend dist path for production single-port serving
FRONTEND_DIST = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
)
assets_path = os.path.join(FRONTEND_DIST, "assets")
if os.path.exists(assets_path):
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")


@app.get("/", tags=["Health"])
async def root(request: Request):
    """
    Root endpoint.
    Returns the React Single Page Application for web browsers (Accept: text/html),
    or JSON metadata for API clients and healthcheck scripts.
    """
    accept = request.headers.get("accept", "")
    index_file = os.path.join(FRONTEND_DIST, "index.html")
    if "text/html" in accept and os.path.exists(index_file):
        return FileResponse(index_file, media_type="text/html")

    return {
        "status": "ok",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Lightweight health check endpoint for monitoring."""
    return {"status": "healthy"}


# Mount API v1 router
app.include_router(api_router, prefix="/api/v1")

