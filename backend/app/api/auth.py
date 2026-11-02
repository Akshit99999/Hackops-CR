from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.documents import remove_document_file
from app.models import Activity, ContractAuditRecord, DisputeCase, EvidenceDocument, Notification, WarrantyItem, Workspace
from app.schemas import WorkspaceCreated
from app.security import create_workspace_token, get_workspace

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.post("", response_model=WorkspaceCreated, status_code=201)
def create_workspace(db: Session = Depends(get_db)):
    """Create a private device workspace and return its one-time bearer token."""
    workspace, token = create_workspace_token()
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return WorkspaceCreated(workspace_id=workspace.id, access_token=token)


@router.get("/me")
def current_workspace(workspace: Workspace = Depends(get_workspace)):
    return {"workspace_id": workspace.id, "created_at": workspace.created_at}


@router.delete("/me", status_code=204)
def delete_workspace(
    workspace: Workspace = Depends(get_workspace),
    db: Session = Depends(get_db),
):
    """Permanently delete this workspace, its records, and its uploaded files."""
    documents = db.query(EvidenceDocument).filter(EvidenceDocument.workspace_id == workspace.id).all()
    for document in documents:
        remove_document_file(document)
    db.query(EvidenceDocument).filter(EvidenceDocument.workspace_id == workspace.id).delete(synchronize_session=False)
    for model in (Activity, ContractAuditRecord, DisputeCase, WarrantyItem, Notification):
        db.query(model).filter(model.workspace_id == workspace.id).delete(synchronize_session=False)
    db.delete(workspace)
    db.commit()
    return Response(status_code=204)
