# Resilient Async Job Processing Platform — Helm Deployment Guide

This guide covers the full Kubernetes deployment of the platform, including Istio mTLS, the
kube-prometheus-stack (Prometheus + Grafana + Loki), and the application itself.

---

## Prerequisites

| Tool       | Version                | Purpose          |
| ---------- | ---------------------- | ---------------- |
| `kubectl`  | ≥ 1.28                 | Cluster access   |
| `helm`     | ≥ 3.12                 | Chart management |
| `minikube` | ≥ 1.32 (docker driver) | Local cluster    |

---

## 1. Start Minikube

```bash
minikube start --driver=docker --cpus=4 --memory=8192
```

---

## 2. Install Istio

```bash
# Add the Istio helm repo
helm repo add istio https://istio-release.storage.googleapis.com/charts
helm repo update

# Create the istio-system namespace
kubectl create namespace istio-system

# Install Istio base CRDs
helm install istio-base istio/base -n istio-system --wait

# Install Istiod (control plane)
helm install istiod istio/istiod -n istio-system --wait
```

Verify Istiod is running:
```bash
kubectl get pods -n istio-system
```

---

## 3. Install Prometheus Stack (Prometheus + Grafana + Alertmanager)

```bash
# Add the Prometheus community helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Create the monitoring namespace
kubectl create namespace monitoring

# Install kube-prometheus-stack
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring \
  --set grafana.adminPassword=admin \
  --wait
```

### Install Loki (log aggregation)

> **Note:** `loki-stack` is deprecated. Use `grafana/loki` in **Monolithic mode** (official recommendation for single-node / local dev).

```bash
# Add the Grafana helm repo
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# If a previous failed loki release exists, remove it first
helm uninstall loki -n monitoring

# Install Loki - monolithic single replica (uses bundled MinIO for object storage)
# Values file: docs/helm-deployment/loki-values.yaml
helm install loki grafana/loki \
  -n monitoring \
  -f docs/helm-deployment/loki-values.yaml

# Install Promtail (ships pod logs → Loki gateway)
# Values file: docs/helm-deployment/promtail-values.yaml
helm install promtail grafana/promtail \
  -n monitoring \
  -f docs/helm-deployment/promtail-values.yaml
```

Verify Loki and Promtail are running:
```bash
kubectl get pods -n monitoring | grep -E "loki|promtail"
```

> **⚠️ Multi-tenancy:** Loki enables multi-tenancy by default. All API calls require the `X-Scope-OrgID` header. The `promtail-values.yaml` sets `tenant_id: resilient-platform` to handle this automatically.

Wire Loki into Grafana (one-time setup in UI):
1. `kubectl port-forward svc/kube-prometheus-stack-grafana 3001:80 -n monitoring`
2. Open `http://localhost:3001` → **Connections → Data Sources → Add → Loki**
3. URL: `http://loki-gateway.monitoring.svc.cluster.local`
4. Under **HTTP Headers**, add: `X-Scope-OrgID` = `resilient-platform`
5. Click **Save & Test**

---

## 4. Deploy the Platform

### 4a. Create the namespace with Istio sidecar injection enabled

```bash
kubectl create namespace resilient-platform
kubectl label namespace resilient-platform istio-injection=enabled
```

### 4b. Apply secrets

```bash
kubectl apply -f k8s-secrets.yaml -n resilient-platform
```

> `k8s-secrets.yaml` is at the repo root. Do not commit it to Git.

### 4c. Install the Helm chart

```bash
helm upgrade --install resilient-platform helm/resilient-platform \
  -n resilient-platform \
  --wait
```

### 4d. Verify all pods are running

```bash
kubectl get pods -n resilient-platform
```

Expected output — all pods should show `2/2 Running` (1 app container + 1 Istio sidecar):

```
NAME                                          READY   STATUS    
resilient-platform-backend-xxx                2/2     Running   
resilient-platform-frontend-xxx               2/2     Running   
resilient-platform-minio-0                    2/2     Running   
resilient-platform-postgres-0                 2/2     Running   
resilient-platform-redis-0                    2/2     Running   
resilient-platform-worker-xxx                 2/2     Running   
```

---

## 5. Access the Frontend

The frontend is exposed as a **NodePort** on port `30080`.

```bash
# Get the minikube IP
minikube ip
```

Then open: `http://<minikube-ip>:30080`

Or use the minikube service helper:
```bash
minikube service resilient-platform-frontend -n resilient-platform
```

---

## 6. Verify Istio mTLS

### Check PeerAuthentication policies

```bash
kubectl get peerauthentication -n resilient-platform
```

You should see:
- `resilient-platform-default` with `MODE: STRICT` — enforces mTLS for all pods in the namespace
- `resilient-platform-frontend` — exception for the frontend's NodePort (allows plain HTTP from the browser)

### Confirm mTLS traffic with Istio telemetry

**Option A — Check connection metadata via proxy:**
```bash
# Pick any backend pod
BACKEND_POD=$(kubectl get pod -n resilient-platform -l app.kubernetes.io/component=backend -o jsonpath='{.items[0].metadata.name}')

# Query the Envoy proxy's stats for TLS handshakes
kubectl exec -n resilient-platform $BACKEND_POD -c istio-proxy -- \
  pilot-agent request GET stats | grep ssl.handshake
```

A non-zero `ssl.handshake` count confirms mTLS connections are being established.

**Option B — Kiali (recommended visual confirmation):**
```bash
# Install Kiali
helm install kiali-server kiali/kiali-server \
  -n istio-system \
  --set auth.strategy=anonymous \
  --set external_services.prometheus.url="http://kube-prometheus-stack-prometheus.monitoring:9090"

kubectl port-forward svc/kiali 20001:20001 -n istio-system
```
Open `http://localhost:20001` → Graph view → enable **Security** badge. Padlock icons on edges = mTLS is active.

**Option C — Check Envoy proxy config directly:**
```bash
istioctl proxy-config listener $BACKEND_POD.resilient-platform | grep -i tls
```

---

## 7. Access Observability UIs

### Grafana

```bash
kubectl port-forward svc/kube-prometheus-stack-grafana 3001:80 -n monitoring
```
Open `http://localhost:3001`

Login credentials:
- **Username:** `admin`
- **Password:** retrieve with:
  ```bash
  kubectl get secret -n monitoring kube-prometheus-stack-grafana \
    -o jsonpath="{.data.admin-password}" | base64 -d && echo
  ```

> **Note:** `--set grafana.adminPassword=admin` is ignored when the secret already exists. Always fetch from the secret.

Pre-built dashboards to explore:
- **Kubernetes / Compute Resources / Namespace** — CPU/memory per namespace
- **Istio Service Dashboard** — request rates, error %, latency per service
- **Loki Logs** — search pod logs directly from Grafana (Explore → Loki → `{namespace="resilient-platform"}`)

### Prometheus

```bash
kubectl port-forward svc/kube-prometheus-stack-prometheus 9090:9090 -n monitoring
```
Open `http://localhost:9090`

Useful queries:
```promql
# Backend HTTP request rate
rate(http_requests_total{namespace="resilient-platform"}[5m])

# Job queue depth (custom metric from worker)
celery_queue_length

# Istio inter-service latency
histogram_quantile(0.99, sum(rate(istio_request_duration_milliseconds_bucket{destination_service_namespace="resilient-platform"}[5m])) by (le, destination_service_name))
```

### Alertmanager

```bash
kubectl port-forward svc/kube-prometheus-stack-alertmanager 9093:9093 -n monitoring
```
Open `http://localhost:9093`

---

## 8. Validate the Full Render (helm template)

To regenerate `helm-output.yaml` after any chart changes:

```bash
helm lint helm/resilient-platform/
helm template resilient-platform helm/resilient-platform/ \
  --namespace resilient-platform > helm/helm-output.yaml
```

---

## Troubleshooting

| Symptom                                         | Likely Cause                          | Fix                                                                      |
| ----------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------ |
| `ImagePullBackOff`                              | Minikube can't reach Docker Hub       | Check DNS: `minikube ssh "nslookup registry-1.docker.io 8.8.8.8"`        |
| Pod shows `1/2`                                 | Istio sidecar running but app failing | Check `kubectl logs <pod> -c <container>`                                |
| DB connection error `Name or service not known` | Wrong hostname in secret              | Host must be `resilient-platform-postgres-service` (not `postgres`)      |
| `Init:Error` on backend                         | Migrate init container failed         | Check `kubectl logs <pod> -c migrate`                                    |
| Frontend not loading                            | NodePort not accessible               | Use `minikube service resilient-platform-frontend -n resilient-platform` |
