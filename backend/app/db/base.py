from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass

# Import all ORM models here so Alembic can discover them
from app.db.models.job import JobORM  # noqa: E402,F401