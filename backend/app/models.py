import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def uid() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


class Case(Base):
    __tablename__ = "cases"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(120))
    district: Mapped[str] = mapped_column(String(60))
    village: Mapped[str] = mapped_column(String(60))
    survey_no: Mapped[str] = mapped_column(String(30))
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    geo: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    documents: Mapped[list["Document"]] = relationship(cascade="all, delete-orphan", order_by="Document.created_at")
    findings: Mapped[list["Finding"]] = relationship(cascade="all, delete-orphan")
    messages: Mapped[list["Message"]] = relationship(cascade="all, delete-orphan", order_by="Message.id")


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(30))
    original_name: Mapped[str] = mapped_column(String(200))
    stored_name: Mapped[str] = mapped_column(String(80))
    mime: Mapped[str] = mapped_column(String(50))
    size: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="processing")  # processing|extracted|needs_ocr|failed
    error: Mapped[str | None] = mapped_column(String(300))
    ocr_confidence: Mapped[float | None] = mapped_column(Float)
    text: Mapped[str | None] = mapped_column(Text)
    fields: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Finding(Base):
    __tablename__ = "findings"
    __table_args__ = (UniqueConstraint("case_id", "key"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(80))
    code: Mapped[str] = mapped_column(String(40))
    category: Mapped[str] = mapped_column(String(30))
    severity: Mapped[str] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str] = mapped_column(Text)
    evidence: Mapped[list] = mapped_column(JSON, default=list)
    action: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(12), default="open")  # open|reviewed|dismissed
    note: Mapped[str | None] = mapped_column(String(500))


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(10))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(40))
    target: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
