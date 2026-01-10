## PHASE 0 — DONE (FOUNDATION)

You have  **completed this phase** .

✔ FastAPI

✔ SQLAlchemy ORM

✔ Alembic migrations

✔ Docker Compose

✔ Postgres

✔ Versioned schema

✔ Clean startup discipline

**Checkpoint reached** ✅

---

## PHASE 1 — DATABASE HARDENING (NEXT STEP)

### 🎯 Goal

Make the database  **safe under concurrency and failure** , before adding workers.

### 1️⃣ Add DB-Level Constraints (NOT optional)

These are  **guardrails** , not business logic.

Add:

* NOT NULL (already mostly done)
* CHECK constraints (retry_count ≥ 0, max_retries ≥ 0)
* ENUM constraint (already via job_status)
* UNIQUE constraints if applicable

**Why now?**

Because once workers start writing concurrently, bugs become silent data corruption.

---

### 2️⃣ Add Critical Indexes

At minimum:

* `(status)`
* `(status, created_at)`
* `(user_id, created_at)`

**Why now?**

Workers will query by `status`.

APIs will list by `user_id`.

Indexes  **must exist before load exists** .

---

### 3️⃣ Remove `Base.metadata.create_all()` (Already Done)

Alembic is now the  **only schema authority** .

This completes  **PHASE 1** .

---

## PHASE 2 — JOB STATE MACHINE (CORE LOGIC)

### 🎯 Goal

Centralize and  **formalize job transitions** .

This is where your earlier lists overlap —  **this is the unifying step** .

### What this includes

* Valid state transitions
* Retry limits
* Idempotent updates
* Transition failures rejected explicitly

This is **NOT** async yet.

This is  **correctness first** .

---

## PHASE 3 — WORKER (NO REDIS YET)

### 🎯 Goal

Process jobs  **asynchronously** , but simply.

### What this phase includes

* A worker loop:
  * fetch QUEUED jobs
  * claim job
  * process
  * update state
* Uses **Postgres only**
* Uses:
  <pre class="overflow-visible! px-0!" data-start="2430" data-end="2473"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>SELECT</span><span> … </span><span>FOR</span><span></span><span>UPDATE</span><span></span><span>SKIP</span><span> LOCKED
  </span></span></code></div></div></pre>

### Why no Redis yet?

Because:

* You learn **job claiming**
* You learn **idempotency**
* You learn **safe concurrency**

This is how real systems are built.

---

## PHASE 4 — RETRY + DLQ SEMANTICS

### 🎯 Goal

Make failures first-class citizens.

### Add:

* Retry backoff (exponential or fixed)
* Retry scheduling
* DEAD state
* Manual retry API

Now the system is  **resilient** , not just async.

---

## PHASE 5 — REDIS + QUEUE ABSTRACTION

### 🎯 Goal

Decouple scheduling from execution.

Redis now becomes:

* A queue of job IDs
* A signal mechanism (not source of truth)

Postgres remains  **authoritative** .

This matches how Celery / Temporal / Sidekiq work internally.

---

## PHASE 6 — SCALING & KUBERNETES READINESS

### 🎯 Goal

Make the system cloud-native.

* Separate API + worker deployments
* Init container for Alembic
* Horizontal scaling
* KEDA / HPA
* Graceful shutdowns

---

## PHASE 7 — API HARDENING + FRONTEND

### 🎯 Goal

Product polish.

* Pagination correctness
* Filtering
* Admin views
* Next.js frontend

---

# 🔒 FINAL ORDER (ONE LINE)

<pre class="overflow-visible! px-0!" data-start="3544" data-end="3684"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>Alembic
→ DB constraints + indexes
→ Job state machine
→ </span><span>Worker</span><span> (Postgres only)
→ Retry + DLQ
→ Redis queue
→ K8s scaling
→ Frontend</span></span></code></div></div></pre>
