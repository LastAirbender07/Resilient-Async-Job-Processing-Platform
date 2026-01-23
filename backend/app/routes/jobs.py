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
            status=JobStatus.CREATED,
            retry_count=0,
        )

        # Persist job
        job = repo.create_job(job)

        logger.info(
            "Job created",
            extra={"job_id": str(job.job_id)},
        )

        # Transition to QUEUED - initial state after creation
        # need separate “enqueue” step to allow for future queuing logic
        job = repo._transition(job.job_id, JobStatus.QUEUED)

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
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    except Exception as e:
        logger.exception(
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
        next_run_at=job.next_run_at,
        finished_at=job.finished_at,
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
                next_run_at=job.next_run_at,
                finished_at=job.finished_at,
            )

            for job in jobs
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/{job_id}/retry",
    response_model=JobStatusResponse,
)
def retry_job(
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

    if job.status not in {JobStatus.FAILED, JobStatus.DEAD}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Job in state {job.status} cannot be retried",
        )

    if job.retry_count >= job.max_retries:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Job exceeded maximum retries",
        )

    # retry
    next_run_at = job.compute_next_run_at()
    job = repo._transition(
        job.job_id,
        JobStatus.RETRYING,
        next_run_at=next_run_at,
    )

    # Immediately enqueue
    job = repo._transition(job.job_id, JobStatus.QUEUED)

    logger.info(
        "Job manually retried",
        extra={"job_id": str(job.job_id)},
    )

    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        retry_count=job.retry_count,
        max_retries=job.max_retries,
        error_message=job.error_message,
        created_at=job.created_at,
        updated_at=job.updated_at,
        next_run_at=job.next_run_at,
        finished_at=job.finished_at,
    )

