# Resilient-Async-Job-Processing-Platform
This system allows users to upload large files that cannot be processed synchronously. The platform accepts jobs, persists them durably, processes them asynchronously using scalable workers, survives pod crashes without losing work, and exposes real-time job status to users.


## Architecture

#### API Gateway

- Accepts uploads
- Creates jobs
- Exposes job status
- Authenticates users

#### Object Storage (MiniIO)

- Stores uploaded files
- Stores intermediate outputs if needed

#### Job Queue

- Holds pending work
- Guarantees durability

#### Worker Service

- Pulls jobs
- Processes files
- Emits progress & results

#### Event Channel

- WebSocket or SSE for job updates
- Email notifications on completion/failure

#### Observability Stack

- Metrics
- Logs

```
Rule: Each component must be independently restartable without losing jobs.
```

### Non-Goals

- No real video transcoding or ML workloads
- No cloud object storage (local MinIO only)
- No payment or billing logic
- No multi-region or HA cluster setup