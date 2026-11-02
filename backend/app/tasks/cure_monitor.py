from datetime import date

from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import DisputeCase, Notification
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.cure_monitor.check_response_deadlines")
def check_response_deadlines() -> int:
    today = date.today()
    created = 0
    db = SessionLocal()
    try:
        cases = db.query(DisputeCase).filter(
            DisputeCase.status == "Awaiting response",
            DisputeCase.deadline.is_not(None),
            DisputeCase.deadline <= today,
        ).all()
        for case in cases:
            notification = Notification(
                workspace_id=case.workspace_id,
                item_id=case.id,
                entity_name=case.product,
                kind="response_deadline",
                title="Recorded response date has passed",
                detail=f"The response date you entered for case {case.id} has passed. Review the record and choose your next step.",
                days_before=0,
            )
            db.add(notification)
            try:
                db.commit()
                created += 1
            except IntegrityError:
                db.rollback()
    finally:
        db.close()
    return created
