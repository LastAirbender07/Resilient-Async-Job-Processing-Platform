# Backend — API Contracts

> **Framework:** FastAPI · **Base path:** `http://<host>:5001`  
> **Auto-generated OpenAPI docs:** `http://<host>:5001/docs`

All request/response bodies are JSON. The API is stateless — no session, no auth token (learning project scope).

---

## Endpoints

### `POST /jobs` — Create a Job

**Purpose:** Validate that the input file exists in MinIO, create the job record, immediately mark it `QUEUED`, and enqueue it for the worker.

**Request body:**

```json
{
  "job_type": "CSV_ROW_COUNT",
  "input_file_path": "my_data.csv",
  "input_metadata": { "delimiter": ",", "has_header": true },
  "max_retries": 3,
  "context": {
    "user_id": "user-123",
    "email": "user@example.com"
  },
  "notifications": {
    "email": {
      "enabled": true,
      "on": ["FAILURE"]
    }
  }
}
```

| Field                         | Type           | Required | Notes                                                                |
| ----------------------------- | -------------- | -------- | -------------------------------------------------------------------- |
| `job_type`                    | `JobType` enum | ✅        | Must be a registered type                                            |
| `input_file_path`             | string         | ✅        | Object key in the input MinIO bucket — file must already be uploaded |
| `input_metadata`              | dict           | ❌        | Processor-specific config; defaults to `{}`                          |
| `max_retries`                 | int (0–10)     | ❌        | Default `3`                                                          |
| `context.user_id`             | string         | ❌        | Opaque caller identifier                                             |
| `context.email`               | EmailStr       | ❌        | Recipient for job notifications                                      |
| `notifications.email.enabled` | bool           | ❌        | Default `true`                                                       |
| `notifications.email.on`      | list[JobEvent] | ❌        | Events that trigger email; default `["FAILURE"]`                     |

**Success response — `201 Created`:**

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "QUEUED"
}
```

**Error responses:**

| Status                      | When                                                       |
| --------------------------- | ---------------------------------------------------------- |
| `400 Bad Request`           | `input_file_path` key does not exist in MinIO              |
| `409 Conflict`              | Domain-level validation failure (duplicate, invalid state) |
| `503 Service Unavailable`   | MinIO unreachable at job-creation time                     |
| `500 Internal Server Error` | Unexpected error                                           |

---

### `GET /jobs/{job_id}` — Get a Single Job

**Purpose:** Retrieve the current state of a job by its UUID.

**Response — `200 OK`:**

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_type": "CSV_ROW_COUNT",
  "status": "COMPLETED",
  "retry_count": 0,
  "max_retries": 3,
  "error_message": null,
  "input_file_path": "my_data.csv",
  "output_file_path": "outputs/550e8400.../result.json",
  "created_at": "2025-01-01T10:00:00Z",
  "updated_at": "2025-01-01T10:00:05Z",
  "next_run_at": null,
  "finished_at": "2025-01-01T10:00:05Z"
}
```

**Error responses:** `404 Not Found` if `job_id` does not exist.

---

### `GET /jobs` — List All Jobs (Paginated)

**Purpose:** Return a paginated list of all jobs (no per-user filtering — global view, learning project scope).

**Query params:**

| Param    | Default | Range | Notes                        |
| -------- | ------- | ----- | ---------------------------- |
| `limit`  | `20`    | 1–100 | Page size                    |
| `offset` | `0`     | ≥0    | Offset into total result set |

**Response — `200 OK`:**

```json
{
  "items": [ /* array of JobStatusResponse */ ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

---

### `POST /jobs/{job_id}/retry` — Manually Retry a Job

**Purpose:** Move a `FAILED` or `DEAD` job back into the queue for re-processing.

**Rules:**
- Only `FAILED` or `DEAD` jobs can be retried
- `retry_count` must be < `max_retries`
- The job transitions: `FAILED → RETRYING → QUEUED`
- `next_run_at` is computed using exponential back-off

**Response:** Same `JobStatusResponse` shape as above, with `status: "QUEUED"`.

**Error responses:**

| Status          | When                                               |
| --------------- | -------------------------------------------------- |
| `404 Not Found` | Job not found                                      |
| `409 Conflict`  | Job not in a retryable state, or retries exhausted |

---

### `GET /health` — Health Check

**Purpose:** Liveness check. Always returns `200 OK` if the backend process is alive.

```json
{ "status": "ok" }
```

Used by the frontend's `useBackendHealth` hook (polls every 15 s).

---

### `GET /metrics` — Prometheus Metrics

**Purpose:** Exposes Prometheus-formatted metrics from the **backend** process.

Consumed by `kube-prometheus-stack` in the monitoring namespace via a `ServiceMonitor`.

---

## Job Types

All valid types are defined in `app/core/enums/job_type.py`:

| Enum value          | Description                                                  | Input format |
| ------------------- | ------------------------------------------------------------ | ------------ |
| `TEST_JOB`          | No-op test processor                                         | Any file     |
| `CSV_ROW_COUNT`     | Count rows in a CSV file                                     | `.csv`       |
| `CSV_COLUMN_STATS`  | Compute per-column statistics                                | `.csv`       |
| `CSV_DEDUPLICATE`   | Remove duplicate rows                                        | `.csv`       |
| `JSON_CANONICALIZE` | Sort JSON keys deterministically (eliminates git diff noise) | `.json`      |

---

## Job Status State Machine

Defined in `app/core/enums/job_status.py`:

```
CREATED → QUEUED → PROCESSING → COMPLETED
                             ↘ FAILED → RETRYING → QUEUED (retry loop)
                                      ↘ DEAD (retry_count >= max_retries)
```

| State        | Set by                         | Description                                  |
| ------------ | ------------------------------ | -------------------------------------------- |
| `CREATED`    | API (create_job)               | Job record created                           |
| `QUEUED`     | API (immediately after create) | Enqueued for worker                          |
| `PROCESSING` | Worker (`claim_next_job`)      | Worker is actively executing                 |
| `COMPLETED`  | Worker                         | Job succeeded; output stored in MinIO        |
| `FAILED`     | Worker                         | Job threw an exception; may be retried       |
| `RETRYING`   | Worker / API retry endpoint    | Transitional state before re-queue           |
| `DEAD`       | Worker                         | Exhausted max retries; no automatic recovery |

---

## Design Notes

- **Upload before create:** The frontend always uploads the file to MinIO *before* calling `POST /jobs`. The API validates the file exists before persisting the job — this prevents orphaned job records.
- **No WebSocket:** Real-time updates were planned but never implemented. The frontend polls `GET /jobs/{id}` every 2 seconds instead. This is sufficient for the current scale.
- **No auth:** All endpoints are unauthenticated. Adding JWT bearer auth would require an auth provider (Keycloak, Auth0) and a middleware layer in FastAPI.
