from app.schemas.job_type import JobType

def build_input_metadata(job_type: JobType, path: str, custom_metadata: dict) -> dict:
    """
    Build system-owned input metadata based on job type.
    This metadata is trusted by workers and MUST be deterministic.
    """

    if job_type in {
        JobType.CSV_ROW_COUNT,
        JobType.CSV_COLUMN_STATS,
        JobType.CSV_DEDUPLICATE,
    }:
        system_metadata = {
            "file_format": "CSV",
            "delimiter": ",",
            "has_header": True,
            "source_path": path,
        }
        merged = dict(custom_metadata or {})
        merged.update(system_metadata)
        return merged

    if job_type == JobType.JSON_CANONICALIZE:
        system_metadata = {
            "file_format": "JSON",
            "canonical": True,
            "source_path": path,
        }
        merged = dict(custom_metadata or {})
        merged.update(system_metadata)
        return merged

    if job_type == JobType.TEST_JOB:
        system_metadata = {
            "file_format": "NONE",
            "test": True,
        }
        merged = dict(custom_metadata or {})
        merged.update(system_metadata)
        return merged

    raise ValueError(f"Unsupported job type: {job_type}")