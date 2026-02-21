# Frontend — Development Guide

## Prerequisites

| Tool        | Version | Notes                                                        |
| ----------- | ------- | ------------------------------------------------------------ |
| Node.js     | 20+     | LTS recommended                                              |
| pnpm        | latest  | `corepack enable && corepack prepare pnpm@latest --activate` |
| kubectl     | any     | Only for port-forwarding cluster services                    |
| MinIO       | running | Local Docker or cluster via `kubectl port-forward`           |
| Backend API | running | Local or cluster via `kubectl port-forward`                  |

---

## Local Setup

```bash
cd frontend
pnpm install
```

### Environment Variables

Copy `.env.local` — it ships with sane defaults for local development:

```bash
# All values below are defaults — change only if your local setup differs

# Backend API
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:5001

# MinIO — same S3_* key names as the Helm ConfigMap
S3_HOST=localhost
S3_PORT=9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_USE_SSL=false
S3_INPUT_BUCKET=resilient-async-job-processing-inputs
S3_OUTPUT_BUCKET=resilient-async-job-processing-outputs
```

> **Naming convention:** The frontend uses `S3_*` variable names — the **exact same keys** that the Helm ConfigMap defines. This means the app reads identical env var names in both local dev and Kubernetes, with zero translation layer.

### Port-Forward Cluster Services (if running on k8s)

```bash
# Terminal 1 — backend
kubectl port-forward svc/resilient-platform-backend 5001:5001 -n resilient-platform

# Terminal 2 — MinIO (S3 API + Console)
kubectl port-forward svc/resilient-platform-minio-service 9000:9000 9001:9001 -n resilient-platform
```

> ⚠️ Port **9000** is the MinIO S3 API (used by the Next.js API routes). Port **9001** is the MinIO Console UI. You only need to port-forward 9000 if you want the `PUT /api/minio-upload` and `GET /api/result` proxy routes to work locally. The Next.js server handles the connection to MinIO, not the browser.

### Run Dev Server

```bash
pnpm dev
# → http://localhost:3000
```

---

## Adding a New Job Type

1. **Backend** — register the new type in the backend's job type enum
2. **`lib/api.ts`** — add the label to `JOB_TYPE_LABELS`:
   ```ts
   export const JOB_TYPE_LABELS: Record<JobType, string> = {
     TEST_JOB:    "Test Run",
     NOTIFY_JOB:  "Email Notify",
     MY_NEW_TYPE: "My New Processor",  // ← add here
   };
   ```
3. `JobTypeSelector.tsx` picks it up automatically from `JOB_TYPE_LABELS` — no changes needed there.

---

## Adding a New API Route

All API routes live in `app/api/<name>/route.ts`. If the route needs MinIO:

```ts
import { getMinioClient, getInputBucket } from "@/lib/minio-client";

export async function GET(req: NextRequest) {
  // ✅ Call getters INSIDE the handler — never at module top-level
  const client = getMinioClient();
  const bucket = getInputBucket();
  // ...
}
```

> **Critical:** Never call `getMinioClient()`, `getInputBucket()`, or `getOutputBucket()` at module top-level. Next.js evaluates API route modules during `next build` — any module-level env access crashes the Docker build where no runtime env vars are present.

---

## TypeScript Check

```bash
npx tsc --noEmit
```

Must pass with zero errors before any commit.

---

## Production Build (local test)

```bash
pnpm build
# then
node .next/standalone/server.js
```

Env vars must be set in the shell for the server to start in production mode:

```bash
S3_HOST=localhost S3_PORT=9000 ... node .next/standalone/server.js
```

---

## Docker Build

```bash
docker build -t jayaraj0781/resilient-async-job-processing-platform-frontend:x.y.z .
```

The Dockerfile:
- **Stage 1 (deps):** installs pnpm and runs `pnpm install --frozen-lockfile`
- **Stage 2 (builder):** copies source, runs `pnpm build` (produces `.next/standalone`)
- **Stage 3 (runner):** copies only the standalone output — minimal image size

`NEXT_PUBLIC_BACKEND_API_URL` is **intentionally not passed** as a build arg. It is injected at pod startup via the Helm ConfigMap, so the same image works across dev/staging/prod.

---

## IDE Tips

- `@/` path alias resolves to the `frontend/` root (configured in `tsconfig.json`)
- All hooks are `"use client"` — they run in the browser only
- API routes (`app/api/**`) are server-only — never import them into client components
- CSS class names like `card`, `submit-btn`, `drop-zone` are defined in `globals.css`
