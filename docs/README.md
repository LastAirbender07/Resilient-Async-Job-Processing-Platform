### Minimum required states:

- CREATED
- QUEUED
- PROCESSING
- RETRYING
- FAILED
- COMPLETED
- DEAD


For each state, define:

- Who sets it
- When it transitions
- Whether it is terminal


### Failure Guarantees

- Delivery guarantee: At-least-once
- Job idempotency: Required
- Duplicate processing: Allowed
- Job loss: Not allowed

This justifies:

- Redis/Kafka choice
- Worker retry logic
- DLQ existence


### Repo Structure:

```
resilient-async-platform/
├── backend/
│   ├── app/
│   ├── tests/
│   └── Dockerfile
├── worker/
│   ├── app/
│   ├── tests/
│   └── Dockerfile
├── frontend/
│   ├── src/
│   └── Dockerfile
├── infra/
│   ├── docker-compose/
│   ├── helm/
│   ├── istio/
│   └── keda/
├── observability/
│   ├── prometheus/
│   ├── grafana/
│   └── loki/
├── .github/workflows/
├── README.md
└── docs/

```

### Goal:

Upload → Job created → Worker processes → Job completed → UI updates

### Order:

- Job persistence
- Worker crash recovery
- Retries + DLQ
- WebSockets/SSE
- Rate limiting
- KEDA autoscaling
- Istio mTLS
- Observability depth

Start with:

Docker Compose with Single worker - Local Redis - Local MinIO

Only when behavior is correct:

Move to K8s, Add Helm, Add Istio, Add KEDA
