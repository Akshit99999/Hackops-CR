from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "hackops_cr",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.expiry_notifier", "app.tasks.cure_monitor"],
)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "daily-warranty-expiry-check": {
            "task": "app.tasks.expiry_notifier.check_warranty_expirations",
            "schedule": crontab(hour=6, minute=0),
        },
        "daily-case-response-deadline-check": {
            "task": "app.tasks.cure_monitor.check_response_deadlines",
            "schedule": crontab(hour=6, minute=5),
        },
    },
)
