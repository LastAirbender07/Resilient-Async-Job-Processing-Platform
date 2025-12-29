from sqlalchemy.orm import Session
from app.models.job import Job
from app.db.models.job import JobORM
from app.repositories.mappers import orm_to_domain, domain_to_orm


class JobRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_job(self, job: Job) -> Job:
        orm = domain_to_orm(job)
        self.db.add(orm)
        self.db.commit()
        self.db.refresh(orm)
        return orm_to_domain(orm)

    def get_job_by_id(self, job_id) -> Job | None:
        orm = (
            self.db.query(JobORM)
            .filter(JobORM.job_id == job_id)
            .one_or_none()
        )
        return orm_to_domain(orm) if orm else None

    def update_job(self, job: Job) -> Job:
        orm = (
            self.db.query(JobORM)
            .filter(JobORM.job_id == job.job_id)
            .one()
        )

        orm.status = job.status
        orm.retry_count = job.retry_count
        orm.error_message = job.error_message
        orm.output_file_path = job.output_file_path

        self.db.commit()
        self.db.refresh(orm)
        return orm_to_domain(orm)

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
