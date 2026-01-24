import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- PostgreSQL ---
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "notifications")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "postgres-service")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")

    # --- Redis ---
    REDIS_HOST: str = os.getenv("REDIS_HOST", "redis-service")
    REDIS_PORT: str = os.getenv("REDIS_PORT", "6379")
    REDIS_DB: int = int(os.getenv("REDIS_DB", 0))

    # RQ_QUEUE: str = os.getenv("RQ_QUEUE", "default")
    # RQ_RETRIES: int = int(os.getenv("RQ_RETRIES", 3))

    # --- Computed properties ---
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        # default: postgresql://postgres:postgres@postgres-service:5432/notifications
        
    @property
    def REDIS_URL(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()