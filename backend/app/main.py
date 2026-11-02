from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app import models  # noqa: F401 - register SQLAlchemy table metadata.
from app.api import auth, cases, contracts, documents, notifications, scan, warranty, workspace
from app.config import settings
from app.database import Base, engine


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    yield
    engine.dispose()


app = FastAPI(
    title=settings.app_name,
    description=(
        "Private consumer workspaces, evidence storage, warranty tracking, "
        "transparent contract screening, and public product-source lookup. "
        "Generated analyses are informational and do not determine legal eligibility."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store" if request.url.path.startswith("/api/") else "no-cache"
    return response


@app.get("/health/live", tags=["health"])
def liveness():
    return {"status": "ok"}


@app.get("/health/ready", tags=["health"])
def readiness():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ready", "database": "ok"}


api_prefix = "/api/v1"
for module in (auth, workspace, cases, warranty, documents, contracts, scan, notifications):
    app.include_router(module.router, prefix=api_prefix)
