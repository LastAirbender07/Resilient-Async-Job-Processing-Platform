import json
from pathlib import Path
from uuid import UUID

BASE_DIR = Path("/tmp/job_outputs")

def store_result(job_id: UUID, result: dict) -> str:
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    path = BASE_DIR / f"{job_id}.json"

    with open(path, "w") as f:
        json.dump(result, f, indent=2)

    return str(path)
