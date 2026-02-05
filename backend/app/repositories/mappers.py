from app.models.job import Job
from app.db.models.job import JobORM


def orm_to_domain(orm: JobORM) -> Job:
    return Job(
        job_id=orm.job_id,
        status=orm.status,

        job_type=orm.job_type,
        input_metadata=orm.input_metadata,

        input_file_path=orm.input_file_path,
        output_file_path=orm.output_file_path,

        retry_count=orm.retry_count,
        max_retries=orm.max_retries,
        error_message=orm.error_message,

        context=orm.context or {},
        notifications=orm.notifications or {},

        created_at=orm.created_at,
        updated_at=orm.updated_at,
        next_run_at=orm.next_run_at,
        finished_at=orm.finished_at,
    )


def domain_to_orm(job: Job) -> JobORM:
    return JobORM(
        job_id=job.job_id,
        status=job.status,

        job_type=job.job_type,
        input_metadata=job.input_metadata,

        input_file_path=job.input_file_path,
        output_file_path=job.output_file_path,

        retry_count=job.retry_count,
        max_retries=job.max_retries,
        error_message=job.error_message,

        context=job.context,
        notifications=job.notifications,

        next_run_at=job.next_run_at,
        finished_at=job.finished_at,
    )

