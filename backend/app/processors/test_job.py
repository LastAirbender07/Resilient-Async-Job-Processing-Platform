import time
from app.processors.base import JobProcessor

class TestJobProcessor(JobProcessor):
    def process(self, job_input: dict) -> dict:
        file_path = job_input["file_path"]
        time.sleep(2)

        return {
            "ping": "pong"
        }