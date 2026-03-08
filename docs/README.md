# Documentation — Index

This folder contains all design and operational documentation for the **Resilient Async Job Processing Platform**. Use this as your starting point.

---

## Platform Architecture (Quick Reference)

```
Browser
  │
  ▼
Frontend (Next.js)             ← NodePort 30080 / localhost tunnel
  │  PUT /api/minio-upload      ← streams file to MinIO (server-side proxy)
  │  GET /api/result            ← streams output from MinIO
  │  POST/GET /api/backend/*    ← catch-all proxy to Backend API
  │
  ▼
Backend API (FastAPI :5001)
  │  POST /jobs                 ← creates job, validates file exists in MinIO
  │  GET /jobs, GET /jobs/{id}  ← read job state
  │  POST /jobs/{id}/retry      ← re-queue failed jobs
  │  GET /metrics               ← Prometheus scrape endpoint
  │
  ├──► PostgreSQL               ← (Sidecar: postgres-exporter :9187)
  ├──► Redis                    ← (Sidecar: redis-exporter :9121)
  └──► MinIO                    ← (Metrics: /minio/v2/metrics/cluster :9000)

Worker (Python :8000 metrics)
  │  Polls Redis queue
  ├──► Downloads input from MinIO
  ├──► Runs processor (CSV/JSON)
  └──► Uploads result to MinIO → marks job COMPLETED → sends notification email

─────────────────────────────────────────────────────────────────
Kubernetes Namespace: resilient-platform
  Istio mTLS: STRICT (All business traffic encrypted)
  Exceptions: Port-level PERMISSIVE (Allows Prometheus scraping of :5001, :8000, :15090, :9000, :9187, :9121)

Monitoring Namespace: monitoring
  Prometheus + Grafana + Alertmanager (Metrics & Dashboards)
  Loki + Promtail (Log Aggregation with Multi-tenancy)
```

---

## Documentation Map

### Frontend

| File                                        | Contents                                               |
| ------------------------------------------- | ------------------------------------------------------ |
| [overview.md](frontend/overview.md)         | What the frontend does, features, page structure       |
| [architecture.md](frontend/architecture.md) | Directory structure, hooks, data flow, API routes      |
| [development.md](frontend/development.md)   | Local setup, env vars, how to add job types/API routes |
| [deployment.md](frontend/deployment.md)     | Helm config, runtime env vars, CI/CD, health probes    |
| [concerns.md](frontend/concerns.md)         | Known limitations, trade-offs, future work             |

### Backend

| File                                                       | Contents                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [architecture.md](backend/architecture.md)                 | Directory structure, request lifecycle, worker loop, processor pattern         |
| [api-contracts.md](backend/api-contracts.md)               | All REST endpoints, request/response schemas, error codes                      |
| [job-model.md](backend/job-model.md)                       | Job fields, state machine, retry logic, notification schema                    |
| [minio-discussions.md](backend/minio-discussions.md)       | MinIO integration: why server-side proxy, object key scheme, StorageClient API |
| [notification-service.md](backend/notification-service.md) | Email notifications via Mailtrap, architecture, config                         |
| [job-suggestions.md](backend/job-suggestions.md)           | How to add a new job type (step-by-step guide)                                 |
| [apply-alembic.md](backend/apply-alembic.md)               | How to run Alembic migrations locally                                          |

### Helm Deployment

| File                                                         | Contents                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| [README.md](helm-deployment/README.md)                       | Full K8s deployment guide (Istio → Prometheus → App → Verify) |
| [secret-management.md](helm-deployment/secret-management.md) | How secrets are managed (out-of-band, not in Git)             |
| [istio-plan.md](helm-deployment/istio-plan.md)               | Istio integration planning notes                              |
| [plan.md](helm-deployment/plan.md)                           | Helm chart development plan                                   |
| [loki-values.yaml](helm-deployment/loki-values.yaml)         | Loki Helm values (monolithic mode)                            |
| [promtail-values.yaml](helm-deployment/promtail-values.yaml) | Promtail Helm values                                          |

### Istio & Networking

| File                           | Contents                                               |
| ------------------------------ | ------------------------------------------------------ |
| [istio-mtls.md](istio-mtls.md) | Istio concepts, step-by-step setup, how to verify mTLS |

### Monitoring & Observability

| File                           | Contents                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------- |
| [monitoring.md](monitoring.md) | Prometheus metrics, Grafana dashboards, Loki log queries, PromQL/LogQL examples |

### MinIO

| File                                                   | Contents                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| [minIO/integration-plan.md](minIO/integration-plan.md) | Original MinIO integration planning (historical reference) |

---

## Key Design Decisions (Quick Reference)

| Decision         | What was chosen                                   | Why                                                                      |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Upload mechanism | Server-side streaming proxy (`/api/minio-upload`) | Browser can't resolve MinIO cluster DNS                                  |
| Job queue        | Redis BRPOP/RPUSH                                 | Simple, zero additional dependency (Redis already used for cache)        |
| DB migrations    | Alembic                                           | Reliable schema versioning; runs at pod startup via `entrypoint.sh`      |
| State            | PostgreSQL JSONB for `context`/`notifications`    | Avoid extra tables; job is the aggregate root                            |
| Notifications    | Mailtrap sandbox                                  | Safe for dev; real SMTP avoided; easily swappable provider               |
| Observability    | kube-prometheus-stack + Loki                      | Standard OSS stack; pre-integrated with Kubernetes                       |
| mTLS             | Istio STRICT mode + frontend PERMISSIVE exception | All pod-to-pod traffic encrypted; NodePort still accessible from browser |
| Secrets          | Out-of-band `k8s-secrets.yaml` (gitignored)       | Secrets never enter Git history                                          |

---

## End-to-End Data Flow

```
1. User selects file in browser
2. Drag-drop → DropZone → useFileUpload.validateAndSetFile()
3. User clicks Submit
4. XHR PUT /api/minio-upload?filename=data.csv
     → Next.js streams body → MinIO input bucket
5. lib/api.ts createJob({ job_type, input_file_path: "data.csv" })
     → POST /jobs → backend validates file exists → INSERT job → RPUSH Redis
6. Frontend receives job_id → starts useJobPoller (polls every 2s)
7. Worker BRPOP Redis → claims job (PROCESSING) → downloads input
     → runs processor → uploads output.json → marks COMPLETED
     → sends email notification (if configured)
8. useJobPoller sees COMPLETED → JobResult fetches GET /api/result?key=outputs/...
     → Next.js streams MinIO output → displays result in browser
```
