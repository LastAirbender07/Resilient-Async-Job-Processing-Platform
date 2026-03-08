# Monitoring & Observability

> **Stack:** Prometheus + Grafana + Loki + Promtail (deployed via `kube-prometheus-stack` + `grafana/loki`)

This document describes what metrics and logs are collected, how to access the dashboards, and key queries for debugging or observing the platform.

---

## Architecture Overview

```
Application Pods (backend, worker, frontend)
        │
        ├── stdout/stderr logs → Promtail → Loki
        └── /metrics endpoint → Prometheus scraper
                                      │
                                      ▼
                                   Grafana
                          (dashboards + log explorer)
```

### Components

| Component    | Namespace    | Purpose                             |
| ------------ | ------------ | ----------------------------------- |
| Prometheus   | `monitoring` | Scrapes metrics from pods and Istio |
| Grafana      | `monitoring` | Dashboards, alerting, log explorer  |
| Alertmanager | `monitoring` | Routes alerts (email, Slack, etc.)  |
| Loki         | `monitoring` | Log aggregation and storage         |
| Promtail     | `monitoring` | DaemonSet: ships pod logs to Loki   |

---

## Accessing UIs

### Grafana

```bash
kubectl port-forward svc/kube-prometheus-stack-grafana 3001:80 -n monitoring
```
Open `http://localhost:3001`

**Login:**
- Username: `admin`
- Password: retrieve with:
  ```bash
  kubectl get secret -n monitoring kube-prometheus-stack-grafana \
    -o jsonpath="{.data.admin-password}" | base64 -d && echo
  ```

> ⚠️ If you passed `--set grafana.adminPassword=admin` at install time but the secret already existed beforehand, the flag is ignored. Always read the password from the secret.

### Prometheus

```bash
kubectl port-forward svc/kube-prometheus-stack-prometheus 9090:9090 -n monitoring
```
Open `http://localhost:9090`

### Alertmanager

```bash
kubectl port-forward svc/kube-prometheus-stack-alertmanager 9093:9093 -n monitoring
```
Open `http://localhost:9093`

---

## Pre-built Dashboards in Grafana

> **Before using any dashboard, set the template variables** (dropdown at top of each dashboard). Without these, all panels will be empty — even if Prometheus is scraping correctly.

| Variable     | Value                                                       |
| ------------ | ----------------------------------------------------------- |
| `datasource` | `Prometheus`                                                |
| `namespace`  | `resilient-platform`                                        |
| `cluster`    | leave blank (single minikube cluster)                       |
| `job`        | `resilient-platform-backend` or `resilient-platform-worker` |

**Recommended imported dashboards (Grafana.com IDs):**

| Dashboard                                  | Grafana ID | What to look at                      |
| ------------------------------------------ | ---------- | ------------------------------------ |
| Kubernetes / Compute Resources / Namespace | **315**    | CPU + memory per component           |
| Kubernetes / Compute Resources / Pod       | **12740**  | Per-pod resource usage               |
| Istio Service Dashboard                    | **7630**   | Request rate, error %, latency       |
| Istio Workload Dashboard                   | **7636**   | Per-workload traffic                 |
| **PostgreSQL Exporter**                    | **9628**   | Slow queries, DB size, connections   |
| **Redis Dashboard for Prometheus**         | **11835**  | Cache hit rate, keys, memory         |
| **MinIO Dashboard**                        | **13502**  | S3 throughput, latency, bucket usage |
| **Loki Stack Monitoring**                  | **14055**  | Promtail/Loki health (req resources) |

**"No number data" error in panels?** This is not a panel bug — it means the query returned no results. Either (a) the data source variable isn't set correctly, (b) the namespace variable doesn't match, or (c) the Prometheus target for that component is DOWN. Check Prometheus → Status → Targets.

---

## Troubleshooting: Prometheus Targets DOWN (Istio mTLS)

> **This was the initial state of this cluster.** Documenting here so "future me" knows what happened and why the fix exists.

**Symptom:** All Grafana panels empty. In Prometheus → Status → Targets, the backend and worker show:
```
DOWN   connection reset by peer
```

**Root cause:** The `resilient-platform` namespace has a STRICT mTLS PeerAuthentication. Prometheus scrapes over plain HTTP. The Istio sidecar rejects plaintext connections with a TCP RST, causing "connection reset by peer". The frontend was UP because it already had its own PeerAuthentication exception.

**Fix (applied in `helm/resilient-platform/templates/servicemonitors.yaml`):**  
Added a consolidated `PeerAuthentication` policy with `portLevelMtls` exceptions. This allows Prometheus to scrape the following ports over plain HTTP while keeping everything else STRICT:
- **Backend**: 5001
- **Worker**: 8000
- **Istio Sidecar**: 15090
- **MinIO**: 9000
- **Postgres Exporter**: 9187
- **Redis Exporter**: 9121

**To verify targets are UP at any time:**
```bash
kubectl port-forward svc/kube-prometheus-stack-prometheus -n monitoring 9090:9090 &
curl -s http://localhost:9090/api/v1/targets | python3 -c "
import json, sys
for t in json.load(sys.stdin)['data']['activeTargets']:
    if t['labels'].get('namespace') == 'resilient-platform':
        print(t['health'].upper(), t['labels'].get('job'), t.get('lastError',''))
"
```
Expected output:
```
UP  resilient-platform-backend
UP  resilient-platform/resilient-platform-worker-monitor
UP  resilient-platform-frontend
UP  resilient-platform/resilient-platform-minio-monitor
UP  resilient-platform/resilient-platform-postgres-monitor
UP  resilient-platform/resilient-platform-redis-monitor
```

---

## Port Naming Convention

To allow Prometheus to find the correct ports on Services, we use a dynamic naming convention in Helm:
`{{ fullname }}-{{ host }}-\{metrics|api\}`

Example: `resilient-platform-postgres-metrics`

Always use the **Port Name** (not the number) in your `ServiceMonitor` configurations to ensure they survive infrastructure changes.

---

## Custom Application Metrics

### Worker Metrics (port 8000)

The worker tracks business-level processing events. Use these "Premium" queries for your main dashboard:

| Panel              | Type        | PromQL                                                                                          |
| ------------------ | ----------- | ----------------------------------------------------------------------------------------------- |
| **Job Throughput** | Time Series | `sum(rate(worker_jobs_total[5m])) * 60`                                                         |
| **Success Rate %** | Gauge       | `sum(rate(worker_jobs_total{status="success"}[5m])) / sum(rate(worker_jobs_total[5m]))`         |
| **P99 Latency**    | Time Series | `histogram_quantile(0.99, sum(rate(worker_job_duration_seconds_bucket[5m])) by (le, job_type))` |

**Other useful PromQL:**

```promql
# Job throughput (per minute, last 5 min)
rate(worker_jobs_total[5m]) * 60

# Error rate
sum(rate(worker_jobs_total{status="error"}[5m])) / sum(rate(worker_jobs_total[5m]))

# P99 job duration per type
histogram_quantile(0.99, sum(rate(worker_job_duration_seconds_bucket[5m])) by (le, job_type))
```

### Backend Metrics (port 5001)

The backend uses `prometheus-fastapi-instrumentator` which auto-exposes metrics at `GET /metrics`.
Import **Grafana dashboard ID 16110** ("FastAPI Observability") and set `app_name = resilient-platform-backend`.

| Metric                              | Type      | Labels                                      | Description         |
| ----------------------------------- | --------- | ------------------------------------------- | ------------------- |
| `fastapi_requests_total`            | Counter   | `app_name`, `method`, `path`, `status_code` | Total HTTP requests |
| `fastapi_requests_duration_seconds` | Histogram | `app_name`, `method`, `path`                | Request latency     |
| `fastapi_requests_inprogress`       | Gauge     | `app_name`, `method`                        | Concurrent requests |

```promql
# Request rate (exclude /metrics path)
rate(fastapi_requests_total{app_name="resilient-platform-backend", path!="/metrics"}[5m])

# P99 latency
histogram_quantile(0.99,
  sum(rate(fastapi_requests_duration_seconds_bucket{app_name="resilient-platform-backend"}[5m]))
  by (le, path)
)
```

### Istio Metrics

Because Istio sidecars are injected, all pod-to-pod traffic is automatically instrumented:

```promql
# Inter-service latency P99
histogram_quantile(0.99,
  sum(rate(istio_request_duration_milliseconds_bucket{
    destination_service_namespace="resilient-platform"
  }[5m])) by (le, destination_service_name)
)

# Request success rate (non-5xx) between services
sum(rate(istio_requests_total{
  destination_service_namespace="resilient-platform",
  response_code!~"5.."
}[5m])) by (source_workload, destination_service_name)
```

---

## Log Aggregation (Loki)

All pod logs flow: **Promtail (DaemonSet) → Loki gateway → Loki storage**

### Wiring Loki into Grafana (One-time setup)

1. Go to **Connections → Data Sources → Add → Loki**
2. URL: `http://loki-gateway.monitoring.svc.cluster.local`
3. Add header: `X-Scope-OrgID` = `resilient-platform`  
   (Loki runs with multi-tenancy by default; the tenant ID is set in `promtail-values.yaml`)
4. Click **Save & Test**

### Key Log Queries (LogQL)

```logql
# All logs from the resilient-platform namespace
{namespace="resilient-platform"}

# Backend logs only
{namespace="resilient-platform", app_kubernetes_io_component="backend"}

# Worker logs only
{namespace="resilient-platform", app_kubernetes_io_component="worker"}

# All job failure events
{namespace="resilient-platform"} |= "Job failed"

# Logs for a specific job_id
{namespace="resilient-platform"} |= "job_id" |= "YOUR-UUID-HERE"

# Error-level logs only
{namespace="resilient-platform"} | json | level="ERROR"
```

### Exploring in Grafana

Go to **Explore → select Loki → switch to Code mode** and paste a LogQL query.

---

## Loki Multi-tenancy Note

> Loki is installed with multi-tenancy enabled by default. **All API calls require the `X-Scope-OrgID` header**.

- Promtail sends logs with tenant ID `resilient-platform` (configured in `promtail-values.yaml`)
- Grafana data source must send this header (set in the data source config above)
- Direct `curl` to the Loki API must include: `-H "X-Scope-OrgID: resilient-platform"`

---

## Alerting (Future Work)

Alertmanager is deployed but no custom alert rules are configured for the application. To add:

1. Create a `PrometheusRule` resource in the `monitoring` namespace
2. Define alert conditions in PromQL
3. Configure a receiver in Alertmanager (email, Slack, PagerDuty)

Example rule to alert on high job failure rate:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: resilient-platform-alerts
  namespace: monitoring
spec:
  groups:
  - name: worker.rules
    rules:
    - alert: HighJobFailureRate
      expr: |
        rate(worker_jobs_total{status="error"}[5m]) /
        rate(worker_jobs_total[5m]) > 0.1
      for: 2m
      labels:
        severity: warning
      annotations:
        summary: "More than 10% of jobs are failing"
```
