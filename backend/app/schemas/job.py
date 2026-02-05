from pydantic import BaseModel, Field, EmailStr
from uuid import UUID
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.core.enums.job_event import JobEvent
from app.core.enums.job_status import JobStatus
from app.core.enums.job_type import JobType

class JobContext(BaseModel):
    user_id: Optional[str] = Field(
        default=None,
        description="Opaque user identifier from upstream system"
    )
    email: Optional[EmailStr] = Field(
        default=None,
        description="Email address for job notifications"
    )

class EmailNotificationConfig(BaseModel):
    enabled: bool = Field(
        default=True,
        description="Whether email notifications are enabled"
    )
    on: List[JobEvent] = Field(
        default_factory=lambda: [JobEvent.FAILURE],
        description="Job events that should trigger an email"
    )

class JobNotifications(BaseModel):
    email: Optional[EmailNotificationConfig] = Field(
        default=None,
        description="Email notification configuration"
    )

class JobCreateRequest(BaseModel):
    """
    Request payload to create a new async processing job.
    The input file MUST already exist in object storage before this API is called.
    """
    job_type: JobType

    input_file_path: str = Field(
        ...,
        description=(
            "Object key of the input file in the configured input bucket. "
            "The file must already be uploaded before job creation."
        ),
        example="test.json",
    )

    input_metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Processor-specific configuration (key, columns, flags, etc.)",
        example={"key": ",", "has_header": True},
    )

    context: Optional[JobContext] = Field(
        default=None,
        description="Context about who or what triggered the job"
    )

    notifications: Optional[JobNotifications] = Field(
        default=None,
        description="Notification preferences for job lifecycle events"
    )

    max_retries: int = Field(
        default=3,
        ge=0,
        le=10,
        description="Maximum retry attempts before marking job as DEAD",
    )

class JobCreateResponse(BaseModel):
    """
    Response returned after a job is successfully created.
    """

    job_id: UUID = Field(..., description="Unique identifier for the job")
    status: JobStatus = Field(..., description="Initial job status")

class JobStatusResponse(BaseModel):
    """
    Represents the current state of a job.
    """

    job_id: UUID
    job_type: JobType
    status: JobStatus

    retry_count: int
    max_retries: int

    error_message: Optional[str]

    input_file_path: str
    output_file_path: Optional[str]

    created_at: datetime
    updated_at: datetime

    next_run_at: Optional[datetime]
    finished_at: Optional[datetime]

class JobListResponse(BaseModel):
    """
    Paginated list of jobs for a user.
    """

    items: List[JobStatusResponse]
    total: int
    limit: int
    offset: int
    