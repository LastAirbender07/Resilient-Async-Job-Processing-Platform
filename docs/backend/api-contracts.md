Minimum endpoints:

1. `POST /jobs`
   * Accepts metadata + file reference
   * Returns `job_id`
2. `GET /jobs/{job_id}`
   * Returns job status + progress
3. `GET /jobs`
   * Lists user’s jobs (pagination)
4. `WS /jobs/{job_id}/events`
   * Real-time updates (later)

Define:

* request/response JSON
* error cases
* auth requirements (JWT bearer)
