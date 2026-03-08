# Backend — Adding a New Job Type (Step-by-Step Guide)

This is a reference guide for "future you" — steps you will follow every time you add a new processor to this platform.

---

## What is a Job Type?

A **job type** is a named processing operation that the worker knows how to execute. Examples:
- `CSV_ROW_COUNT` — count rows in a CSV file
- `JSON_CANONICALIZE` — sort JSON keys for deterministic git diffs
- `CSV_DEDUPLICATE` — remove duplicate rows from a CSV

Each job type maps to a **Processor class** that receives a local input file path and returns a result dict.

---

## Step-by-Step: Adding a New Job Type

### 1. Register the enum

Open `backend/app/core/enums/job_type.py` and add your new type:

```python
class JobType(str, Enum):
    TEST_JOB = "TEST_JOB"
    CSV_ROW_COUNT = "CSV_ROW_COUNT"
    # ...
    MY_NEW_PROCESSOR = "MY_NEW_PROCESSOR"   # ← add here
```

### 2. Write the Processor

Create `backend/app/processors/<category>/<name>.py`:

```python
from app.processors.base import BaseProcessor

class MyNewProcessor(BaseProcessor):
    def process(self, payload: dict) -> dict:
        """
        payload keys (always present):
          job_id          - str UUID
          job_type        - str enum value
          input_file_path - str, absolute local path to downloaded input file
          input_metadata  - dict, caller-provided config
        
        Return a JSON-serializable dict. This becomes result.json in MinIO.
        """
        input_path = payload["input_file_path"]
        meta = payload.get("input_metadata", {})
        
        # Do your processing here
        result = {"status": "ok", "rows": 42}
        
        return result
```

### 3. Register the Processor

Open `backend/app/processors/registry.py` and add:

```python
from app.processors.my_category.my_processor import MyNewProcessor

PROCESSORS = {
    ...
    JobType.MY_NEW_PROCESSOR: MyNewProcessor(),
}
```

### 4. (Optional) Validate input_metadata

If your processor needs specific metadata keys, add validation in `backend/app/core/job_factory.py`:

```python
def build_input_metadata(job_type, input_file_path, input_metadata):
    if job_type == JobType.MY_NEW_PROCESSOR:
        return {
            "my_required_key": input_metadata.get("my_required_key", "default_value"),
        }
    # ... other types
```

### 5. Update the Frontend

Open `frontend/lib/api.ts` and add the label:

```typescript
export const JOB_TYPE_LABELS: Record<JobType, string> = {
  TEST_JOB:           "Test Run",
  CSV_ROW_COUNT:      "CSV Row Count",
  // ...
  MY_NEW_PROCESSOR:   "My New Processor",   // ← add here
};
```

`JobTypeSelector.tsx` picks this up automatically — no changes needed there.

---

## Current Processors (Reference)

| Job Type            | File                                   | Input | Output                    |
| ------------------- | -------------------------------------- | ----- | ------------------------- |
| `TEST_JOB`          | `processors/json/test.py` (or similar) | Any   | `{"status": "ok"}`        |
| `CSV_ROW_COUNT`     | `processors/csv/row_count.py`          | CSV   | `{"row_count": N}`        |
| `CSV_COLUMN_STATS`  | `processors/csv/column_stats.py`       | CSV   | Per-column stats dict     |
| `CSV_DEDUPLICATE`   | `processors/csv/deduplicate.py`        | CSV   | Deduplicated rows + count |
| `JSON_CANONICALIZE` | `processors/json/canonicalize.py`      | JSON  | Sorted/canonical JSON     |

---

## Design Rules (Don't Break These)

1. **Processors must be stateless.** No instance variables that change between calls. The registry creates one singleton per type.
2. **Processors read from local filesystem, not MinIO.** The worker downloads the file before calling `process()`. Processors should never instantiate `StorageClient`.
3. **Processors always return a dict.** The worker serializes this to `result.json` using `json.dump`. Don't return strings, lists, or non-serializable types at the top level.
4. **Processors must not catch all exceptions.** Let exceptions bubble up to the worker — it handles `FAILED` state and notifications.
5. **Never access `context` or `notifications` in a processor.** Those are platform concerns handled by the worker and dispatcher, not processor business.