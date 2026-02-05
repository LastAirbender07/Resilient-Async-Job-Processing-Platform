import time
import json
from pathlib import Path
from app.db.session import SessionLocal
from app.queues.job_queue import JobQueue
from app.repositories.job_repository import JobRepository
from app.core.notifications.dispatcher import NotificationDispatcher
from app.core.notifications.events import JobEvent
from app.core.storage import StorageClient
from app.core.settings import settings
from app.processors.registry import get_processor
from app.core.logging import setup_logging

logger = setup_logging()
dispatcher = NotificationDispatcher()

POLL_INTERVAL_SECONDS = 1
TMP_DIR = Path("/tmp/jobs")


def prepare_workspace(job_id):
    path = TMP_DIR / str(job_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def fetch_input(job, storage: StorageClient, workspace: Path) -> Path:
    input_path = workspace / "input"

    storage.download_file(
        bucket=settings.S3_INPUT_BUCKET,
        object_key=job.input_file_path,
        local_path=str(input_path),
    )

    return input_path


def execute_processor(job, input_path: Path) -> dict:
    processor = get_processor(job.job_type)

    payload = {
        "job_id": str(job.job_id),
        "job_type": job.job_type,
        "input_file_path": str(input_path),
        "input_metadata": job.input_metadata or {},
    }

    return processor.process(payload)


def persist_output(job, result: dict, storage: StorageClient, workspace: Path) -> str:
    output_path = workspace / "output.json"

    with open(output_path, "w") as f:
        json.dump(result, f, indent=2)

    output_key = f"outputs/{job.job_id}/result.json"

    storage.upload_file(
        local_path=str(output_path),
        bucket=settings.S3_OUTPUT_BUCKET,
        object_key=output_key,
        content_type="application/json",
    )

    return output_key


def finalize_success(job, repo: JobRepository, output_key: str):
    job = repo.mark_completed(job.job_id, output_file_path=output_key)
    dispatcher.dispatch(job, JobEvent.SUCCESS)
    logger.info("Job completed", extra={"job_id": str(job.job_id)})


def finalize_failure(job, repo: JobRepository, error: Exception):
    logger.exception("Job failed", extra={"job_id": str(job.job_id)})
    job = repo.handle_failure(job.job_id, str(error))
    dispatcher.dispatch(job, JobEvent.FAILURE)


def handle_job(job, repo: JobRepository, storage: StorageClient):
    logger.info("Handling job", extra={"job_id": str(job.job_id)})

    try:
        workspace = prepare_workspace(job.job_id)
        input_path = fetch_input(job, storage, workspace)
        result = execute_processor(job, input_path)
        output_key = persist_output(job, result, storage, workspace)
        finalize_success(job, repo, output_key)

    except Exception as e:
        finalize_failure(job, repo, e)


def run_worker():
    queue = JobQueue()
    storage = StorageClient()

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

            logger.info(f"Processing job {job.job_id}")

            handle_job(job, repo, storage)

        except Exception:
            # This should NEVER happen often; If it does, your worker logic is broken.
            logger.exception("Unhandled worker loop exception")
            time.sleep(2)

        finally:
            db.close()



if __name__ == "__main__":
    run_worker()
