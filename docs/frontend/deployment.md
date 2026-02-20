# Frontend — Deployment & Configuration

## Runtime vs Build-time

The frontend image is built **once** and deployed **anywhere**.

| Variable                       | When resolved              | How                         |
| ------------------------------ | -------------------------- | --------------------------- |
| `NEXT_PUBLIC_BACKEND_API_URL`  | **Runtime** (pod start)    | Helm ConfigMap → `envFrom`  |
| `S3_HOST`, `S3_PORT`, `S3_*`   | **Runtime** (request time) | Helm ConfigMap → `envFrom`  |
| Everything inside `next build` | **Build time**             | None — no env vars baked in |

This means:
- The same Docker image runs in dev, staging, and prod
- Changing the backend URL only requires a `helm upgrade`, not a rebuild
- The frontend pod starts successfully **even if the backend is offline** — it shows a "Backend Offline" indicator and becomes functional once the backend is reachable

---

## Helm Configuration

### Values (`helm/resilient-platform/values.yaml`)

```yaml
frontend:
  image:
    repository: jayaraj0781/resilient-async-job-processing-platform-frontend
    tag: "1.0.0"          # updated automatically by CI/CD
    pullPolicy: IfNotPresent
  replicas: 1
  service:
    type: NodePort         # accessible at <node-ip>:30080 by default
    port: 3000
    nodePort: 30080
  resources:
    limits:
      cpu: "500m"
      memory: "256Mi"
    requests:
      cpu: "100m"
      memory: "128Mi"
```

### ConfigMap additions (`templates/configmap.yaml`)

The frontend shares the same ConfigMap as the backend and worker. Only **one new key** was added — all MinIO vars are reused from the existing `S3_*` entries:

```yaml
# New — backend URL built from Helm fullname helper
NEXT_PUBLIC_BACKEND_API_URL: http://{{ fullname }}-backend:{{ .Values.backend.port }}

# Reused — already existed for backend/worker
S3_HOST, S3_PORT, S3_USE_SSL, S3_ACCESS_KEY, S3_SECRET_KEY,
S3_INPUT_BUCKET, S3_OUTPUT_BUCKET
```

### Service Type

The frontend Service defaults to `NodePort` on port **30080**:

```
http://<node-ip>:30080
```

To change, update `values.yaml`:
```yaml
frontend:
  service:
    type: ClusterIP      # for Ingress-based access
    # or
    type: LoadBalancer   # for cloud managed LB
```

If you switch to `ClusterIP`, remove `nodePort` from the values or set it to `0` — Kubernetes rejects a `nodePort` field on a ClusterIP service.

---

## CI/CD — Automatic Image Build

The CI/CD pipeline (`.github/workflows/docker-build.yml`) triggers automatically when any file under `frontend/**` is pushed to `main`.

Flow:
```
push to main (frontend/**) 
    → changes job detects frontend = true
    → frontend job runs
        → semver bumped from DockerHub (or values.yaml fallback)
        → image built and pushed (linux/amd64 + linux/arm64)
        → values.yaml .frontend.image.tag updated
        → CHANGELOG.md appended
        → Release PR opened
    → merge PR
    → helm upgrade
```

All logic lives in the reusable composite action at `.github/actions/build-and-release/action.yml`. The workflow file itself is just a thin caller.

---

## Kubernetes Deployment

```bash
# Full upgrade (all components)
helm upgrade --install resilient-platform helm/resilient-platform \
  -n resilient-platform

# Restart frontend pod only (after pushing a new image with same tag)
kubectl rollout restart deployment/resilient-platform-frontend \
  -n resilient-platform

# Watch pods come up
kubectl get pods -n resilient-platform -w

# Get your node IP for NodePort access
kubectl get nodes -o wide
```

---

## Health Probes

Both liveness and readiness probes hit `GET /` on port 3000:

```yaml
livenessProbe:
  httpGet: { path: /, port: 3000 }
  initialDelaySeconds: 20   # Next.js standalone needs time to start
  periodSeconds: 10

readinessProbe:
  httpGet: { path: /, port: 3000 }
  initialDelaySeconds: 10
  periodSeconds: 5
```

`initialDelaySeconds: 20` for liveness gives the Node.js process time to start before Kubernetes kills it. Tune this down once you have a stable baseline.
