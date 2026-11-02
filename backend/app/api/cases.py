from datetime import date, timedelta
from io import BytesIO
from pathlib import Path
from shutil import copyfile
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from sqlalchemy.orm import Session

from app.agents.crypto import case_facts, merkle_root
from app.api.documents import persist_upload
from app.agents.issue_spotter import review_prompts
from app.agents.notice_drafter import draft_notice
from app.api.common import case_out
from app.config import settings
from app.database import get_db
from app.models import DisputeCase, EvidenceDocument, Workspace
from app.schemas import CaseCreate, CaseOut, CaseStatusUpdate
from app.security import get_workspace, record_activity

router = APIRouter(prefix="/cases", tags=["cases"])


def seal_case(case: DisputeCase) -> None:
    case.merkle_root = merkle_root(case_facts(case), [doc.sha256 for doc in case.documents])
    case.notice_markdown = draft_notice(case, case.merkle_root)


def owned_case(db: Session, workspace_id: str, case_id: str) -> DisputeCase:
    case = (
        db.query(DisputeCase)
        .filter(DisputeCase.workspace_id == workspace_id, DisputeCase.id == case_id)
        .first()
    )
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found.")
    return case


@router.post("/intake", response_model=CaseOut, status_code=201)
@router.post("", response_model=CaseOut, status_code=201, include_in_schema=False)
def intake_case(
    payload: CaseCreate,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    case_id = payload.id or f"CR-{uuid4().hex[:8].upper()}"
    if db.query(DisputeCase).filter(DisputeCase.id == case_id).first():
        raise HTTPException(status_code=409, detail="A case with this ID already exists.")
    case = DisputeCase(
        id=case_id,
        workspace_id=workspace.id,
        consumer_name=payload.consumer_name.strip(),
        consumer_address=payload.consumer_address,
        merchant=payload.merchant.strip(),
        product=payload.product.strip(),
        purchase_date=payload.purchase_date,
        defect_date=payload.defect_date,
        claim_amount=payload.claim_amount,
        tax_paid=payload.tax_paid,
        shipping_paid=payload.shipping_paid,
        incidental_expenses=payload.incidental_expenses,
        interest_rate=payload.interest_rate,
        narrative=payload.narrative.strip(),
        status="Draft notice",
        sample=payload.sample,
    )
    db.add(case)
    db.flush()
    if payload.evidence_document_ids:
        documents = db.query(EvidenceDocument).filter(
            EvidenceDocument.workspace_id == workspace.id,
            EvidenceDocument.id.in_(payload.evidence_document_ids),
        ).all()
        if len(documents) != len(set(payload.evidence_document_ids)):
            raise HTTPException(status_code=422, detail="One or more evidence documents were not found in this workspace.")
        for source in documents:
            copy_id = str(uuid4())
            source_path = settings.upload_dir.resolve() / source.id[:2] / source.storage_key
            if not source_path.is_file():
                raise HTTPException(status_code=409, detail=f"Stored evidence file is missing: {source.name}")
            copy_key = f"{copy_id}{Path(source.storage_key).suffix}"
            copy_path = settings.upload_dir.resolve() / copy_id[:2] / copy_key
            copy_path.parent.mkdir(parents=True, exist_ok=True)
            copyfile(source_path, copy_path)
            case.documents.append(EvidenceDocument(
                id=copy_id,
                workspace_id=workspace.id,
                case_id=case.id,
                name=source.name,
                content_type=source.content_type,
                size=source.size,
                sha256=source.sha256,
                storage_key=copy_key,
                extracted_text=source.extracted_text,
            ))
    seal_case(case)
    db.add(case)
    record_activity(db, workspace.id, "New case drafted", f"{case.product} · {case.id}", "case")
    db.commit()
    db.refresh(case)
    return case_out(case)


@router.post("/{case_id}/documents", status_code=201)
async def upload_case_document(
    case_id: str,
    file: UploadFile = File(...),
    document_id: str | None = Form(default=None),
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    case = owned_case(db, workspace.id, case_id)
    document, extracted_text = await persist_upload(file, workspace, db, case=case, document_id=document_id)
    record_activity(db, workspace.id, "Evidence added to case", document.name, "audit")
    db.commit()
    db.refresh(document)
    return {
        "document": {
            "id": document.id,
            "name": document.name,
            "size": document.size,
            "sha256": document.sha256,
            "date": document.created_at.date(),
            "content_type": document.content_type,
            "download_url": f"/api/v1/documents/{document.id}/download",
        },
        "extraction_note": "Text extraction is best-effort; confirm against the original file.",
        "extracted_text": extracted_text,
    }


@router.get("", response_model=list[CaseOut])
def list_cases(
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    query = db.query(DisputeCase).filter(DisputeCase.workspace_id == workspace.id)
    if status_filter:
        query = query.filter(DisputeCase.status == status_filter)
    return [case_out(case) for case in query.order_by(DisputeCase.created_at.desc()).all()]


@router.get("/{case_id}", response_model=CaseOut)
def get_case(
    case_id: str,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    return case_out(owned_case(db, workspace.id, case_id))


@router.get("/{case_id}/review-prompts")
def case_review_prompts(
    case_id: str,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    case = owned_case(db, workspace.id, case_id)
    return {
        "informational_only": True,
        "prompts": review_prompts(case.purchase_date, case.defect_date, case.narrative),
    }


@router.patch("/{case_id}", response_model=CaseOut)
def update_case_status(
    case_id: str,
    payload: CaseStatusUpdate,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    case = owned_case(db, workspace.id, case_id)
    if payload.status == "Awaiting response":
        sent_date = payload.notice_sent_date or date.today()
        if sent_date > date.today():
            raise HTTPException(status_code=422, detail="notice_sent_date cannot be in the future.")
        case.notice_sent_date = sent_date
        case.cure_days = payload.cure_days
        case.deadline = sent_date + timedelta(days=payload.cure_days) if payload.cure_days else None
        detail = f"{case.id}; sent date recorded as {sent_date.isoformat()}"
        title = "Notice recorded as sent"
    else:
        case.deadline = None
        case.cure_days = None
        title = "Case marked resolved"
        detail = case.id
    case.status = payload.status
    record_activity(db, workspace.id, title, detail, "case")
    db.commit()
    db.refresh(case)
    return case_out(case)


@router.delete("/{case_id}", status_code=204)
def delete_case(
    case_id: str,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    case = owned_case(db, workspace.id, case_id)
    for document in case.documents:
        from app.api.documents import remove_document_file

        remove_document_file(document)
    db.delete(case)
    db.commit()
    return Response(status_code=204)


@router.get("/{case_id}/notice.md")
def download_notice_markdown(
    case_id: str,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    case = owned_case(db, workspace.id, case_id)
    return Response(
        content=case.notice_markdown,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{case.id}-draft.md"'},
    )


@router.get("/{case_id}/notice.pdf")
def download_notice_pdf(
    case_id: str,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    case = owned_case(db, workspace.id, case_id)
    buffer = BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=letter, title=f"Draft request {case.id}")
    styles = getSampleStyleSheet()
    story = []
    for part in case.notice_markdown.split("\n"):
        escaped = part.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        if part.startswith("# "):
            story.append(Paragraph(escaped[2:], styles["Title"]))
        elif part.startswith("## "):
            story.append(Paragraph(escaped[3:], styles["Heading2"]))
        elif part.startswith("- ") or part.startswith("**"):
            story.append(Paragraph(escaped.replace("**", ""), styles["BodyText"]))
        else:
            story.append(Paragraph(escaped or "&nbsp;", styles["BodyText"]))
        story.append(Spacer(1, 5))
    document.build(story)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{case.id}-draft.pdf"'},
    )
