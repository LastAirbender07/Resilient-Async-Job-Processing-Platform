from app.models.job import Job
from app.db.models.job import JobORM


def orm_to_domain(orm: JobORM) -> Job:
    return Job(
        job_id=orm.job_id,
        user_id=orm.user_id,
        status=orm.status,
        input_file_path=orm.input_file_path,
        output_file_path=orm.output_file_path,
        retry_count=orm.retry_count,
        max_retries=orm.max_retries,
        error_message=orm.error_message,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
    )


def domain_to_orm(job: Job) -> JobORM:
    return JobORM(
        job_id=job.job_id,
        user_id=job.user_id,
        status=job.status,
        input_file_path=job.input_file_path,
        output_file_path=job.output_file_path,
        retry_count=job.retry_count,
        max_retries=job.max_retries,
        error_message=job.error_message,
    )
