import csv
from app.processors.base import JobProcessor
from app.core.logging import setup_logging

logger = setup_logging()

class CsvDeduplicateProcessor(JobProcessor):
    def process(self, job_input: dict) -> dict:
        file_path = job_input.get("input_file_path")
        metadata = job_input.get("input_metadata") or {}

        key = metadata.get("key")
        if not key:
            logger.error("CsvDeduplicateProcessor missing required metadata 'key' for deduplication")
            raise ValueError("Missing required metadata field 'key' for deduplication")

        seen = set()
        rows = []
        total_rows = 0

        try:
            with open(file_path, newline="") as f:
                reader = csv.DictReader(f)
                if not reader.fieldnames:
                    logger.error("CSV file '%s' appears to have no header row", file_path)
                    raise ValueError("CSV file does not contain a header row")

                if key not in reader.fieldnames:
                    logger.error("Deduplication key '%s' not found in CSV header: %s", key, reader.fieldnames)
                    raise ValueError(f"Deduplication key '{key}' not found in CSV header")

                for row in reader:
                    total_rows += 1
                    value = row.get(key)
                    if value not in seen:
                        seen.add(value)
                        rows.append(row)
                        
        except FileNotFoundError:
            logger.exception("CSV file not found: %s", file_path)
            raise
        except OSError:
            logger.exception("Error reading CSV file: %s", file_path)
            raise

        duplicates_removed = total_rows - len(rows)

        return {
            "deduplicated_rows": len(rows),
            "duplicates_removed": duplicates_removed,
            "message": "Job executed successfully",
            "file_path": file_path,
            "metadata": metadata,
        }
