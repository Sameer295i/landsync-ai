import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# For the hackathon prototype this defaults to SQLite so it runs with zero setup.
# For real deployment, set DATABASE_URL to a Postgres/PostGIS connection string, e.g.:
#   postgresql://landsync:landsync@localhost:5432/landsync
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./landsync.db")
# Some hosts provide postgres:// which SQLAlchemy 2 no longer accepts.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
