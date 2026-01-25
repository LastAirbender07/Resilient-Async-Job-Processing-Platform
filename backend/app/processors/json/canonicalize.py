import json
from app.processors.base import JobProcessor

def canonicalize(obj):
    if isinstance(obj, dict) or isinstance(obj, list):
        return {k: canonicalize(obj[k]) for k in sorted(obj)}
    else:
        return obj

class JsonCanonicalizeProcessor(JobProcessor):
    def process(self, job_input: dict) -> dict:
        file_path = job_input["file_path"]

        with open(file_path) as f:
            data = json.load(f)

        canonical = canonicalize(data)

        return {
            "canonical_json": canonical
        }
