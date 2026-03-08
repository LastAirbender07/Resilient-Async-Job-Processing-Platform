# 🌊 Resilient Async Job Processing Platform

[![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![Istio](https://img.shields.io/badge/Istio-466BB0?style=for-the-badge&logo=istio&logoColor=white)](https://istio.io/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?style=for-the-badge&logo=prometheus&logoColor=white)](https://prometheus.io/)

An **Enterprise-Grade** asynchronous job processing system built for 100% resilience, observability, and security. Designed to handle large file processing (CSV/JSON) with zero data loss, even under cluster-wide failure.

---

## 🚀 Why this project?

Standard web applications fail when processing large files. Timeouts, pod crashes, and database deadlocks often lead to lost work. This platform solves that by:
- **Durably Persisting** every job state in PostgreSQL.
- **Decoupling** API from execution using Redis.
- **Enforcing Security** via Istio STRICT mTLS.
- **Monitoring Everything** with a dedicated Prometheus/Grafana/Loki stack.

---

## 🏗 System Architecture

```mermaid
graph TD
    subgraph "External Access"
        Browser[User Browser]
    end

    subgraph "resilient-platform Namespace"
        FE[Next.js Frontend]
        BE[FastAPI Backend]
        W[Python Worker]
        DB[(PostgreSQL)]
        KV[(Redis)]
        S3[(MinIO)]
    end

    subgraph "Monitoring Namespace"
        PROM[Prometheus]
        GRAF[Grafana]
        LOKI[Loki]
    end

    Browser -->|NodePort:30080| FE
    FE -->|Proxy| BE
    BE -->|Query| DB
    BE -->|Queue ID| KV
    BE -->|Upload| S3
    W -->|Pop ID| KV
    W -->|Process| S3
    W -->|Update State| DB
    
    %% Scrapes
    PROM -->|Scrape| BE
    PROM -->|Scrape| W
    PROM -->|Scrape Sidecars| DB
    PROM -->|Scrape Sidecars| KV
    GRAF -->|Visualize| PROM
    GRAF -->|Logs| LOKI
```

---

## ✨ Key Features

- ✅ **Resilient Workers**: Jobs that fail are automatically retried with exponential backoff.
- ✅ **Strict mTLS**: All pod-to-pod communication is encrypted using Istio.
- ✅ **Object Storage**: High-performance S3-compatible storage via MinIO.
- ✅ **Deep Observability**: Pre-configured dashboards for CPU/RAM, Istio traffic, and DB health.
- ✅ **Schema Safety**: Automatic database migrations during deployment via Alembic.

---

## 🛠 Quick Start (Minikube)

### 1. Prerequisites
- Minikube with `istio` and `ingress` addons enabled.
- `helm` installed.

### 2. Deploy the Infrastructure
```bash
# Install the Observability stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack -n monitoring --create-namespace

# Deploy the Platform
cd helm/resilient-platform
helm install resilient-platform . -n resilient-platform --create-namespace
```

### 3. Access the Apps
```bash
# Frontend
minikube service resilient-platform-frontend -n resilient-platform

# Grafana (Dashboards)
kubectl port-forward svc/kube-prometheus-stack-grafana 3001:80 -n monitoring
# (Visit localhost:3001 - Default creds: admin / prom-operator)
```

---

## 📊 Observability Showcase

This project includes "Day 2" operational readiness out of the box.

| Component    | Dashboard ID | Metrics Tracked                            |
| ------------ | ------------ | ------------------------------------------ |
| **Postgres** | `9628`       | Slow queries, DB size, active connections  |
| **Redis**    | `11835`      | Memory usage, cache hit rate, key eviction |
| **MinIO**    | `13502`      | S3 API latency, throughput, bucket trends  |
| **Cluster**  | `315`        | Resource saturation per node/pod           |

---

## 📂 Project Structure

- `/backend`: FastAPI service & SQLAlchemy models.
- `/frontend`: Next.js React application with Tailwind CSS.
- `/helm`: Production-ready Kubernetes manifests.
- `/docs`: Deep dives into Istio, Monitoring, and API Contracts.

---

## ⚖️ License
[MIT](LICENSE) - Built for educational best practices in cloud-native engineering.