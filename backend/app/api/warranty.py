import calendar
from datetime import date
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.agents.crypto import case_facts, merkle_root
from app.agents.notice_drafter import draft_notice
from app.api.common import case_out, evidence_out, warranty_out
from app.api.documents import persist_upload, remove_document_file, parse_receipt_fields
from app.database import get_db
from app.models import DisputeCase, WarrantyItem, Workspace
from app.schemas import (
    CaseOut,
    EscalateCase,
    WarrantyClaimRequest,
    WarrantyCreate,
    WarrantyOut,
    WarrantyUpdate,
)
from app.security import get_workspace, record_activity

router = APIRouter(prefix="/warranty", tags=["warranty vault"])


def plus_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def owned_item(db: Session, workspace_id: str, item_id: str) -> WarrantyItem:
    item = db.query(WarrantyItem).filter(
        WarrantyItem.workspace_id == workspace_id,
        WarrantyItem.id == item_id,
    ).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Warranty item not found.")
    return item


@router.get("/items", response_model=list[WarrantyOut])
def list_items(
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    items = db.query(WarrantyItem).filter(
        WarrantyItem.workspace_id == workspace.id
    ).order_by(WarrantyItem.created_at.desc()).all()
    return [warranty_out(item) for item in items]


@router.post("/items", response_model=WarrantyOut, status_code=201)
def create_item(
    payload: WarrantyCreate,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    item_id = payload.id or f"WV-{uuid4().hex[:8].upper()}"
    if db.query(WarrantyItem).filter(WarrantyItem.id == item_id).first():
        raise HTTPException(status_code=409, detail="A warranty item with this ID already exists.")
    item = WarrantyItem(
        id=item_id,
        workspace_id=workspace.id,
        name=payload.name.strip(),
        brand=payload.brand.strip(),
        category=payload.category,
        model_number=payload.model_number.strip(),
        serial_number=payload.serial_number.strip(),
        seller=payload.seller.strip(),
        purchase_date=payload.purchase_date,
        purchase_price=payload.purchase_price,
        warranty_duration_months=payload.warranty_duration_months,
        expiry_date=payload.expiry_date or plus_months(payload.purchase_date, payload.warranty_duration_months),
        sample=payload.sample,
    )
    db.add(item)
    record_activity(db, workspace.id, "A new purchase protected", item.name, "warranty")
    db.commit()
    db.refresh(item)
    return warranty_out(item)


@router.get("/items/{item_id}", response_model=WarrantyOut)
def get_item(
    item_id: str,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    return warranty_out(owned_item(db, workspace.id, item_id))


@router.patch("/items/{item_id}", response_model=WarrantyOut)
def update_item(
    item_id: str,
    payload: WarrantyUpdate,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    item = owned_item(db, workspace.id, item_id)
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("purchase_date") and updates["purchase_date"] > date.today():
        raise HTTPException(status_code=422, detail="Purchase date cannot be in the future.")
    for key, value in updates.items():
        setattr(item, key, value)
    if "expiry_date" not in updates and ({"purchase_date", "warranty_duration_months"} & updates.keys()):
        item.expiry_date = plus_months(item.purchase_date, item.warranty_duration_months)
    db.commit()
    db.refresh(item)
    return warranty_out(item)


@router.delete("/items/{item_id}", status_code=204)
def delete_item(
    item_id: str,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    item = owned_item(db, workspace.id, item_id)
    for document in item.documents:
        remove_document_file(document)
    db.delete(item)
    db.commit()
    return None


@router.post("/items/{item_id}/documents", status_code=201)
async def upload_item_document(
    item_id: str,
    file: UploadFile = File(...),
    document_id: str | None = Form(default=None),
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    item = owned_item(db, workspace.id, item_id)
    document, extracted_text = await persist_upload(file, workspace, db, warranty=item, document_id=document_id)
    record_activity(db, workspace.id, "Evidence added to warranty vault", document.name, "audit")
    db.commit()
    db.refresh(document)
    return {
        "document": evidence_out(document),
        "extraction": parse_receipt_fields(extracted_text),
        "extraction_note": "OCR and field matches are suggestions; confirm against the original file.",
    }


@router.post("/ingest", status_code=201)
async def ingest_document(
    file: UploadFile = File(...),
    item_id: str | None = Form(default=None),
    document_id: str | None = Form(default=None),
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    item = owned_item(db, workspace.id, item_id) if item_id else None
    document, extracted_text = await persist_upload(file, workspace, db, warranty=item, document_id=document_id)
    record_activity(db, workspace.id, "Receipt or warranty document ingested", document.name, "audit")
    db.commit()
    db.refresh(document)
    return {
        "document": evidence_out(document),
        "extracted_text": extracted_text,
        "fields": parse_receipt_fields(extracted_text),
        "extraction_note": "Extraction is best-effort. Confirm every field against the original document.",
    }


def claim_packet(item: WarrantyItem, payload: WarrantyClaimRequest) -> str:
    evidence = "\n".join(
        f"- {doc.name} — SHA-256 `{doc.sha256}`" for doc in item.documents
    ) or "- No documents are attached."
    return f"""# Draft warranty service request

**Status:** Draft for consumer review; nothing has been sent.

From: {payload.consumer_name}
Product: {item.name} ({item.brand})
Model: {item.model_number or 'Not provided'}
Serial: {item.serial_number or 'Not provided'}
Seller: {item.seller}
Purchase date: {item.purchase_date.isoformat()}
Purchase price entered: ${item.purchase_price:,.2f}
Warranty end date entered: {item.expiry_date.isoformat()}

## Issue

{payload.defect}

## Requested next step

Please review this request for {payload.requested_action}. Confirm whether the product is covered and explain the next steps, any required documentation, and any applicable service options.

## Evidence inventory

{evidence}

Coverage dates and product details are consumer-entered and do not establish eligibility. Review the warranty and applicable rules, attach original documents when contacting the manufacturer, and keep a copy of any response. This draft is not legal advice and has not been sent.
"""


@router.post("/claim/generate")
def generate_claim(
    payload: WarrantyClaimRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    item = owned_item(db, workspace.id, payload.warranty_item_id)
    return {
        "warranty_item_id": item.id,
        "content_markdown": claim_packet(item, payload),
        "sent": False,
        "service_lookup": {
            "available": False,
            "note": "Confirm current service channels with the manufacturer using its official website or warranty paperwork.",
        },
    }


@router.post("/claim/escalate", response_model=CaseOut, status_code=201)
def escalate_claim(
    payload: EscalateCase,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    item = owned_item(db, workspace.id, payload.warranty_item_id)
    case_id = f"CR-{uuid4().hex[:8].upper()}"
    case = DisputeCase(
        id=case_id,
        workspace_id=workspace.id,
        consumer_name=payload.consumer_name.strip(),
        consumer_address=payload.consumer_address,
        merchant=item.seller,
        product=item.name,
        purchase_date=item.purchase_date,
        defect_date=date.today(),
        claim_amount=item.purchase_price,
        tax_paid=0,
        shipping_paid=0,
        incidental_expenses=0,
        interest_rate=0,
        narrative=payload.defect.strip(),
        status="Draft notice",
    )
    db.add(case)
    db.flush()
    transferred_documents = list(item.documents)
    for document in transferred_documents:
        document.case = case
        document.warranty = None
    db.flush()
    case.merkle_root = merkle_root(
        case_facts(case),
        [doc.sha256 for doc in case.documents],
    )
    case.notice_markdown = draft_notice(case, case.merkle_root)
    record_activity(db, workspace.id, "Warranty issue moved to command center", f"{item.name} · {case.id}", "case")
    db.commit()
    db.refresh(case)
    return case_out(case)
