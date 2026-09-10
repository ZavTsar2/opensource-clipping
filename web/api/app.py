"""
web.api.app — FastAPI Application Entry Point

OpenSource Clipping Studio — Web GUI Backend

Run with:
    uvicorn web.api.app:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

from contextlib import asynccontextmanager
import os

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routes import jobs, files, settings


def require_api_token(authorization: str | None = Header(default=None)) -> None:
    """Protect a personal notebook tunnel from unauthenticated use."""
    import hmac
    import os

    expected = os.environ.get("CLIP_STUDIO_TOKEN")
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CLIP_STUDIO_TOKEN is not configured on this notebook.",
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing studio token.")
    supplied = authorization.removeprefix("Bearer ").strip()
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid studio token.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
    print("🚀 OpenSource Clipping Studio — Backend starting...")
    yield
    print("👋 Backend shutting down...")


app = FastAPI(
    title="OpenSource Clipping Studio",
    description="AI Auto-Clipper & Teaser Generator — Web GUI API",
    version="1.12.0",
    lifespan=lifespan,
    dependencies=[Depends(require_api_token)],
)

# CORS — allow frontend dev server
allowed_origins = [origin.strip() for origin in os.environ.get(
    "CLIP_STUDIO_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(jobs.router)
app.include_router(files.router)
app.include_router(settings.router)


@app.get("/")
async def root():
    return {
        "name": "OpenSource Clipping Studio",
        "version": "1.13.0",
        "docs": "/docs",
        "health": "/api/health",
    }
