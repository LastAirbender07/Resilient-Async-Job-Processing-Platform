import redis
from uuid import UUID

from app.core.settings import settings
from app.core.logging import setup_logging

logger = setup_logging()


class JobQueue:
    def __init__(self):
        self.client = redis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
        )

    def enqueue(self, job_id: UUID):
        logger.info(f"Enqueuing job: {job_id} to the Redis Queue")
        self.client.lpush("job_queue", str(job_id))

    def dequeue(self, timeout: int = 5) -> UUID | None:
        result = self.client.brpop("job_queue", timeout=timeout)
        if not result:
            logger.info(f"No job in the Redis Queue")
            return None
        _, job_id = result
        logger.info(f"Dequeuing job: {job_id} from the Redis Queue")
        return UUID(job_id)
