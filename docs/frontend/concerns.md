# Frontend — Known Concerns & Future Work

This document captures honest known limitations, deliberate trade-offs, and areas that would need attention before treating this as a production system.

---

## Known Concerns

### 1. `NEXT_PUBLIC_*` vars are embedded at build time by Next.js — with one exception

`NEXT_PUBLIC_` vars are normally inlined by the Next.js compiler at build time. We deliberately avoided this by making `NEXT_PUBLIC_BACKEND_API_URL` runtime-injectable through a specific pattern:

- The value is read via `process.env.NEXT_PUBLIC_BACKEND_API_URL` in `lib/api.ts`
- Because we use `output: "standalone"`, Next.js produces a `server.js` that reads env vars fresh on pod start
- **However:** if any component uses `NEXT_PUBLIC_BACKEND_API_URL` in a statically pre-rendered page, Next.js would inline `""` at build time

**Current mitigation:** The API URL is only read in `lib/api.ts` (`export const API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://localhost:5001"`), which is only called inside client-side fetch calls — not during static generation. This is safe but fragile: any future use of `API_URL` in a `generateStaticParams` or server component could break this.

**Proper fix (production):** Use an Ingress to route `/api/*` to the backend and `/` to the frontend, so the browser always talks to the same origin and the URL is always relative (`/api/jobs` instead of `http://backend:5001/api/jobs`). This eliminates the runtime env var problem entirely.

---

### 2. MinIO credentials in ConfigMap (not a Secret)

For this learning project, MinIO credentials (`S3_ACCESS_KEY`, `S3_SECRET_KEY`) live in the ConfigMap as plain text. This is acceptable here because:
- The credentials are the default `minioadmin` / `minioadmin`
- The cluster is not exposed to the internet

**In production:** These must be in a Kubernetes `Secret`, with the ConfigMap referencing `secretKeyRef`. The Helm chart would need a `resilient-minio-secret` Secret created out-of-band (or via Sealed Secrets / External Secrets Operator).

---

### 3. Large file uploads (>500 MB) — soft client-side guard, not a hard architectural limit

> **Status: Partially resolved.** The original blocking concern was that presigned URLs could not be used because the browser cannot resolve the MinIO internal cluster DNS (`resilient-platform-minio-service:9000`). This was **fixed** by replacing the presigned URL flow with a **server-side streaming proxy** (`PUT /api/minio-upload`).
>
> The upload now flows: **Browser → Next.js server (`/api/minio-upload`) → MinIO (cluster DNS)**, without the file ever buffering in RAM. Files of any size are theoretically supported up to MinIO's single-PUT limit of **5 GB**.

**What still exists:** A 500 MB client-side guard in `lib/constants.ts`:

```ts
/** Max file size accepted by the /api/minio-upload server-side proxy (500 MB).
 *  Files larger than this would need chunked/multipart upload (future work). */
export const MAX_SINGLE_PUT_BYTES = 500 * 1024 * 1024;
```

The `useFileUpload` hook rejects files above this limit before the upload even starts. This is a **configurable soft limit**, not an architectural constraint. You can raise it (up to MinIO's 5 GB single-PUT cap) without any code changes other than updating this constant.

**Why 500 MB?** It is a conservative default. For very large files (e.g. a 4 GB CSV), a single PUT means the entire upload is lost if the network drops. Multipart upload would allow resuming from the last successful chunk.

**Future improvement:** Implement chunked multipart upload for files above a threshold:
1. `POST /api/multipart/initiate` → returns `uploadId` from MinIO
2. Sequential/parallel `PUT /api/multipart/part?uploadId=X&partNumber=N` per chunk
3. `POST /api/multipart/complete` → assembles parts in MinIO

This gives full resumability and progress tracking per chunk. Not needed for the current learning project scope but well-defined as the next step.

---

### 4. No authentication

There is no login, no session, no RBAC. Any user who can reach port 30080 can submit jobs and view all job history.

**This is intentional for the learning project scope.** Adding auth would require:
- An auth provider (Keycloak, Auth0, Cognito, or NextAuth.js)
- Backend API authenticated endpoints
- Frontend session management

---

### 5. Job history is global — not per-user

`GET /jobs` returns all jobs from all users. With auth, this would be filtered per-tenant.

---

### 6. Output file viewer is text-only

The `JobResult` component displays the output as plain text / pretty-printed JSON. For CSV outputs it shows raw text.

**Future improvement:** Detect content type and render CSVs as a table, or add a download button for large binary outputs.

---

### 7. No error boundary

If a component throws an uncaught error (e.g. a bad API response), the whole page collapses to a blank screen. React Error Boundaries should wrap `JobTracker` and `JobHistory` at minimum.

---

### 8. Frontend pod has no `NEXT_TELEMETRY_DISABLED`

Next.js collects anonymous telemetry by default. The Dockerfile doesn't set `NEXT_TELEMETRY_DISABLED=1`. In an air-gapped or privacy-sensitive environment, add this to the Dockerfile `ENV` block or the Helm ConfigMap.

---

## Design Trade-offs (Intentional)

| Decision                                          | Rationale                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| No global state library                           | One user workflow, one page — local state is sufficient                         |
| Inline styles + CSS vars instead of pure Tailwind | Keeps all design tokens in CSS, avoids Tailwind class sprawl for dynamic values |
| `envFrom: configMapRef` (all vars)                | Simple setup — frontend only needs a few extra keys from an existing ConfigMap  |
| NodePort instead of Ingress                       | Simpler for a local learning cluster; Ingress would be the production choice    |
| Single-page app                                   | The workflow is linear — no navigation needed                                   |
