from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    Enum,
    Text,
    Index,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base
from app.schemas.job_status import JobStatus
import uuid


class JobORM(Base):
    __tablename__ = "jobs"

    __table_args__ = (
        # --- CHECK CONSTRAINTS ---
        CheckConstraint(
            "retry_count >= 0",
            name="ck_jobs_retry_count_non_negative",
        ),
        CheckConstraint(
            "max_retries >= 0",
            name="ck_jobs_max_retries_non_negative",
        ),
        CheckConstraint(
            "retry_count <= max_retries",
            name="ck_jobs_retry_count_lte_max_retries",
        ),

        # --- INDEXES ---
        Index(
            "ix_jobs_status",
            "status",
        ),
        Index(
            "ix_jobs_status_created_at",
            "status",
            "created_at",
        ),
        Index(
            "ix_jobs_user_id_created_at",
            "user_id",
            "created_at",
        ),
    )

    job_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(String, nullable=False)

    status = Column(
        Enum(JobStatus, name="job_status"),
        nullable=False,
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
