from app.core.logging import setup_logging
from app.core.notifications.events import JobEvent
from app.core.notifications.providers.mailtrap import MailtrapEmailProvider

logger = setup_logging()


class NotificationDispatcher:
    """
    Dispatches job lifecycle events to configured notification channels.
    """
    def __init__(self):
        self.providers = [
            MailtrapEmailProvider(),
        ]

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

        for provider in self.providers:
            provider.send(job, event)
