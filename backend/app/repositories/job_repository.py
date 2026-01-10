from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, NoResultFound

from app.models.job import Job
from app.db.models.job import JobORM
from app.schemas.job_status import JobStatus
from app.repositories.mappers import orm_to_domain, domain_to_orm


class JobRepository:
    def __init__(self, db: Session):
        self.db = db


    def create_job(self, job: Job) -> Job:
        if job.status != JobStatus.CREATED:
            raise ValueError("Jobs must start in CREATED state")
        
        orm = domain_to_orm(job)
        self.db.add(orm)
        self.db.commit()
        self.db.refresh(orm)
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
            raise ValueError(f"Job {job_id} not found")
        
        domain = orm_to_domain(orm)

        if domain.status == new_status:
            return domain
        
        domain.transition(new_status, error_message=error_message)

        # ---- APPLY DOMAIN → ORM ----
        orm.status = domain.status
        orm.retry_count = domain.retry_count
        orm.error_message = domain.error_message
        orm.output_file_path = output_file_path

        try:
            self.db.commit()
        except IntegrityError:
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
        return [orm_to_domain(orm) for orm in orms]
    
    
    def count_jobs(self, user_id: str) -> int:
        return (
            self.db.query(JobORM)
            .filter(JobORM.user_id == user_id)
            .count()
        )
    

    def mark_queued(self, job_id) -> Job:
        return self._transition(job_id, JobStatus.QUEUED)
    

    def mark_processing(self, job_id) -> Job:
        return self._transition(job_id, JobStatus.PROCESSING)
    
    
    def mark_failed(self, job_id, error_message: str) -> Job:
        return self._transition(
            job_id,
            JobStatus.FAILED,
            error_message=error_message,
        )
    

    def mark_completed(self, job_id, output_file_path: str) -> Job:
        return self._transition(
            job_id,
            JobStatus.COMPLETED,
            output_file_path=output_file_path,
        )
    
