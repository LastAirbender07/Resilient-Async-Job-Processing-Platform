from abc import ABC, abstractmethod
from app.core.notifications.events import JobEvent

class NotificationProvider(ABC):
    @abstractmethod
    def send(self, job, event: JobEvent) -> None:
        """
        Send a notification for a job event.

        Must be fire-and-forget.
        Must not raise.
        """
        pass
