import csv
from collections import defaultdict
from app.processors.base import JobProcessor

class CsvColumnStatsProcessor(JobProcessor):
    def process(self, job_input: dict) -> dict:
        file_path = job_input["input_file_path"]
        metadata = job_input["input_metadata"]

        stats = defaultdict(list)

        with open(file_path, newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                for k, v in row.items():
                    try:
                        stats[k].append(float(v))
                    except (ValueError, TypeError):
                        pass

        result = {}
        for col, values in stats.items():
            if not values:
                continue
            result[col] = {
                "min": min(values),
                "max": max(values),
                "avg": sum(values) / len(values),
                "message": "Job executed",
                "file_path": file_path,
                "metadata": metadata,
            }

        return result
