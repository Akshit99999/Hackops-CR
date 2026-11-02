from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.common import case_out, warranty_out
from app.database import get_db
from app.models import Activity, DisputeCase, WarrantyItem, Workspace
from app.security import get_workspace

router = APIRouter(prefix="/workspace", tags=["workspace"])


@router.get("/snapshot")
def snapshot(
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    cases = db.query(DisputeCase).filter(DisputeCase.workspace_id == workspace.id).order_by(DisputeCase.created_at.desc()).all()
    warranties = db.query(WarrantyItem).filter(WarrantyItem.workspace_id == workspace.id).order_by(WarrantyItem.created_at.desc()).all()
    activities = db.query(Activity).filter(Activity.workspace_id == workspace.id).order_by(Activity.created_at.desc()).limit(30).all()
    return {
        "version": 1,
        "cases": [case_out(case).model_dump(mode="json") for case in cases],
        "warranties": [warranty_out(item).model_dump(mode="json") for item in warranties],
        "activities": [
            {"id": item.id, "title": item.title, "detail": item.detail, "date": item.created_at.date().isoformat(), "kind": item.kind}
            for item in activities
        ],
        "as_of": date.today().isoformat(),
    }


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    cases = db.query(DisputeCase).filter(DisputeCase.workspace_id == workspace.id).all()
    warranties = db.query(WarrantyItem).filter(WarrantyItem.workspace_id == workspace.id).all()
    activities = db.query(Activity).filter(Activity.workspace_id == workspace.id).order_by(Activity.created_at.desc()).limit(8).all()
    active_cases = [case for case in cases if case.status == "Awaiting response"]
    expiring = [item for item in warranties if 0 <= (item.expiry_date - date.today()).days <= 30]
    return {
        "case_count": len(cases),
        "active_case_count": len(active_cases),
        "warranty_count": len(warranties),
        "expiring_warranty_count": len(expiring),
        "total_recorded_purchase_value": round(sum(item.purchase_price for item in warranties), 2),
        "recent_activity": [
            {"id": item.id, "title": item.title, "detail": item.detail, "date": item.created_at.date().isoformat(), "kind": item.kind}
            for item in activities
        ],
    }
