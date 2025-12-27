from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import Optional
from app.schemas.job_status import JobStatus


@dataclass
class Job:
    """
    Domain model representing a background job.

    This model enforces job state transitions and retry semantics.
    """

    job_id: UUID = field(default_factory=uuid4)
    user_id: str = ""
    status: JobStatus = JobStatus.CREATED

    input_file_path: str = ""
    output_file_path: Optional[str] = None

    retry_count: int = 0
    max_retries: int = 3

    error_message: Optional[str] = None

    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def can_transition_to(self, new_status: JobStatus) -> bool:
        allowed = {
            JobStatus.CREATED: {JobStatus.QUEUED},
            JobStatus.QUEUED: {JobStatus.PROCESSING},
            JobStatus.PROCESSING: {
                JobStatus.COMPLETED,
                JobStatus.FAILED,
            },
            JobStatus.FAILED: {
                JobStatus.RETRYING,
                JobStatus.DEAD,
            },
            JobStatus.RETRYING: {JobStatus.PROCESSING},
        }

        return new_status in allowed.get(self.status, set())

    def transition(self, new_status: JobStatus, error_message: Optional[str] = None):
        if self.status in {JobStatus.COMPLETED, JobStatus.DEAD}:
            raise ValueError("Cannot transition from terminal state")

        if not self.can_transition_to(new_status):
            raise ValueError(f"Invalid transition {self.status} → {new_status}")

        self.status = new_status
        self.updated_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds") + "Z"

        if new_status == JobStatus.FAILED:
            self.retry_count += 1
            self.error_message = error_message

        if self.retry_count >= self.max_retries:
            self.status = JobStatus.DEAD
