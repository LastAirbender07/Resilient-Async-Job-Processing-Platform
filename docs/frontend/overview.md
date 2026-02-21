# Frontend — Overview

> **Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS  
> **Role in the platform:** Browser UI + thin server-side API proxy layer for MinIO

---

## What It Does

The frontend is the user-facing surface of the **Resilient Async Job Processing Platform**. Its job is simple:

1. **Accept input files** (JSON or CSV) from the user
2. **Submit a job** to the backend — choosing a processor type
3. **Track the job live** — polling status until it reaches a terminal state
4. **Display results** — streaming the output file back from MinIO
5. **Show job history** — paginated list of all past jobs with inline retry
6. **Clear storage** — an admin purge button to delete all MinIO files (except the demo `test.json`)

It talks to two things:

| Dependency                 | Protocol          | Used for                               |
| -------------------------- | ----------------- | -------------------------------------- |
| **Backend API** (`/api/*`) | HTTP REST         | Create jobs, poll status, retry        |
| **MinIO** (via API routes) | S3 API (internal) | Upload input files, fetch output files |

The browser **never talks to MinIO directly.** All MinIO interaction goes through Next.js API routes (`/api/upload`, `/api/presign`, `/api/result`), which run server-side only.

---

## Features

### Job Submission
- Drag-and-drop or browse to upload a `.json` or `.csv` file
- OR use the pre-loaded `test.json` file already in MinIO
- Select a processor type (e.g. `TEST_JOB`, `NOTIFY_JOB`, etc.)
- Progress bar shows real upload % while the file transfers

### Live Job Tracker
- Auto-polls the backend every 2 s while job is in a non-terminal state
- Stops polling automatically on `COMPLETED`, `FAILED`, or `DEAD`
- Shows a 3-step progress bar (Queued → Processing → Completed)
- Inline retry button for failed jobs that still have retries remaining
- Streams and displays the output file content when complete

### Job History
- Paginated table (8 jobs per page) of all past jobs
- Auto-refreshes every 5 s while any active jobs exist
- Clicking a row focuses the Live Tracker on that job
- Per-row retry button for eligible failed jobs

### Backend Health Indicator
- Polls `GET /health` every 15 s
- Shows a green/red dot in the header with no text clutter
- Frontend remains fully usable even when backend is offline —  
  it shows a graceful "Backend Offline" indicator, not a crash

---

## Page Structure

```
/ (Home)
├── Header          — sticky, logo, health dot, API Docs link
├── Hero            — title + subtitle
├── UploadPanel     — file input + job type selector + submit
├── JobTracker      — live status of the most recently submitted job
├── JobHistory      — paginated table of all jobs
└── Footer
```

There is intentionally **one page only**. The platform is a single-workflow tool — no routing needed.

---

## What It Is Not

- **Not a full SPA router** — no React Router, no nested routes
- **Not a data dashboard** — no charts, no analytics
- **Not a production auth surface** — no login, no session management (learning project)
- **Not responsible for job execution** — it only submits and observes; the backend + worker own execution
