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

```
Frontend
   |
   | 1️⃣ Upload file (streaming)
   v
Object Storage (MinIO)
   |
   | 2️⃣ Returns object key
   v
Backend API
   |
   | 3️⃣ Create job with object reference
   v
Job Queue
   |
   v
Worker
   |
   | 4️⃣ Reads file from MinIO
   v
Processing

```

## Large File Upload Strategy

### Problem Statement

The platform needs to support **large file uploads** (e.g., CSVs, videos) initiated from a frontend application.

A naive approach—sending files as Base64 within JSON payloads or buffering entire files in memory—introduces serious risks:

* Excessive memory consumption
* Increased request latency
* Backend thread blocking
* Poor scalability and failure recovery

This document explains the  **chosen upload strategy** , the  **alternatives considered** , and  **why this approach is resilient and production-safe** .

---

## Key Design Principles

* **Never load entire files into memory**
* **Never Base64-encode large files**
* **Never include large files inside JSON**
* **Use streaming and backpressure instead of buffering**
* **Decouple file upload from job creation**

---

## Final Upload Flow (Chosen Approach)

### High-Level Flow

<pre class="overflow-visible! px-0!" data-start="1171" data-end="1341"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>Frontend
   │
   │  multipart/form-data (streamed)
   ▼
Backend API (FastAPI)
   │
   │  streaming upload (</span><span>no</span><span> buffering)
   ▼
MinIO (S3-compatible </span><span>object</span><span></span><span>storage</span><span>)
</span></span></code></div></div></pre>

### Sequence

1. The frontend uploads the file using `multipart/form-data`
2. The backend **streams** the file directly to MinIO
3. On successful upload, MinIO returns an `object_key`
4. The frontend then calls `POST /jobs`, passing the `object_key`
5. The job is queued for asynchronous processing

---

## Why Streaming Uploads Do Not Cause Lag

### What Actually Happens Under the Hood

* The browser sends the file in **chunks**
* FastAPI reads the stream incrementally
* The MinIO client uploads chunks using **multipart upload**
* TCP backpressure naturally throttles flow when needed
* The backend never holds the full file in memory

**Result:**

* Flat memory usage
* No event loop blocking
* Predictable performance under load

---

## Backend Implementation Concept

FastAPI provides `UploadFile`, which is designed specifically for large file handling.

Key properties:

* Small files → memory
* Large files → disk (spooled)
* File object can be streamed directly

### Streaming to MinIO (Conceptual)

<pre class="overflow-visible! px-0!" data-start="2356" data-end="2575"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-python"><span><span>minio_client.put_object(
    bucket_name=</span><span>"jobs"</span><span>,
    object_name=object_key,
    data=file.file,        </span><span># streamed</span><span>
    length=-</span><span>1</span><span>,             </span><span># unknown size</span><span>
    part_size=</span><span>10</span><span> * </span><span>1024</span><span> * </span><span>1024</span><span></span><span># 10 MB chunks</span><span>
)
</span></span></code></div></div></pre>

This ensures:

* Multipart uploads
* No buffering
* Safe handling of large files

---

## Why Job Creation Happens *After* Upload

Creating a job **before** upload introduces failure states:

* Orphaned jobs if upload fails
* Complex cleanup logic
* Retry ambiguity

### Chosen Approach

* Upload file first
* Create job only after successful upload

This ensures:

* Clean system state
* Simple idempotency
* No zombie jobs

---

## Alternative Considered: Direct Browser → MinIO Uploads

### Pre-Signed URL Approach

<pre class="overflow-visible! px-0!" data-start="3094" data-end="3213"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>Frontend ───────────► MinIO
   ▲                      |
   |   pre-</span><span>signed</span><span> URL     |
   └──── Backend ─────────┘
</span></span></code></div></div></pre>

**Pros**

* Zero backend load
* Infinite scalability
* Ideal for very large files

**Cons**

* More complex client logic
* Requires CORS configuration
* Harder to debug initially

**Decision**

* Not implemented initially
* Documented as a future scalability enhancement

---

## Failure Handling & Reliability

| Scenario          | Handling                           |
| ----------------- | ---------------------------------- |
| Upload failure    | No job created                     |
| Client disconnect | Upload aborted                     |
| Partial upload    | MinIO multipart cleanup            |
| Retry             | Handled at client or storage level |
| Backend crash     | No file corruption                 |

---

## Guarantees Achieved

* **No job loss**
* **At-least-once processing**
* **Idempotent job creation**
* **Backend remains responsive under load**

---

## Summary

This upload strategy:

* Aligns with industry-standard patterns (S3, GCS, YouTube-like systems)
* Avoids memory and performance pitfalls
* Cleanly separates concerns between upload and processing
* Scales naturally without architectural changes

---

## Future Enhancements

* Pre-signed upload URLs
* Upload resume support
* Client-side chunk retries
* Upload progress events

