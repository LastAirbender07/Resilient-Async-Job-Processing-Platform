# Backend — Job Model

This document describes the `Job` domain model — the central aggregate in this system. Every piece of state, every transition, and every field is documented here so that "future you" can understand the shape of data without tracing through the ORM.

---

## Domain Model Fields

Defined in `app/models/job.py` (domain layer) and `app/db/models/job.py` (ORM layer).

| Field              | Type                | Notes                                                                                                    |
| ------------------ | ------------------- | -------------------------------------------------------------------------------------------------------- |
| `job_id`           | UUID                | Auto-generated primary key                                                                               |
| `job_type`         | `JobType` enum      | What processor will handle this job                                                                      |
| `status`           | `JobStatus` enum    | Current state in the lifecycle                                                                           |
| `input_file_path`  | str                 | Object key in the MinIO **input** bucket (e.g. `my_data.csv`)                                            |
| `output_file_path` | str (nullable)      | Object key in the MinIO **output** bucket; set only on `COMPLETED` (e.g. `outputs/{job_id}/result.json`) |
| `input_metadata`   | dict (JSONB)        | Processor-specific config (delimiter, column names, flags)                                               |
| `retry_count`      | int                 | How many times this job has been retried                                                                 |
| `max_retries`      | int                 | Maximum allowed retries (caller-specified, default 3)                                                    |
| `error_message`    | str (nullable)      | Last error string if `FAILED` or `DEAD`                                                                  |
| `context`          | dict (JSONB)        | Caller-provided metadata: `user_id`, `email`                                                             |
| `notifications`    | dict (JSONB)        | Notification config: which events trigger email                                                          |
| `next_run_at`      | datetime (nullable) | When the job will be eligible for retry pickup                                                           |
| `finished_at`      | datetime (nullable) | Timestamp when terminal state was reached                                                                |
| `created_at`       | datetime            | Set at insert                                                                                            |
| `updated_at`       | datetime            | Updated on every status transition                                                                       |

---

## Job Status State Machine

```
CREATED → QUEUED → PROCESSING → COMPLETED
                             ↘
                              FAILED → RETRYING → QUEUED (retry loop)
                                     ↘
                                      DEAD (retry_count >= max_retries)
```

### Who triggers each transition?

| From            | To           | Triggered by                   | When                                       |
| --------------- | ------------ | ------------------------------ | ------------------------------------------ |
| (new record)    | `CREATED`    | API (`create_job`)             | Job record inserted                        |
| `CREATED`       | `QUEUED`     | API (immediately after create) | Enqueued into Redis queue                  |
| `QUEUED`        | `PROCESSING` | Worker (`claim_next_job`)      | Worker picks up the job                    |
| `PROCESSING`    | `COMPLETED`  | Worker (`mark_completed`)      | Processor succeeded, output saved          |
| `PROCESSING`    | `FAILED`     | Worker (`handle_failure`)      | Processor raised an exception              |
| `FAILED`        | `RETRYING`   | Worker or API (`/retry`)       | Retry attempt initiated                    |
| `RETRYING`      | `QUEUED`     | Worker or API                  | Back in queue with `next_run_at` delay     |
| `FAILED`/`DEAD` | `RETRYING`   | API (`/jobs/{id}/retry`)       | Manual retry from frontend                 |
| Any             | `DEAD`       | Worker (`handle_failure`)      | `retry_count >= max_retries` after failure |

**Idempotency:** All transitions go through `repo._transition()` which validates the current state before updating. Calling `mark_completed` on an already-`COMPLETED` job raises a `ValueError`.

---

## Retry Back-off Strategy

When a job fails, the worker calls `job.compute_next_run_at()`, which computes an exponential back-off:

```
next_run_at = now + 2^retry_count seconds
```

Example:
- Retry 1 → wait 2 s
- Retry 2 → wait 4 s
- Retry 3 → wait 8 s

The worker only picks up jobs where `next_run_at` is `null` or in the past.

---

## Input Metadata per Job Type

The `input_metadata` field carries processor-specific configuration. It is validated by `app/core/job_factory.py` at job creation time.

| Job Type            | Typical metadata keys                                     |
| ------------------- | --------------------------------------------------------- |
| `TEST_JOB`          | (none)                                                    |
| `CSV_ROW_COUNT`     | `delimiter`, `has_header`                                 |
| `CSV_COLUMN_STATS`  | `delimiter`, `has_header`, `columns`                      |
| `CSV_DEDUPLICATE`   | `delimiter`, `has_header`, `subset` (columns to dedup on) |
| `JSON_CANONICALIZE` | (none)                                                    |

Unknown keys are ignored; missing required keys default to sensible values inside each processor.

---

## Notifications & Context

These two JSONB columns were added to support per-job email notifications without a separate users or notifications table.

**Context** — who triggered the job:
```json
{
  "user_id": "user-abc-123",
  "email": "user@example.com"
}
```

**Notifications** — what events send email:
```json
{
  "email": {
    "enabled": true,
    "on": ["FAILURE", "SUCCESS"]
  }
}
```

Both are optional and default to `{}` if omitted. The platform never validates `user_id` ownership; it is purely opaque metadata passed through by the caller.

---

## Database Migration (Alembic)

Schema changes are tracked via `alembic/versions/`. To apply migrations:

```bash
# Enter the running backend container
docker compose exec backend bash

# Check current head
alembic current

# Apply all pending migrations
alembic upgrade head
```

To create a new migration after changing the DB model:

```bash
alembic revision --autogenerate -m "add notification columns"
alembic upgrade head
```

**Important:** Always commit the generated migration file (`alembic/versions/*.py`) to Git. The `entrypoint.sh` runs `alembic upgrade head` automatically on pod startup in Kubernetes.

See `docs/backend/apply-alembic.md` for a step-by-step example session.
