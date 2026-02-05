from app.core.logging import setup_logging
from app.core.notifications.events import JobEvent

logger = setup_logging()


class NotificationDispatcher:
    """
    Dispatches job lifecycle events to configured notification channels.

    This class is intentionally a no-op placeholder.
    Provider-specific logic will be introduced later.
    """

    def dispatch(self, job, event: JobEvent) -> None:
        logger.info(
            "Notification dispatch requested",
            extra={
                "job_id": str(job.job_id),
                "event": event.value,
                "context": getattr(job, "context", {}),
                "notifications": getattr(job, "notifications", {}),
            },
        )
