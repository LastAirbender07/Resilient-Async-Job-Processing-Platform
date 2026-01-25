import csv
from app.processors.base import JobProcessor

class CsvRowCountProcessor(JobProcessor):
    def process(self, job_input: dict) -> dict:
        file_path = job_input["input_file_path"]
        metadata = job_input["input_metadata"]

        count = 0
        with open(file_path, newline="") as f:
            reader = csv.reader(f)
            for _ in reader:
                count += 1

        return {
            "rows": count,
            "message": "Job executed",
            "file_path": file_path,
            "metadata": metadata,

        }
