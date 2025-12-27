from pydantic import BaseModel, Field
from uuid import UUID
from typing import List, Optional
from datetime import datetime
from app.schemas.job_status import JobStatus

class JobCreateRequest(BaseModel):
    """
    Request payload to create a new async processing job.
    """

    input_file_path: str = Field(
        ...,
        description="Path or object key of the uploaded file to be processed",
        example="uploads/user123/data.csv",
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
    status: JobStatus

    retry_count: int
    max_retries: int

    error_message: Optional[str]

    created_at: datetime
    updated_at: datetime

class JobListResponse(BaseModel):
    """
    Paginated list of jobs for a user.
    """

    items: List[JobStatusResponse]
    total: int
    limit: int
    offset: int
    