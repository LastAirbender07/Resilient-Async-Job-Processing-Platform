# Helm Deployment — Secret Management

> **Status: Implemented.** Secrets are created out-of-band via `kubectl` and referenced by name in the Helm chart — secrets are never stored in Git.

---

## The Core Principle

> **Helm renders infrastructure. Helm does not own secrets.**

The pattern used here:

```
Git repo
  └── helm/resilient-platform/values.yaml  ← secret names only, no values
  └── k8s-secrets.yaml                     ← NOT committed to Git (.gitignore'd)

Cluster
  └── kubectl apply -f k8s-secrets.yaml    ← creates the actual Secret objects
  └── helm upgrade ...                      ← chart references secrets by name
```

---

## What Secrets Exist

| Secret Name                 | Namespace            | Contains                        |
| --------------------------- | -------------------- | ------------------------------- |
| `resilient-platform-secret` | `resilient-platform` | All app credentials (see below) |

The single `k8s-secrets.yaml` at the repo root holds all credentials in one Kubernetes `Secret` object. The Helm chart mounts it via `envFrom: secretRef`.

---

## Creating the Secret

The file `k8s-secrets.yaml` is `.gitignore`'d — you must create it yourself before deploying:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: resilient-platform-secret
  namespace: resilient-platform
type: Opaque
stringData:
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: your-secure-password
  POSTGRES_DB: notifications
  S3_ACCESS_KEY: your-minio-access-key
  S3_SECRET_KEY: your-minio-secret-key
  MAILTRAP_API_KEY: your-mailtrap-key
  MAILTRAP_INBOX_ID: "123456"
  MAILTRAP_USE_SANDBOX: "true"
  MAILTRAP_SENDER_EMAIL: hello@demomailtrap.co
  MAILTRAP_SENDER_NAME: Resilient Job Platform
```

Apply it **before** running `helm upgrade`:

```bash
kubectl apply -f k8s-secrets.yaml -n resilient-platform
```

---

## How Helm References the Secret

In `helm/resilient-platform/templates/`, the backend and worker deployments use:

```yaml
envFrom:
  - configMapRef:
      name: {{ include "resilient-platform.fullname" . }}-config
  - secretRef:
      name: resilient-platform-secret
```

This merges all ConfigMap keys (non-sensitive config) and Secret keys (credentials) into the pod's environment.

---

## Why Not Store Secrets in `values.yaml`?

If you put `postgres.password: mypassword` in `values.yaml` and commit it:

- **Git history permanently leaks the secret**
- You can change the value later but the old value still exists in `git log`
- Rotation becomes painful (invalidate old + rotate + update everywhere)
- Violates any security baseline (SOC2, ISO 27001, etc.)

By using `k8s-secrets.yaml` (gitignored), secrets never touch the repo.

---

## Production Secret Management Options

For a real production system, replace the manual `kubectl apply` with one of:

| Option                        | When to use          | How it works                                                      |
| ----------------------------- | -------------------- | ----------------------------------------------------------------- |
| **Sealed Secrets**            | GitOps (ArgoCD/Flux) | Encrypt with cluster public key; safe to commit encrypted YAML    |
| **External Secrets Operator** | Cloud-native         | Pulls from AWS Secrets Manager, GCP Secret Manager, Vault         |
| **Vault Agent Injector**      | HashiCorp Vault      | Injects secrets as files into pod via sidecar                     |
| **CI/CD injection**           | GitHub Actions, etc. | Pipeline creates/updates the Secret from CI secrets before deploy |

For this learning project, manual `kubectl apply` is sufficient.

---

## Rotating a Secret

```bash
# Edit the secret (opens in $EDITOR)
kubectl edit secret resilient-platform-secret -n resilient-platform

# Or update a specific key
kubectl patch secret resilient-platform-secret -n resilient-platform \
  --type='json' \
  -p='[{"op": "replace", "path": "/data/POSTGRES_PASSWORD", "value": "'$(echo -n newpassword | base64)'"}]'

# Restart pods to pick up the new secret value
kubectl rollout restart deployment -n resilient-platform
```
