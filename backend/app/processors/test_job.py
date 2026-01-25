import time
from app.processors.base import JobProcessor

class TestJobProcessor(JobProcessor):
    def process(self, job_input: dict) -> dict:
        file_path = job_input["input_file_path"]
        metadata = job_input["input_metadata"]

        time.sleep(2)

        return {
            "ping": "pong",
            "message": "Test job executed",
            "file_path": file_path,
            "metadata": metadata,
        }