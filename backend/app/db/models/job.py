from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    Enum,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base
from app.schemas.job_status import JobStatus
import uuid


class JobORM(Base):
    __tablename__ = "jobs"

    job_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(String, nullable=False)

    status = Column(
        Enum(JobStatus, name="job_status"),
        nullable=False,
        index=True,
    )

    input_file_path = Column(String, nullable=False)
    output_file_path = Column(String)

    retry_count = Column(Integer, nullable=False, default=0)
    max_retries = Column(Integer, nullable=False)

    error_message = Column(Text)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
