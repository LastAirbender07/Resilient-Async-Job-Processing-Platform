# Backend — Email Notifications (Mailtrap)

> **Status: Implemented.** Email notifications are live in the backend via Mailtrap Sandbox mode.

---

## Architecture

Notifications are a **non-blocking, fire-and-forget side effect** of job execution. They never affect job state.

```
Worker
  │
  ├── Job succeeds (COMPLETED)  ──┐
  └── Job fails (FAILED/DEAD)  ───┤
                                  ▼
                     NotificationDispatcher
                           │
                           └── MailtrapEmailProvider
                                     │
                                     └── Mailtrap API (Sandbox)
                                           ↳ Email appears in Mailtrap inbox
                                             (NOT delivered to real address)
```

**Key design rules:**
- Notification failures are **caught and logged** — they never propagate to the worker loop
- Providers are **pluggable**: Slack, Webhook, etc. can be added without touching worker logic
- The `context.email` on the job is the recipient — no users table required

---

## When Does an Email Send?

All four conditions must be true:

1. `notifications.email.enabled == true`
2. The current `JobEvent` (`SUCCESS` or `FAILURE`) is in `notifications.email.on`
3. `context.email` is a valid email address
4. `MAILTRAP_API_KEY` is set and Mailtrap is reachable

If any condition fails, the notification is silently skipped.

---

## Mailtrap Sandbox Mode (Current Limitation)

**Emails do NOT reach real inboxes.** They appear only in the Mailtrap test inbox.

This is **intentional** for a learning project:
- No domain verification needed
- Safe to use in CI, Docker Compose, or Kubernetes without risk of spamming
- Full email content is visible in the Mailtrap web UI

**To switch to real email delivery:** Set `MAILTRAP_USE_SANDBOX=false` and configure a verified sending domain in Mailtrap.

---

## Environment Variables

| Variable                | Purpose                                           |
| ----------------------- | ------------------------------------------------- |
| `MAILTRAP_API_KEY`      | Authenticates with Mailtrap API — required        |
| `MAILTRAP_USE_SANDBOX`  | `true` = sandbox inbox; `false` = real delivery   |
| `MAILTRAP_INBOX_ID`     | The sandbox inbox ID (from Mailtrap dashboard)    |
| `MAILTRAP_SENDER_EMAIL` | From address (e.g. `hello@demomailtrap.co`)       |
| `MAILTRAP_SENDER_NAME`  | From display name (e.g. `Resilient Job Platform`) |

Set these in `backend/.env` for local dev, or in the Kubernetes Secret + Helm values for cluster deployment.

---

## Code Locations

| File                                           | Purpose                                                     |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `app/core/notifications/dispatcher.py`         | Iterates providers; catches errors                          |
| `app/core/notifications/events.py`             | `JobEvent` enum (`SUCCESS`, `FAILURE`)                      |
| `app/core/notifications/providers/mailtrap.py` | Mailtrap integration                                        |
| `app/schemas/job.py`                           | `JobContext`, `JobNotifications`, `EmailNotificationConfig` |
| `app/workers/worker.py`                        | Calls `dispatcher.dispatch()` after each job                |

---

## Submitting a Job with Notifications

```bash
curl -X POST http://localhost:5001/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "job_type": "CSV_ROW_COUNT",
    "input_file_path": "test.json",
    "context": {
      "user_id": "user-123",
      "email": "your@email.com"
    },
    "notifications": {
      "email": {
        "enabled": true,
        "on": ["SUCCESS", "FAILURE"]
      }
    }
  }'
```

---

## Future Enhancements

- Switch to Mailtrap Production Sending (verified domain)
- HTML email templates
- Additional providers: Slack, Webhook
- Notification retry with back-off (currently best-effort only)
- Notification delivery audit log table
