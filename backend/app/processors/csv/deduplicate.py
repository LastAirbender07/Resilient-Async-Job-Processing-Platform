import csv
from app.processors.base import JobProcessor

class CsvDeduplicateProcessor(JobProcessor):
    def process(self, job_input: dict) -> dict:
        file_path = job_input["file_path"]
        key = job_input["key"]

        seen = set()
        rows = []

        with open(file_path, newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                value = row.get(key)
                if value not in seen:
                    seen.add(value)
                    rows.append(row)

        return {
            "deduplicated_rows": len(rows),
            "duplicates_removed": None  # optional metric
        }
