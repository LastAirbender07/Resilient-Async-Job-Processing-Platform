# Frontend — Architecture

## Design Philosophy

The frontend was built to follow the **Single Responsibility Principle (SRP)** rigorously. Every file — whether a component, hook, or utility — has one job and one reason to change.

The key split is:
- **Hooks** own all logic: state, data fetching, timers, side effects
- **Components** own rendering only: they read props/hook state and return JSX

---

## Directory Structure

```
frontend/
├── app/
│   ├── page.tsx                    ← thin layout assembler (~80 lines)
│   ├── globals.css                 ← design tokens (CSS vars) + utility classes
│   ├── layout.tsx                  ← Next.js root layout
│   └── api/
│       ├── presign/route.ts        ← return MinIO presigned PUT URL
│       ├── upload/route.ts         ← small-file fallback upload
│       └── result/route.ts         ← stream output file from MinIO
│   └── components/
│       ├── UploadPanel.tsx         ← file source + job type + submit form
│       ├── JobTracker.tsx          ← live job status display
│       ├── JobHistory.tsx          ← paginated job table
│       └── StatusBadge.tsx         ← coloured status pill (pure UI)
│
├── components/                     ← shared, reusable UI components
│   ├── layout/
│   │   ├── Header.tsx              ← sticky header with health indicator
│   │   └── Footer.tsx              ← static footer
│   ├── tracker/
│   │   ├── ProgressBar.tsx         ← 3-step job lifecycle bar
│   │   └── JobResult.tsx           ← fetches + displays output file
│   ├── upload/
│   │   ├── DropZone.tsx            ← drag-drop / browse file input UI
│   │   └── JobTypeSelector.tsx     ← grid of processor type buttons
│   └── ui/
│       ├── Spinner.tsx             ← reusable CSS spinner
│       └── ErrorBanner.tsx         ← inline error display
│
├── hooks/                          ← all stateful logic lives here
│   ├── useBackendHealth.ts         ← polls /health every 15 s
│   ├── useFileUpload.ts            ← validation + presigned upload + progress
│   ├── useJobPoller.ts             ← polls a single job until terminal
│   └── useJobHistory.ts            ← list + pagination + auto-refresh + retry
│
└── lib/
    ├── api.ts                      ← typed backend API client (all fetch calls)
    ├── constants.ts                ← TERMINAL_STATUSES, PROGRESS_STEPS, etc.
    └── minio-client.ts             ← singleton MinIO client (server-side only)
```

---

## Hook Responsibilities

| Hook               | Owns                                            | Exposed to component                                        |
| ------------------ | ----------------------------------------------- | ----------------------------------------------------------- |
| `useBackendHealth` | 15 s polling interval, fetch                    | `status: 'checking' \| 'online' \| 'offline'`               |
| `useFileUpload`    | file validation, presign request, XHR upload    | `file`, `progress`, `uploading`, `error`, `uploadToMinio()` |
| `useJobPoller`     | 2 s polling, auto-stop on terminal, retry       | `job`, `retrying`, `retry()`                                |
| `useJobHistory`    | list fetch, pagination, 5 s auto-refresh, retry | `jobs`, `page`, `totalPages`, `retry()`, `goToPage()`       |

---

## Data Flow

### Upload & Job Creation
```
User picks file
    │
    ▼
DropZone (UI event) → useFileUpload.validateAndSetFile()
    │
    ▼  [on submit]
useFileUpload.uploadToMinio()
    ├─ GET /api/presign?filename=x.csv   ← Next.js route ← MinIO SDK (server)
    │       returns { url, key }
    └─ XHR PUT <presigned url>           ← browser → MinIO directly
           (with progress events)
    │
    ▼
lib/api.ts createJob({ job_type, input_file_path: key })
    │
    ▼
POST http://backend:5001/jobs           ← backend creates job, enqueues to Redis
    │
    ▼
onJobCreated(job) → page.tsx sets activeJobId
```

### Live Tracking
```
activeJobId set
    │
    ▼
useJobPoller starts polling
    │  every 2 s
    ▼
GET http://backend:5001/jobs/:id
    │
    ├── status = QUEUED / PROCESSING → continue polling
    └── status = COMPLETED / FAILED / DEAD → clearInterval, stop
                │
                └── if COMPLETED + output_file_path exists:
                        JobResult component fetches:
                        GET /api/result?key=outputs/...
                            │
                            └── Next.js route → MinIO getObject()
                                → streams response (no RAM buffering)
```

---

## API Routes (Server-Side Only)

These run inside Next.js server — the browser never calls MinIO directly.

| Route          | Method | Purpose                           | Key detail                              |
| -------------- | ------ | --------------------------------- | --------------------------------------- |
| `/api/presign` | GET    | Returns a MinIO presigned PUT URL | 15-min TTL, validates extension         |
| `/api/upload`  | POST   | Small-file fallback (multipart)   | Kept for compatibility                  |
| `/api/result`  | GET    | Streams output file from MinIO    | Uses `Readable.toWeb()` — no RAM buffer |

### Why Presigned URLs for Upload?

The original implementation buffered the entire file in the Next.js server before sending it to MinIO. For a platform designed to process large datasets, this is a bottleneck — the server RAM becomes the limiting factor.

With presigned URLs:
- Browser uploads **directly to MinIO** (no data touches the Next.js server)
- Upload speed is no longer limited by the Node.js process
- Real `XMLHttpRequest` progress events work natively
- Files of any size are supported (up to MinIO's object size limit)

---

## Design Token Strategy

All colours, spacing, and surface values are defined **once** in `globals.css` as CSS custom properties:

```css
:root {
  --bg:          #07070f;
  --surface:     #0d0d1a;
  --accent:      #7c3aed;
  --accent-2:    #a855f7;
  --error:       #f87171;
  /* ... */
}
```

Components reference these via inline `style={{ color: 'var(--accent)' }}` or CSS utility classes. There are **no JS colour constants** duplicating these — the old `const C = { bg: '#07070f', ... }` pattern was removed during the refactor.

---

## State Management

There is no global state library (no Redux, no Zustand). State is local to the hook or component that owns it. The only cross-component communication is:

```
page.tsx
  │
  ├── activeJobId state
  │     → passed as prop to <JobTracker jobId={activeJobId} />
  │
  └── historyRefresh counter (incremented on job create)
        → passed as prop to <JobHistory refreshTrigger={historyRefresh} />
```

This is intentionally simple. The platform has one user workflow — there's no need for a state bus.
