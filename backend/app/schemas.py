from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class WorkspaceCreated(BaseModel):
    workspace_id: str
    access_token: str
    token_type: str = "bearer"
    note: str = "Save this token securely. It cannot be recovered."


class CaseCreate(BaseModel):
    id: str | None = Field(default=None, min_length=3, max_length=40)
    consumer_name: str = Field(min_length=2, max_length=150)
    consumer_address: str | None = Field(default=None, max_length=500)
    merchant: str = Field(min_length=2, max_length=150)
    product: str = Field(min_length=2, max_length=200)
    purchase_date: date
    defect_date: date
    claim_amount: float = Field(gt=0, le=10_000_000)
    tax_paid: float = Field(default=0, ge=0, le=10_000_000)
    shipping_paid: float = Field(default=0, ge=0, le=10_000_000)
    incidental_expenses: float = Field(default=0, ge=0, le=10_000_000)
    interest_rate: float = Field(default=0, ge=0, le=1)
    narrative: str = Field(min_length=20, max_length=10_000)
    evidence_document_ids: list[str] = Field(default_factory=list, max_length=50)
    sample: bool = False

    @model_validator(mode="after")
    def validate_dates(self):
        if self.purchase_date > self.defect_date:
            raise ValueError("purchase_date must be on or before defect_date")
        if self.defect_date > date.today():
            raise ValueError("defect_date cannot be in the future")
        return self


class CaseStatusUpdate(BaseModel):
    status: Literal["Awaiting response", "Resolved"]
    notice_sent_date: date | None = None
    cure_days: int | None = Field(default=None, ge=1, le=365)


class EvidenceOut(BaseModel):
    id: str
    name: str
    size: int
    sha256: str
    date: date
    content_type: str
    download_url: str


class CaseOut(BaseModel):
    id: str
    consumer_name: str
    merchant: str
    product: str
    purchase_date: date
    defect_date: date
    claim_amount: float
    narrative: str
    status: str
    created_date: date
    deadline: date | None
    documents: list[EvidenceOut]
    sample: bool
    tax_paid: float
    shipping_paid: float
    incidental_expenses: float
    interest_rate: float
    interest_estimate: float
    total_demand_estimate: float
    merkle_root: str
    notice_markdown: str
    days_remaining: int | None


class WarrantyCreate(BaseModel):
    id: str | None = Field(default=None, min_length=3, max_length=40)
    name: str = Field(min_length=2, max_length=200)
    brand: str = Field(min_length=1, max_length=100)
    category: Literal["Audio", "Computing", "Home", "Other"] = "Other"
    model_number: str = Field(default="", max_length=100)
    serial_number: str = Field(default="", max_length=100)
    seller: str = Field(min_length=2, max_length=150)
    purchase_date: date
    purchase_price: float = Field(gt=0, le=10_000_000)
    warranty_duration_months: int = Field(ge=1, le=240)
    expiry_date: date | None = None
    sample: bool = False

    @field_validator("purchase_date")
    @classmethod
    def purchase_not_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("purchase_date cannot be in the future")
        return value


class WarrantyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    brand: str | None = Field(default=None, min_length=1, max_length=100)
    category: Literal["Audio", "Computing", "Home", "Other"] | None = None
    model_number: str | None = Field(default=None, max_length=100)
    serial_number: str | None = Field(default=None, max_length=100)
    seller: str | None = Field(default=None, min_length=2, max_length=150)
    purchase_date: date | None = None
    purchase_price: float | None = Field(default=None, gt=0, le=10_000_000)
    warranty_duration_months: int | None = Field(default=None, ge=1, le=240)
    expiry_date: date | None = None

    @model_validator(mode="after")
    def purchase_not_future(self):
        if self.purchase_date and self.purchase_date > date.today():
            raise ValueError("purchase_date cannot be in the future")
        return self


class WarrantyOut(BaseModel):
    id: str
    name: str
    brand: str
    category: str
    model_number: str
    serial_number: str
    seller: str
    purchase_date: date
    purchase_price: float
    warranty_duration_months: int
    expiry_date: date
    documents: list[EvidenceOut]
    sample: bool
    days_remaining: int
    status: Literal["active", "expiring_soon", "expired"]


class ClaimGenerate(BaseModel):
    consumer_name: str = Field(min_length=2, max_length=150)
    defect: str = Field(min_length=20, max_length=10_000)
    requested_action: str = Field(default="repair or replacement", max_length=200)


class EscalateCase(ClaimGenerate):
    warranty_item_id: str = Field(min_length=3, max_length=40)
    consumer_address: str | None = Field(default=None, max_length=500)


class WarrantyClaimRequest(ClaimGenerate):
    warranty_item_id: str = Field(min_length=3, max_length=40)


class ContractAuditRequest(BaseModel):
    title: str = Field(default="Untitled contract", min_length=1, max_length=200)
    source_name: str = Field(default="Pasted text", min_length=1, max_length=255)
    text: str = Field(min_length=20, max_length=500_000)


class ContractChatRequest(BaseModel):
    contract_id: str = Field(min_length=1, max_length=36)
    question: str = Field(min_length=3, max_length=2_000)


class ScanRequest(BaseModel):
    barcode: str | None = Field(default=None, max_length=80)
    product_name: str | None = Field(default=None, max_length=200)
    brand: str | None = Field(default=None, max_length=100)
    model_number: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def require_identifier(self):
        if not any((self.barcode, self.product_name, self.brand, self.model_number)):
            raise ValueError("Provide a barcode, product name, brand, or model number")
        return self


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    kind: str
    title: str
    detail: str
    days_before: int
    created_at: datetime
    read: bool
