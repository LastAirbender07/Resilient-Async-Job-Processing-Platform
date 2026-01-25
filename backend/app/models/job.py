from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from uuid import UUID, uuid4
from typing import Optional, Dict, Any
from app.schemas.job_status import JobStatus
from app.schemas.job_type import JobType

def utc_now():
    return datetime.now(timezone.utc)


@dataclass
class Job:
    """
    Domain model representing a background job.

    This model enforces job state transitions and retry semantics.
    """

    job_id: UUID = field(default_factory=uuid4)
    user_id: str = ""

    job_type: JobType = field(default=None)
    status: JobStatus = JobStatus.CREATED

    input_metadata: Dict[str, Any] = field(default_factory=dict)
    input_file_path: str = ""
    output_file_path: Optional[str] = None

    retry_count: int = 0
    max_retries: int = 3

    error_message: Optional[str] = None

    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)

    next_run_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

    def __post_init__(self):
        if self.job_type is None:
            raise ValueError("job_type is required")

        if not isinstance(self.input_metadata, dict):
            raise ValueError("input_metadata must be a dictionary")


    def should_retry(self) -> bool:
        return self.retry_count < self.max_retries


    # Exponential backoff with a max delay of 5 minutes.
    def compute_next_run_at(self) -> datetime:
        delay_seconds = min(2 ** self.retry_count, 300)
        return utc_now() + timedelta(seconds=delay_seconds)


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
            JobStatus.RETRYING: {JobStatus.QUEUED, JobStatus.PROCESSING},
        }

        return new_status in allowed.get(self.status, set())


    def transition(
        self,
        new_status: JobStatus,
        error_message: Optional[str] = None,
        next_run_at: Optional[datetime] = None,
    ):
        if self.status in {JobStatus.COMPLETED, JobStatus.DEAD}:
            raise ValueError("Cannot transition from terminal state")

        if not self.can_transition_to(new_status):
            raise ValueError(f"Invalid transition {self.status} → {new_status}")

        self.status = new_status
        self.updated_at = utc_now()

        if new_status == JobStatus.FAILED:
            self.retry_count += 1
            self.error_message = error_message

        if new_status == JobStatus.RETRYING:
            self.next_run_at = next_run_at

        if new_status in {JobStatus.COMPLETED, JobStatus.DEAD}:
            self.finished_at = utc_now()
