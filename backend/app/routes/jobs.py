from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from uuid import UUID

from app.schemas.job import (
    JobCreateRequest,
    JobCreateResponse,
    JobStatusResponse,
    JobListResponse,
)
from app.schemas.job_status import JobStatus
from app.models.job import Job
from app.repositories.job_repository import JobRepository
from app.db.session import get_db
from app.core.logging import setup_logging

router = APIRouter(prefix="/jobs", tags=["Jobs"])
logger = setup_logging()


@router.post(
    "",
    response_model=JobCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_job(
    request: JobCreateRequest,
    db: Session = Depends(get_db),
):
    try:
        repo = JobRepository(db)

        # Create domain job
        job = Job(
            user_id="dummy-user",  # placeholder until auth is added
            input_file_path=request.input_file_path,
            max_retries=request.max_retries,
        )

        # Initial lifecycle transition
        job.transition(JobStatus.QUEUED)

        # Persist job
        job = repo.create_job(job)

        logger.info(
            "Job created",
            extra={"job_id": str(job.job_id)},
        )

        return JobCreateResponse(
            job_id=job.job_id,
            status=job.status,
        )

    except ValueError as e:
        # Domain errors (invalid state transitions, etc.)
        logger.warning(
            "Invalid job creation request",
            extra={"error": str(e)},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except Exception as e:
        logger.error(
            "Failed to create job",
            extra={"error": str(e)},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal Server Error",
        )


@router.get(
    "/{job_id}",
    response_model=JobStatusResponse,
)
def get_job(
    job_id: UUID,
    db: Session = Depends(get_db),
):
    repo = JobRepository(db)

    job = repo.get_job_by_id(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        retry_count=job.retry_count,
        max_retries=job.max_retries,
        error_message=job.error_message,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )

@router.get("",response_model=JobListResponse,)
def list_jobs(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    repo = JobRepository(db)

    user_id = "dummy-user"  # placeholder until auth is added

    jobs = repo.list_jobs(user_id=user_id, limit=limit, offset=offset)
    total = repo.count_jobs(user_id=user_id)

    return JobListResponse(
        items=[
            JobStatusResponse(
                job_id=job.job_id,
                status=job.status,
                retry_count=job.retry_count,
                max_retries=job.max_retries,
                error_message=job.error_message,
                created_at=job.created_at,
                updated_at=job.updated_at,
            )
            for job in jobs
        ],
        total=total,
        limit=limit,
        offset=offset,
    )
