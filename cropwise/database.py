"""Database layer: SQLAlchemy models and the session dependency.

One `DATABASE_URL` drives everything. It defaults to SQLite so the project runs with no setup,
and accepts a Postgres URL (Supabase or anything else) without a code change — which is why the
models avoid SQLite-only types.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Generator

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker


def database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        # Supabase and Heroku hand out postgres://, which SQLAlchemy 2 no longer accepts.
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    if os.environ.get("VERCEL"):
        # Vercel's filesystem is read-only apart from /tmp, and /tmp does not survive a cold start.
        return "sqlite:////tmp/cropwise.db"
    return f"sqlite:///{os.environ.get('CROPWISE_DB', 'cropwise.db')}"


_url = database_url()
engine = create_engine(
    _url,
    connect_args={"check_same_thread": False} if _url.startswith("sqlite") else {},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    predictions: Mapped[list["Prediction"]] = relationship(back_populates="user")


class Prediction(Base):
    """One recommendation, kept so the farmer can compare seasons and so we can measure drift."""

    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    crop: Mapped[str] = mapped_column(String(60), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    model_source: Mapped[str] = mapped_column(String(10), default="field")  # field | lab
    unusual_readings: Mapped[bool] = mapped_column(Boolean, default=False)
    city: Mapped[str | None] = mapped_column(String(120))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    nitrogen: Mapped[float | None] = mapped_column(Float)
    phosphorus: Mapped[float | None] = mapped_column(Float)
    potassium: Mapped[float | None] = mapped_column(Float)
    ph: Mapped[float | None] = mapped_column(Float)
    clay: Mapped[float | None] = mapped_column(Float)
    organic_carbon: Mapped[float | None] = mapped_column(Float)
    temperature: Mapped[float | None] = mapped_column(Float)
    humidity: Mapped[float | None] = mapped_column(Float)
    rainfall: Mapped[float | None] = mapped_column(Float)
    alternatives: Mapped[str | None] = mapped_column(Text)  # JSON: the other two crops
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)

    user: Mapped[User] = relationship(back_populates="predictions")


class MandiPrice(Base):
    """Daily cache of Agmarknet prices. The upstream API is slow and often down, so a stale row
    with a visible date is better than an empty page."""

    __tablename__ = "mandi_prices"
    __table_args__ = (UniqueConstraint("crop", "state", "market", "price_date", name="uq_mandi_day"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    crop: Mapped[str] = mapped_column(String(60), index=True)
    state: Mapped[str] = mapped_column(String(80), index=True)
    district: Mapped[str | None] = mapped_column(String(80))
    market: Mapped[str] = mapped_column(String(120))
    price_date: Mapped[str] = mapped_column(String(10), index=True)  # YYYY-MM-DD
    min_price: Mapped[float | None] = mapped_column(Float)
    max_price: Mapped[float | None] = mapped_column(Float)
    modal_price: Mapped[float | None] = mapped_column(Float)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    is_mock: Mapped[bool] = mapped_column(Boolean, default=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


def init_db() -> None:
    Base.metadata.create_all(engine)


def get_db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
