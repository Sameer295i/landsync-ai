import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, func

from .database import engine, Base, SessionLocal, DATABASE_URL
from . import models
from .routers import auth, proposals, compensation, documents, dashboard, analytics, rr

# On a fresh hosted Postgres, PostGIS must be enabled before tables with geometry
# columns can be created. Harmless if it is already enabled.
if DATABASE_URL.startswith("postgresql"):
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))

# For the hackathon prototype, tables are created directly from the models on startup.
# For real deployment, replace this with Alembic migrations so schema changes are
# versioned and reversible instead of applied silently.
Base.metadata.create_all(bind=engine)

# Optional: populate demo data on first boot so a freshly deployed demo is never empty.
# Set SEED_ON_START=true. Only runs when there are no users yet, so it never wipes real data.
if os.getenv("SEED_ON_START", "").lower() == "true":
    db = SessionLocal()
    try:
        has_users = db.query(func.count(models.User.id)).scalar() > 0
    finally:
        db.close()
    if not has_users:
        from .seed import seed
        seed()

app = FastAPI(
    title="LandSync AI",
    description="Backend API for the National Land Acquisition & Management System",
    version="0.1.0",
)

# Local dev: any localhost port. Production: set FRONTEND_ORIGINS to a comma-separated
# list of your deployed frontend URLs, e.g. https://landsync.vercel.app
extra_origins = [o.strip().rstrip("/") for o in os.getenv("FRONTEND_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=extra_origins,
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(proposals.router)
app.include_router(compensation.router)
app.include_router(documents.router)
app.include_router(dashboard.router)
app.include_router(analytics.router)
app.include_router(rr.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "LandSync AI backend"}


@app.get("/health")
def health():
    return {"status": "healthy"}
