from app.schemas.job_type import JobType

from app.processors.test_job import TestJobProcessor
from app.processors.csv.row_count import CsvRowCountProcessor
from app.processors.csv.column_stats import CsvColumnStatsProcessor
from app.processors.csv.deduplicate import CsvDeduplicateProcessor
from app.processors.json.canonicalize import JsonCanonicalizeProcessor

_PROCESSORS = {
    JobType.TEST_JOB: TestJobProcessor(),
    JobType.CSV_ROW_COUNT: CsvRowCountProcessor(),
    JobType.CSV_COLUMN_STATS: CsvColumnStatsProcessor(),
    JobType.CSV_DEDUPLICATE: CsvDeduplicateProcessor(),
    JobType.JSON_CANONICALIZE: JsonCanonicalizeProcessor(),
}

def get_processor(job_type: JobType):
    try:
        return _PROCESSORS[job_type]
    except KeyError:
        raise ValueError(f"No processor registered for {job_type}")
