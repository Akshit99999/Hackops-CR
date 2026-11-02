from datetime import date

from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import Notification, WarrantyItem
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.expiry_notifier.check_warranty_expirations")
def check_warranty_expirations() -> int:
    today = date.today()
    created = 0
    db = SessionLocal()
    try:
        for item in db.query(WarrantyItem).all():
            days = (item.expiry_date - today).days
            if days not in (30, 7, 1, 0):
                continue
            title = "Warranty expires today" if days == 0 else f"Warranty expires in {days} day{'s' if days != 1 else ''}"
            notification = Notification(
                workspace_id=item.workspace_id,
                item_id=item.id,
                entity_name=item.name,
                kind="warranty_expiry",
                title=title,
                detail=f"Review the coverage details and keep any claim evidence for {item.name}.",
                days_before=days,
            )
            db.add(notification)
            try:
                db.commit()
                created += 1
            except IntegrityError:
                db.rollback()  # The daily job is idempotent if it runs more than once.
    finally:
        db.close()
    return created
