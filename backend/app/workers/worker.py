import time
from app.db.session import SessionLocal
from app.repositories.job_repository import JobRepository

from app.core.logging import setup_logging

logger = setup_logging()

POLL_INTERVAL_SECONDS = 1

def run_worker():
    while True:
        db = SessionLocal()
        try:
            repo = JobRepository(db)

            job = repo.claim_next_job()
            if not job:
                logger.debug("No jobs to process, sleeping...")
                time.sleep(POLL_INTERVAL_SECONDS)
                continue

            logger.info(f"Processing job {job.job_id} for user {job.user_id}")

            process_job(job, repo)

        finally:
            db.close()

# ntentionally dumb for now.
def process_job(job, repo: JobRepository):
    try:
        # Simulate work
        time.sleep(2)

        # Fake output
        output_path = f"/tmp/output/{job.job_id}.txt"
        repo.mark_completed(job.job_id, output_path)

        logger.info(f"Completed job {job.job_id}, output at {output_path}")

    except Exception as e:
        repo.mark_failed(job.job_id, str(e))
        logger.exception(f"Failed to process job {job.job_id}: {e}")


if __name__ == "__main__":
    run_worker()
