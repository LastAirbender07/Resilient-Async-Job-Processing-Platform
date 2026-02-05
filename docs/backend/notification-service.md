# High-Level Goal (Reconfirmed)

We are implementing  **notification readiness** , not email yet.

> After this phase:

* Jobs can **declare notification intent**
* Platform can **emit job lifecycle events**
* No provider logic
* No external calls
* No behavior change yet

This keeps the platform clean and extensible.

---

# Phase 1 — Lock Job Notification Contract (MOST IMPORTANT)

This phase affects  **schemas, DB model, repository, and route validation** .

We do this first because  **everything else depends on it** .

---

## Step 1️⃣ Update API Contract (Schemas)

### Files involved

<pre class="overflow-visible! px-0!" data-start="971" data-end="1066"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(var(--sticky-padding-top)+9*var(--spacing))]"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>schemas</span><span>/job.py
</span><span>schemas</span><span>/job_type.py   (maybe)
</span><span>schemas</span><span>/job_status.py (probably </span><span>no</span><span> change)
</span></span></code></div></div></pre>

### What we are introducing

Two new **top-level** fields in job creation:

<pre class="overflow-visible! px-0!" data-start="1144" data-end="1302"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(var(--sticky-padding-top)+9*var(--spacing))]"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-json"><span><span>context</span><span>:</span><span></span><span>{</span><span>
  </span><span>"user_id"</span><span>:</span><span></span><span>"string"</span><span>,</span><span>
  </span><span>"email"</span><span>:</span><span></span><span>"string"</span><span>
</span><span>}</span><span>

notifications</span><span>:</span><span></span><span>{</span><span>
  </span><span>"email"</span><span>:</span><span></span><span>{</span><span>
    </span><span>"enabled"</span><span>:</span><span></span><span>true</span><span></span><span>,</span><span>
    </span><span>"on"</span><span>:</span><span></span><span>[</span><span>"SUCCESS"</span><span>,</span><span></span><span>"FAILURE"</span><span>]</span><span>
  </span><span>}</span><span>
</span><span>}</span><span>
</span></span></code></div></div></pre>

### Design rules (important)

* Both fields are **optional**
* Platform never validates ownership
* Platform validates **shape only**
* Email format validation: **yes**
* Semantic validation (who owns email): **no**

### Action

Before I tell you *exactly* what to change, I need to see:

📄 **Please share `schemas/job.py`**

This is the contract anchor.

---

## Step 2️⃣ Persist Notification Intent (DB Model)

Once the API accepts it, we must  **persist it** .

### Files involved

<pre class="overflow-visible! px-0!" data-start="1785" data-end="1878"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(var(--sticky-padding-top)+9*var(--spacing))]"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>db/models/job.py
models/job.py
repositories/job_repository.py
repositories/mappers.py
</span></span></code></div></div></pre>

### Expected DB-level change

Your `Job` table should gain  **two JSON columns** :

* `context JSONB`
* `notifications JSONB`

No normalization. No foreign keys. No users table.

### Design rule

> Job is the **only aggregate root**

### Action

Before proposing changes, I need to see:

📄 **Please share `db/models/job.py`**

This tells me:

* ORM (SQLAlchemy version)
* How migrations are handled
* Existing columns

---

## Step 3️⃣ Route Validation & Creation Flow

Once schema + DB support exists, the route must  **pass-through** , not interpret.

### Files involved

<pre class="overflow-visible! px-0!" data-start="2447" data-end="2528"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(var(--sticky-padding-top)+9*var(--spacing))]"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>routes/jobs.py
repositories/job_repository.py
core/job_factory.py (maybe)
</span></span></code></div></div></pre>

### What must happen

* Route validates schema
* Route does NOT inspect notifications
* Route passes data untouched to repository
* Repository persists it

### Action

Please share:

📄 **`routes/jobs.py`**

I want to confirm:

* Where creation happens
* Where validation errors are raised
* How job payload is constructed

---

# Phase 2 — Notification Dispatcher (Interface Only)

No behavior change yet.

---

## Step 4️⃣ Introduce Notification Abstraction

### New files to be added

<pre class="overflow-visible! px-0!" data-start="3014" data-end="3095"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(var(--sticky-padding-top)+9*var(--spacing))]"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>core/notifications/
  ├── __init__.py
  ├── dispatcher.py
  └── events.py
</span></span></code></div></div></pre>

### Responsibilities

#### `events.py`

<pre class="overflow-visible! px-0!" data-start="3136" data-end="3195"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(var(--sticky-padding-top)+9*var(--spacing))]"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-python"><span><span>class</span><span></span><span>JobEvent</span><span>(</span><span>Enum</span><span>):
    SUCCESS
    FAILURE
</span></span></code></div></div></pre>

#### `dispatcher.py`

<pre class="overflow-visible! px-0!" data-start="3218" data-end="3328"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(var(--sticky-padding-top)+9*var(--spacing))]"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-python"><span><span>class</span><span></span><span>NotificationDispatcher</span><span>:
    </span><span>def</span><span></span><span>dispatch</span><span>(</span><span>self, job, event: JobEvent</span><span>) -> </span><span>None</span><span>:
        </span><span>pass</span><span>
</span></span></code></div></div></pre>

No implementation yet. Just logs.

This is intentional.

---

## Step 5️⃣ Wire Worker → Dispatcher (No side effects)

### Files involved

<pre class="overflow-visible! px-0!" data-start="3467" data-end="3492"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(var(--sticky-padding-top)+9*var(--spacing))]"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>workers/worker.py
</span></span></code></div></div></pre>

### Behavior

* On job success → emit SUCCESS event
* On job failure → emit FAILURE event
* Dispatcher logs intent
* Job lifecycle unchanged

### Action

Before touching this, I need to see:

📄 **`workers/worker.py`**

Specifically:

* Where success is marked
* Where failure is caught
* Retry logic boundaries

---

# Phase 3 — Mailgun (Later, NOT NOW)

We explicitly  **do not implement Mailgun yet** .

Why?

* Contract must stabilize first
* Dispatcher API must exist
* Worker semantics must be correct

Mailgun will come  **after Helm** , not before.
