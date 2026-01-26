import json
from json import JSONDecodeError
from app.processors.base import JobProcessor

def canonicalize(obj):
    if isinstance(obj, dict):
        return {k: canonicalize(obj[k]) for k in sorted(obj)}
    elif isinstance(obj, list):
        return [canonicalize(item) for item in obj]
    else:
        return obj

class JsonCanonicalizeProcessor(JobProcessor):
    def process(self, job_input: dict) -> dict:
        file_path = job_input["input_file_path"]
        metadata = job_input["input_metadata"]

        if not file_path:
            raise ValueError("input_file_path is required")

        try:
            with open(file_path) as f:
                data = json.load(f)
        except JSONDecodeError as e:
            raise ValueError(f"Invalid JSON input file: {e}") from e

        canonical = canonicalize(data)

        return {
            "canonical_json": canonical,
            "message": "JSON canonicalization successful",
            "file_path": file_path,
            "metadata": metadata,
        }
