import hashlib
import secrets

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Workspace


def digest_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_workspace_token() -> tuple[Workspace, str]:
    token = secrets.token_urlsafe(48)
    workspace = Workspace(token_hash=digest_token(token))
    return workspace, token


def get_workspace(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Workspace:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A workspace bearer token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.removeprefix("Bearer ").strip()
    if len(token) < 32:
        raise HTTPException(status_code=401, detail="Invalid workspace token.")
    workspace = db.query(Workspace).filter(Workspace.token_hash == digest_token(token)).first()
    if workspace is None:
        raise HTTPException(status_code=401, detail="Invalid workspace token.")
    return workspace


def record_activity(db: Session, workspace_id: str, title: str, detail: str, kind: str) -> None:
    from app.models import Activity

    db.add(Activity(workspace_id=workspace_id, title=title, detail=detail[:500], kind=kind))
