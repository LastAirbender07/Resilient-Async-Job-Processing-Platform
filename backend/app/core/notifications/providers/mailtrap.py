import mailtrap as mt
from app.core.notifications.providers.base import NotificationProvider
from app.core.notifications.events import JobEvent
from app.core.settings import settings
from app.core.logging import setup_logging

logger = setup_logging()


class MailtrapEmailProvider(NotificationProvider):
    def __init__(self):
        self.client = mt.MailtrapClient(
            token=settings.MAILTRAP_API_KEY,
            sandbox=settings.MAILTRAP_USE_SANDBOX,
            inbox_id=settings.MAILTRAP_INBOX_ID,
        )

    def send(self, job, event: JobEvent) -> None:
        try:
            context = job.context or {}
            notifications = job.notifications or {}

            email_cfg = notifications.get("email")
            if not email_cfg or not email_cfg.get("enabled", False):
                return

            if event.value not in email_cfg.get("on", []):
                return

            recipient = context.get("email")
            if not recipient:
                logger.warning(
                    "Email notification skipped: no recipient",
                    extra={"job_id": str(job.job_id)},
                )
                return

            mail = mt.Mail(
                sender=mt.Address(
                    email=settings.MAILTRAP_SENDER_EMAIL,
                    name=settings.MAILTRAP_SENDER_NAME,
                ),
                to=[mt.Address(email=recipient)],
                subject=f"Job {job.job_id} {event.value}",
                text=(
                    f"Job ID: {job.job_id}\n"
                    f"Type: {job.job_type}\n"
                    f"Status: {job.status}\n"
                    f"Event: {event.value}\n"
                ),
                category="job_notification",
            )

            logger.info(f"Mailtrap email prepared: {mail}")
            self.client.send(mail)

            logger.info(
                "Mailtrap email sent",
                extra={
                    "job_id": str(job.job_id),
                    "event": event.value,
                    "recipient": recipient,
                },
            )

        except Exception:
            # CRITICAL RULE: providers must never break job flow
            logger.exception(
                "Mailtrap notification failed",
                extra={"job_id": str(job.job_id), "event": event.value},
            )
