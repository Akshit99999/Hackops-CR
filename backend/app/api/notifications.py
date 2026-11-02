from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Notification, Workspace
from app.schemas import NotificationOut
from app.security import get_workspace

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationUpdate(BaseModel):
    read: bool


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    query = db.query(Notification).filter(Notification.workspace_id == workspace.id)
    if unread_only:
        query = query.filter(Notification.read.is_(False))
    return query.order_by(Notification.created_at.desc()).limit(100).all()


@router.patch("/{notification_id}", response_model=NotificationOut)
def update_notification(
    notification_id: str,
    payload: NotificationUpdate,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_workspace),
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.workspace_id == workspace.id,
    ).first()
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found.")
    notification.read = payload.read
    db.commit()
    db.refresh(notification)
    return notification
