from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, NoResultFound, IntegrityError

from app.models.job import Job
from app.db.models.job import JobORM
from app.schemas.job_status import JobStatus
from app.repositories.mappers import orm_to_domain, domain_to_orm

from app.core.logging import setup_logging
logger = setup_logging()


class JobRepository:
    def __init__(self, db: Session):
        self.db = db


    def create_job(self, job: Job) -> Job:
        if job.status != JobStatus.CREATED:
            raise ValueError("Jobs must start in CREATED state")
        
        if job.max_retries is None or job.max_retries < 0:
            raise ValueError("max_retries must be >= 0")
        
        orm = domain_to_orm(job)
        self.db.add(orm)

        try:
            self.db.commit()
        except IntegrityError as e:
            logger.exception("Failed to create job due to integrity error")
            self.db.rollback()
            raise ValueError("Job creation failed due to integrity error") from e
        
        self.db.refresh(orm)

        logger.info(f"Created job {orm.job_id} for user {orm.user_id}")
        return orm_to_domain(orm)
    
    
    def _transition(
        self,
        job_id,
        new_status: JobStatus,
        *,
        error_message: str | None = None,
        output_file_path: str | None = None,
    ) -> Job:
        try:
            orm = (
                self.db.query(JobORM)
                .filter(JobORM.job_id == job_id)
                .one()
            )
        except NoResultFound:
            logger.exception(f"Job {job_id} not found for transition to {new_status}")
            raise ValueError(f"Job {job_id} not found")
        
        domain = orm_to_domain(orm)

        if domain.status == new_status:
            logger.info(f"Job {job_id} already in status {new_status}, no transition needed")
            return domain
        
        domain.transition(new_status, error_message=error_message)
        logger.info(f"Transitioned job {job_id} to {new_status}")

        # ---- APPLY DOMAIN → ORM ----
        orm.status = domain.status
        orm.retry_count = domain.retry_count
        orm.error_message = domain.error_message
        orm.output_file_path = output_file_path

        try:
            logger.debug(f"Committing transition of job {job_id} to {new_status}")
            self.db.commit()
            logger.debug(f"Committed transition of job {job_id} to {new_status}")
        except IntegrityError:
            logger.exception(f"Failed to transition job {job_id} to {new_status}")
            self.db.rollback()
            raise

        self.db.refresh(orm)
        return orm_to_domain(orm)


    def get_job_by_id(self, job_id) -> Job | None:
        orm = (
            self.db.query(JobORM)
            .filter(JobORM.job_id == job_id)
            .one_or_none()
        )
        logger.debug(f"Fetched job {job_id}: {'found' if orm else 'not found'}")
        return orm_to_domain(orm) if orm else None
    

    def list_jobs(self, user_id: str, limit: int = 20, offset: int = 0):
        orms = (
            self.db.query(JobORM)
            .filter(JobORM.user_id == user_id)
            .order_by(JobORM.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        logger.debug(f"Listed jobs for user {user_id}, count: {len(orms)}")
        return [orm_to_domain(orm) for orm in orms]
    
    
    def count_jobs(self, user_id: str) -> int:
        logger.debug(f"Counting jobs for user {user_id}")
        return (
            self.db.query(JobORM)
            .filter(JobORM.user_id == user_id)
            .count()
        )
    

    def mark_queued(self, job_id) -> Job:
        logger.debug(f"Marking job {job_id} as QUEUED")
        return self._transition(job_id, JobStatus.QUEUED)
    

    def mark_processing(self, job_id) -> Job:
        logger.debug(f"Marking job {job_id} as PROCESSING")
        return self._transition(job_id, JobStatus.PROCESSING)
    
    
    def mark_failed(self, job_id, error_message: str) -> Job:
        logger.debug(f"Marking job {job_id} as FAILED with error: {error_message}")
        return self._transition(
            job_id,
            JobStatus.FAILED,
            error_message=error_message,
        )
    

    def mark_completed(self, job_id, output_file_path: str) -> Job:
        logger.debug(f"Marking job {job_id} as COMPLETED with output file: {output_file_path}")
        return self._transition(
            job_id,
            JobStatus.COMPLETED,
            output_file_path=output_file_path,
        )
    

    def claim_next_job(self) -> Job | None:
        orm = (
            self.db.query(JobORM)
            .filter(JobORM.status == JobStatus.QUEUED)
            .order_by(JobORM.created_at)
            .with_for_update(skip_locked=True)
            .first()
        )

        if not orm:
            logger.debug("No QUEUED jobs available to claim")
            return None

        domain = orm_to_domain(orm)
        domain.transition(JobStatus.PROCESSING)

        orm.status = domain.status
        orm.updated_at = domain.updated_at

        self.db.commit()
        self.db.refresh(orm)

        logger.info(f"Claimed job {orm.job_id} for processing")

        return orm_to_domain(orm)


