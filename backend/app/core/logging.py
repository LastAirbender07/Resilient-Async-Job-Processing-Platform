import logging
import sys
from datetime import timezone
import json
from datetime import datetime

class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_record = {
            "timestamp": datetime.now(timezone.utc).isoformat(timespec="milliseconds") + "Z",
            "level": record.levelname,
            "service": "backend-api",
            "logger": record.name,
            "message": record.getMessage(),
        }

        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)

        if hasattr(record, "job_id"):
            log_record["job_id"] = record.job_id

        if hasattr(record, "request_id"):
            log_record["request_id"] = record.request_id

        return json.dumps(log_record)


def setup_logging() -> logging.Logger:
    logger = logging.getLogger("resilient-platform")
    
    if logger.handlers:
        return logger  

    logger.setLevel(logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    logger.handlers.clear()
    logger.addHandler(handler)
    logger.propagate = False

    return logger
