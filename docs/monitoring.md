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

| Dashboard                                      | What to look at                                 |
| ---------------------------------------------- | ----------------------------------------------- |
| **Kubernetes / Compute Resources / Namespace** | CPU + memory per component                      |
| **Kubernetes / Compute Resources / Pod**       | Per-pod resource usage                          |
| **Istio Service Dashboard**                    | Request rate, error %, latency between services |
| **Istio Workload Dashboard**                   | Per-workload inbound/outbound traffic           |

---

## Custom Application Metrics

### Worker Metrics (port 8000)

The worker exposes a Prometheus metrics endpoint on `http://worker-pod:8000/metrics`:

| Metric                        | Type      | Labels                                   | Description             |
| ----------------------------- | --------- | ---------------------------------------- | ----------------------- |
| `worker_jobs_total`           | Counter   | `job_type`, `status` (`success`/`error`) | Total jobs processed    |
| `worker_job_duration_seconds` | Histogram | `job_type`                               | How long each job takes |

**Useful PromQL:**

```promql
# Job throughput (per minute, last 5 min)
rate(worker_jobs_total[5m]) * 60

# Error rate
sum(rate(worker_jobs_total{status="error"}[5m])) / sum(rate(worker_jobs_total[5m]))

# P99 job duration per type
histogram_quantile(0.99, sum(rate(worker_job_duration_seconds_bucket[5m])) by (le, job_type))
```

### Backend Metrics (port 5001)

The backend FastAPI app exposes metrics at `GET /metrics`. These include HTTP request counts and latency via `prometheus_fastapi_instrumentator`.

```promql
# Backend HTTP request rate
rate(http_requests_total{namespace="resilient-platform"}[5m])

# HTTP error rate (5xx)
rate(http_requests_total{status=~"5.."}[5m])
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
