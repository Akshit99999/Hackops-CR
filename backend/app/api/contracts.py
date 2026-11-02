import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ContractAuditRecord, Workspace
from app.nlp.claudette import audit_contract
from app.nlp.rag import grounded_answer
from app.schemas import ContractAuditRequest, ContractChatRequest
from app.security import get_workspace, record_activity

router = APIRouter(prefix="/contracts", tags=["contract screening"])


@router.post("/audit", status_code=201)
def create_audit(
    payload: ContractAuditRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    result = audit_contract(payload.text)
    record = ContractAuditRecord(
        id=result["id"],
        workspace_id=workspace.id,
        title=payload.title.strip(),
        source_name=payload.source_name.strip(),
        source_text=payload.text,
        result_json=json.dumps(result, ensure_ascii=False),
        score=result["score"],
    )
    db.add(record)
    record_activity(db, workspace.id, "Contract screening completed", payload.title.strip(), "audit")
    db.commit()
    return {**result, "title": record.title, "created_at": record.created_at}


@router.get("")
def list_audits(
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    records = db.query(ContractAuditRecord).filter(
        ContractAuditRecord.workspace_id == workspace.id
    ).order_by(ContractAuditRecord.created_at.desc()).limit(100).all()
    return [
        {"id": row.id, "title": row.title, "source_name": row.source_name,
         "score": row.score, "created_at": row.created_at}
        for row in records
    ]


@router.get("/{audit_id}")
def get_audit(
    audit_id: str,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    record = db.query(ContractAuditRecord).filter(
        ContractAuditRecord.id == audit_id,
        ContractAuditRecord.workspace_id == workspace.id,
    ).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Contract audit not found.")
    return {**json.loads(record.result_json), "title": record.title, "source_name": record.source_name,
            "created_at": record.created_at}


@router.post("/chat")
def chat_about_audit(
    payload: ContractChatRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    record = db.query(ContractAuditRecord).filter(
        ContractAuditRecord.id == payload.contract_id,
        ContractAuditRecord.workspace_id == workspace.id,
    ).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Contract audit not found.")
    result = json.loads(record.result_json)
    return {
        **grounded_answer(result["sentences"], payload.question),
        "contract_id": record.id,
        "method": "extractive lexical retrieval; no generative model is used",
    }
