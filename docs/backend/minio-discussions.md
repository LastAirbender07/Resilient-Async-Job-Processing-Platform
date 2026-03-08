# Backend — MinIO Integration

> **Status: Implemented.** This document describes the final, working MinIO integration — not the planning that led to it. For historical context, see the original planning notes preserved at the bottom.

---

## Overview

MinIO is the object storage layer for this platform. It plays two roles:

| Role               | Bucket                                   | Used by                                    |
| ------------------ | ---------------------------------------- | ------------------------------------------ |
| **Input storage**  | `resilient-async-job-processing-inputs`  | Frontend (upload) + Worker (download)      |
| **Output storage** | `resilient-async-job-processing-outputs` | Worker (upload) + Frontend (stream result) |

The browser **never talks to MinIO directly.** All MinIO access goes through either:
- The Next.js API routes (`/api/minio-upload`, `/api/result`) — for browser uploads/downloads
- The backend Python `StorageClient` — for the worker's file I/O

---

## Why Not Presigned URLs?

The initial plan was to use MinIO presigned URLs so the browser could upload directly to MinIO. This failed because:

> Presigned URLs contain the MinIO cluster DNS name (e.g. `resilient-platform-minio-service:9000`). The browser in your laptop cannot resolve this Kubernetes-internal DNS name. No NodePort or LoadBalancer was added for MinIO, by design (keep MinIO internal for security).

**Solution:** Server-side streaming proxy in Next.js.

```
Browser  →  PUT /api/minio-upload?filename=data.csv
                  │   (XHR with real progress events)
                  ▼
            Next.js server  →  client.putObject(bucket, key, stream)
                                    │  (cluster DNS works server-side)
                                    ▼
                                 MinIO
```

Key properties:
- The file is **streamed**, not buffered in RAM — a 400 MB CSV passes through without loading into Node.js memory
- Real XHR `progress` events work (browser ↔ Next.js)
- MinIO remains internal-only — no exposure

---

## Object Key Scheme

```
inputs/
  {filename}                  ← uploaded directly as-is (e.g. data.csv, test.json)

outputs/
  {job_id}/
    result.json               ← worker output, always JSON
```

The worker constructs the output key as: `outputs/{job_id}/result.json`.  
The frontend's `/api/result?key=outputs/...` route fetches and streams it back to the browser.

---

## StorageClient API (`app/core/storage.py`)

```python
class StorageClient:
    def object_exists(bucket: str, object_key: str) -> bool
    def download_file(bucket: str, object_key: str, local_path: str)
    def upload_file(local_path: str, bucket: str, object_key: str, content_type: str)
    def list_objects(bucket: str, prefix: str = "") -> list[str]
    def delete_object(bucket: str, object_key: str)
```

The client is instantiated fresh per route call or worker invocation — no singleton at module level (avoids connection issues on container restart).

---

## Bucket Initialization

Buckets are created on first startup by an **init container** in the Helm chart (`create-buckets` job). In local Docker Compose, this is handled by the `create-buckets` service.

```yaml
# Helm chart init container equivalent (docker-compose)
mc mb myminio/resilient-async-job-processing-inputs
mc mb myminio/resilient-async-job-processing-outputs
mc cp /seed/test.json myminio/resilient-async-job-processing-inputs/test.json
```

`test.json` is pre-seeded so users can test the system without uploading a file.

---

## Configuration

| Variable           | Default                                  | Notes                                       |
| ------------------ | ---------------------------------------- | ------------------------------------------- |
| `S3_HOST`          | `minio`                                  | Service name in Docker Compose / Kubernetes |
| `S3_PORT`          | `9000`                                   | S3 API port                                 |
| `S3_USE_SSL`       | `false`                                  | Set `true` for HTTPS                        |
| `S3_ACCESS_KEY`    | `minioadmin`                             | **Change in production**                    |
| `S3_SECRET_KEY`    | `minioadmin`                             | **Change in production**                    |
| `S3_INPUT_BUCKET`  | `resilient-async-job-processing-inputs`  |                                             |
| `S3_OUTPUT_BUCKET` | `resilient-async-job-processing-outputs` |                                             |

---

## MinIO Console Access (Local Dev)

```bash
# Port-forward MinIO Console UI
kubectl port-forward svc/resilient-platform-minio-service 9001:9001 -n resilient-platform

# OR for Docker Compose
docker compose exec minio sh
mc alias set local http://localhost:9000 minioadmin minioadmin
mc ls local/resilient-async-job-processing-inputs
```

Open `http://localhost:9001` → login with `minioadmin / minioadmin`.

---

## Production Considerations

| Concern                  | Current State                   | Production Fix                                         |
| ------------------------ | ------------------------------- | ------------------------------------------------------ |
| Credentials in ConfigMap | Plain text `minioadmin`         | Move to Kubernetes `Secret` with `secretKeyRef`        |
| No HTTPS                 | `S3_USE_SSL=false`              | Enable TLS + valid cert on MinIO                       |
| Single-node MinIO        | No HA                           | Switch to MinIO distributed mode or AWS S3             |
| No lifecycle policies    | Objects accumulate indefinitely | Add MinIO lifecycle rules to expire old inputs/outputs |
| Worker writes to /tmp    | Temp files not cleaned up       | Add cleanup step in worker after upload, or use tmpfs  |
