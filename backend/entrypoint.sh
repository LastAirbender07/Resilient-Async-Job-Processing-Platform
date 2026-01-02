#!/bin/sh
set -e

echo "Waiting for Postgres..."
while ! nc -z postgres-service 5432; do
  sleep 1
done

echo "Running database migrations..."
alembic upgrade head

echo "Starting application..."
exec "$@"
