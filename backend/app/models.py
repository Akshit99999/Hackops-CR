from datetime import date, datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class DisputeCase(Base):
    __tablename__ = "cases"
    __table_args__ = (UniqueConstraint("workspace_id", "id"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    consumer_name: Mapped[str] = mapped_column(String(150))
    consumer_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    merchant: Mapped[str] = mapped_column(String(150))
    product: Mapped[str] = mapped_column(String(200))
    purchase_date: Mapped[date] = mapped_column(Date)
    defect_date: Mapped[date] = mapped_column(Date)
    claim_amount: Mapped[float] = mapped_column(Float)
    tax_paid: Mapped[float] = mapped_column(Float, default=0)
    shipping_paid: Mapped[float] = mapped_column(Float, default=0)
    incidental_expenses: Mapped[float] = mapped_column(Float, default=0)
    interest_rate: Mapped[float] = mapped_column(Float, default=0)
    narrative: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="Draft notice", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    notice_sent_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    cure_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    merkle_root: Mapped[str] = mapped_column(String(64), default="")
    notice_markdown: Mapped[str] = mapped_column(Text, default="")
    sample: Mapped[bool] = mapped_column(Boolean, default=False)
    documents: Mapped[list["EvidenceDocument"]] = relationship(
        back_populates="case", cascade="all, delete-orphan", lazy="selectin"
    )


class WarrantyItem(Base):
    __tablename__ = "warranty_items"
    __table_args__ = (UniqueConstraint("workspace_id", "id"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    brand: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(40), default="Other")
    model_number: Mapped[str] = mapped_column(String(100), default="")
    serial_number: Mapped[str] = mapped_column(String(100), default="")
    seller: Mapped[str] = mapped_column(String(150))
    purchase_date: Mapped[date] = mapped_column(Date)
    purchase_price: Mapped[float] = mapped_column(Float)
    warranty_duration_months: Mapped[int] = mapped_column(Integer)
    expiry_date: Mapped[date] = mapped_column(Date)
    sample: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    documents: Mapped[list["EvidenceDocument"]] = relationship(
        back_populates="warranty", cascade="all, delete-orphan", lazy="selectin"
    )


class EvidenceDocument(Base):
    __tablename__ = "evidence_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    case_id: Mapped[str | None] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), nullable=True, index=True)
    warranty_id: Mapped[str | None] = mapped_column(ForeignKey("warranty_items.id", ondelete="CASCADE"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    storage_key: Mapped[str] = mapped_column(String(100), unique=True)
    extracted_text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    case: Mapped[DisputeCase | None] = relationship(back_populates="documents", foreign_keys=[case_id])
    warranty: Mapped[WarrantyItem | None] = relationship(back_populates="documents", foreign_keys=[warranty_id])


class ContractAuditRecord(Base):
    __tablename__ = "contract_audits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200), default="Untitled contract")
    source_name: Mapped[str] = mapped_column(String(255), default="Pasted text")
    source_text: Mapped[str] = mapped_column(Text)
    result_json: Mapped[str] = mapped_column(Text)
    score: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str] = mapped_column(String(500))
    kind: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (UniqueConstraint("workspace_id", "item_id", "days_before", "kind"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    item_id: Mapped[str] = mapped_column(String(40))
    entity_name: Mapped[str] = mapped_column(String(200), default="")
    kind: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str] = mapped_column(String(500))
    days_before: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
