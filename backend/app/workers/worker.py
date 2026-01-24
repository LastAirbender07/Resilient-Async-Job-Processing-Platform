import time
from app.db.session import SessionLocal
from app.queues.job_queue import JobQueue
from app.repositories.job_repository import JobRepository
from app.core.logging import setup_logging

logger = setup_logging()

POLL_INTERVAL_SECONDS = 1

def run_worker():
    queue = JobQueue()

    while True:
        # Block until signaled
        queue.dequeue(timeout=5)
        
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

        except Exception:
            # This should NEVER happen often; If it does, your worker logic is broken.
            logger.exception("Unhandled worker loop exception")
            time.sleep(2)

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
        logger.exception(f"Failed to process job {job.job_id}: {e}")
        repo.handle_failure(job_id=job.job_id, error_message=str(e))


if __name__ == "__main__":
    run_worker()
