import hashlib
import re
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, model_validator
from pypdf import PdfReader
from sqlalchemy.orm import Session

from app.agents.crypto import case_facts, merkle_root
from app.agents.notice_drafter import draft_notice
from app.config import settings
from app.database import get_db
from app.models import DisputeCase, EvidenceDocument, WarrantyItem, Workspace
from app.security import get_workspace, record_activity

router = APIRouter(prefix="/documents", tags=["evidence"])

ALLOWED_TYPES = {
    "application/pdf": (".pdf", b"%PDF"),
    "image/jpeg": (".jpg", b"\xff\xd8\xff"),
    "image/png": (".png", b"\x89PNG\r\n\x1a\n"),
}


class AttachDocument(BaseModel):
    case_id: str | None = Field(default=None, max_length=40)
    warranty_id: str | None = Field(default=None, max_length=40)

    @model_validator(mode="after")
    def require_single_parent(self):
        if bool(self.case_id) == bool(self.warranty_id):
            raise ValueError("Provide exactly one of case_id or warranty_id")
        return self


def extract_text(content: bytes, content_type: str) -> str:
    if content_type == "application/pdf":
        try:
            reader = PdfReader(__import__("io").BytesIO(content), strict=False)
            return "\n".join((page.extract_text() or "") for page in reader.pages[:100])[:100_000]
        except Exception:
            return ""
    try:
        import pytesseract
        from PIL import Image

        image = Image.open(__import__("io").BytesIO(content))
        return pytesseract.image_to_string(image)[:100_000]
    except Exception:
        return ""


def parse_receipt_fields(text: str) -> dict:
    dates = re.findall(r"\b(?:20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]20\d{2})\b", text)
    prices = re.findall(r"(?:\$|USD\s*)\s*(\d{1,7}(?:,\d{3})*(?:\.\d{2})?)", text, re.I)
    serials = re.findall(r"\b(?=[A-Z0-9-]{8,20}\b)(?=.*[A-Z])(?=.*\d)[A-Z0-9-]+\b", text, re.I)
    months = re.findall(r"\b(\d{1,3})\s*(?:months?|mos?)\b", text, re.I)
    return {
        "purchase_date_candidates": dates[:5],
        "amount_candidates": [float(price.replace(",", "")) for price in prices[:10]],
        "serial_number_candidates": list(dict.fromkeys(serials))[:10],
        "warranty_month_candidates": [int(value) for value in months[:5]],
        "requires_consumer_confirmation": True,
    }


async def persist_upload(
    upload: UploadFile,
    workspace: Workspace,
    db: Session,
    *,
    case: DisputeCase | None = None,
    warranty: WarrantyItem | None = None,
    document_id: str | None = None,
) -> tuple[EvidenceDocument, str]:
    if not upload.filename:
        raise HTTPException(status_code=422, detail="A filename is required.")
    filename = Path(upload.filename.replace("\\", "/")).name[:255]
    content_type = (upload.content_type or "").split(";")[0].lower()
    allowed = ALLOWED_TYPES.get(content_type)
    if not allowed or Path(filename).suffix.lower() not in {allowed[0], ".jpeg" if content_type == "image/jpeg" else allowed[0]}:
        raise HTTPException(status_code=415, detail="Only PDF, JPEG, and PNG files are accepted.")
    content = await upload.read(settings.max_upload_bytes + 1)
    if not content:
        raise HTTPException(status_code=422, detail="The uploaded file is empty.")
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.max_upload_bytes} bytes.")
    if not content.startswith(allowed[1]):
        raise HTTPException(status_code=415, detail="File content does not match its declared type.")

    if document_id:
        try:
            document_id = str(UUID(document_id))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="document_id must be a UUID.") from exc
        if db.query(EvidenceDocument).filter(EvidenceDocument.id == document_id).first():
            raise HTTPException(status_code=409, detail="A document with this ID already exists.")
    else:
        document_id = str(uuid4())
    storage_key = f"{document_id}{allowed[0]}"
    destination = settings.upload_dir.resolve() / document_id[:2] / storage_key
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    raw_text = extract_text(content, content_type)
    document = EvidenceDocument(
        id=document_id,
        workspace_id=workspace.id,
        case_id=case.id if case else None,
        warranty_id=warranty.id if warranty else None,
        name=filename,
        content_type=content_type,
        size=len(content),
        sha256=hashlib.sha256(content).hexdigest(),
        storage_key=storage_key,
        extracted_text=raw_text,
    )
    db.add(document)
    if case:
        db.flush()
        case.documents.append(document)
        case.merkle_root = merkle_root(case_facts(case), [item.sha256 for item in case.documents])
        case.notice_markdown = draft_notice(case, case.merkle_root)
    elif warranty:
        warranty.documents.append(document)
    return document, raw_text


def remove_document_file(document: EvidenceDocument) -> None:
    path = (settings.upload_dir.resolve() / document.id[:2] / document.storage_key).resolve()
    try:
        path.relative_to(settings.upload_dir.resolve())
    except ValueError:
        return
    path.unlink(missing_ok=True)


@router.post("/{document_id}/attach")
def attach_document(
    document_id: str,
    payload: AttachDocument,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    document = db.query(EvidenceDocument).filter(
        EvidenceDocument.id == document_id,
        EvidenceDocument.workspace_id == workspace.id,
    ).first()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if document.case_id or document.warranty_id:
        raise HTTPException(status_code=409, detail="Document is already attached.")
    if payload.case_id:
        case = db.query(DisputeCase).filter(
            DisputeCase.id == payload.case_id,
            DisputeCase.workspace_id == workspace.id,
        ).first()
        if case is None:
            raise HTTPException(status_code=404, detail="Case not found.")
        document.case = case
        db.flush()
        case.merkle_root = merkle_root(case_facts(case), [item.sha256 for item in case.documents])
        case.notice_markdown = draft_notice(case, case.merkle_root)
    else:
        warranty = db.query(WarrantyItem).filter(
            WarrantyItem.id == payload.warranty_id,
            WarrantyItem.workspace_id == workspace.id,
        ).first()
        if warranty is None:
            raise HTTPException(status_code=404, detail="Warranty item not found.")
        document.warranty = warranty
    record_activity(db, workspace.id, "Evidence attached", document.name, "audit")
    db.commit()
    return {"id": document.id, "attached": True}


@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    document = db.query(EvidenceDocument).filter(
        EvidenceDocument.id == document_id,
        EvidenceDocument.workspace_id == workspace.id,
    ).first()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    path = (settings.upload_dir.resolve() / document.id[:2] / document.storage_key).resolve()
    try:
        path.relative_to(settings.upload_dir.resolve())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Document file not found.") from exc
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Document file not found.")
    with path.open("rb") as stored_file:
        current_hash = hashlib.file_digest(stored_file, "sha256").hexdigest()
    if current_hash != document.sha256:
        raise HTTPException(status_code=409, detail="Stored file integrity check failed.")
    return FileResponse(
        path,
        media_type=document.content_type,
        filename=document.name,
        headers={"X-Content-SHA256": document.sha256, "X-Integrity-Verified": "true"},
    )
