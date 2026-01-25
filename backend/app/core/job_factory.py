from app.schemas.job_type import JobType

def build_input_metadata(job_type: JobType, path: str) -> dict:
    """
    Build system-owned input metadata based on job type.
    This metadata is trusted by workers and MUST be deterministic.
    """

    if job_type in {
        JobType.CSV_ROW_COUNT,
        JobType.CSV_COLUMN_STATS,
        JobType.CSV_DEDUPLICATE,
    }:
        return {
            "file_format": "CSV",
            "delimiter": ",",
            "has_header": True,
            "source_path": path,
        }

    if job_type == JobType.JSON_CANONICALIZE:
        return {
            "file_format": "JSON",
            "canonical": True,
            "source_path": path,
        }

    if job_type == JobType.TEST_JOB:
        return {
            "file_format": "NONE",
            "test": True,
        }

    raise ValueError(f"Unsupported job type: {job_type}")