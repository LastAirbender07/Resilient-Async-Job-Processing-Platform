FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Avoid Python writing .pyc files and enable clean stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies required for Postgres and builds
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    build-essential \
    netcat-openbsd \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Copy only dependency files first for build cache efficiency
COPY pyproject.toml uv.lock* ./

# Install dependencies
# RUN uv sync --frozen --no-cache
RUN pip install --upgrade pip && pip install .

# Then copy rest of the app (improves layer cache)
COPY . .

EXPOSE 5001

# Default CMD
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001"]