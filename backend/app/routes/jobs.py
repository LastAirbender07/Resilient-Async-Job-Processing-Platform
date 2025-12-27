from fastapi import APIRouter, HTTPException, status
from uuid import UUID

from app.schemas.job import (
    JobCreateRequest,
    JobCreateResponse,
    JobStatusResponse,
)
from app.models.job import Job, JobStatus
from app.core.logging import setup_logging

router = APIRouter(prefix="/jobs", tags=["Jobs"])
logger = setup_logging()

# Temporary in-memory store
JOBS = {}


@router.post(
    "",
    response_model=JobCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_job(request: JobCreateRequest):
    job = Job(
        input_file_path=request.input_file_path,
        max_retries=request.max_retries,
    )

    job.transition(JobStatus.QUEUED)

    JOBS[str(job.job_id)] = job

    logger.info(
        "Job created",
        extra={"job_id": str(job.job_id)},
    )

    return JobCreateResponse(job_id=job.job_id, status=job.status)


@router.get(
    "/{job_id}",
    response_model=JobStatusResponse,
)
def get_job(job_id: UUID):
    job = JOBS.get(str(job_id))
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatusResponse(**job.__dict__)
