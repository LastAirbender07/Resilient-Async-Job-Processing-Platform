## 0️⃣ Important architectural clarification (very important)

### ❌ Do NOT build MinIO from source for this project

Reasons:

1. Your goal is  **platform architecture** , not MinIO internals
2. You want **repeatability** across machines and CI
3. Dockerized MinIO is:
   * Standard
   * Industry-accepted
   * Used in real production stacks
4. Building from source adds **zero architectural value** here

> For learning MinIO internals → source build
>
> For building systems → Docker

So we will use  **official MinIO Docker image** .

This does **not** violate AGPL for local/dev usage.

---

## 1️⃣ Target architecture (what we are building)

<pre class="overflow-visible! px-0!" data-start="1043" data-end="1609"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>┌────────────┐        ┌──────────────┐
│  Client    │        │   MiniIO     │
│ (curl/API) │──────▶ │  S3 </span><span>Storage</span><span>  │
└────────────┘        └──────────────┘
        │
        ▼
┌──────────────────────────────┐
│        Backend API           │
│  - Creates job               │
│  - Stores </span><span>input</span><span> metadata     │
└──────────────────────────────┘
        │
        ▼
┌──────────────────────────────┐
│        Worker                │
│  - Downloads </span><span>input</span><span></span><span>from</span><span> S3   │
│  - Processes file            │
│  - Uploads output </span><span>to</span><span> S3      │
└──────────────────────────────┘
</span></span></code></div></div></pre>

Buckets:

* `job-inputs`
* `job-outputs`

---

## 2️⃣ Step 1 — Add MinIO to `docker-compose.yml`

Edit your existing `docker-compose.yml`.

### Add this service:

<pre class="overflow-visible! px-0!" data-start="1773" data-end="2107"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-yaml"><span><span>minio:</span><span>
  </span><span>image:</span><span></span><span>minio/minio:latest</span><span>
  </span><span>container_name:</span><span></span><span>minio</span><span>
  </span><span>command:</span><span></span><span>server</span><span></span><span>/data</span><span></span><span>--console-address</span><span></span><span>":9001"</span><span>
  </span><span>environment:</span><span>
    </span><span>MINIO_ROOT_USER:</span><span></span><span>minioadmin</span><span>
    </span><span>MINIO_ROOT_PASSWORD:</span><span></span><span>minioadmin</span><span>
  </span><span>ports:</span><span>
    </span><span>-</span><span></span><span>"9000:9000"</span><span></span><span># S3 API</span><span>
    </span><span>-</span><span></span><span>"9001:9001"</span><span></span><span># Console UI</span><span>
  </span><span>volumes:</span><span>
    </span><span>-</span><span></span><span>minio_data:/data</span><span>
  </span><span>networks:</span><span>
    </span><span>-</span><span></span><span>backend</span><span>
</span></span></code></div></div></pre>

### Add this init container (bucket creation):

<pre class="overflow-visible! px-0!" data-start="2157" data-end="2486"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-yaml"><span><span>minio-init:</span><span>
  </span><span>image:</span><span></span><span>minio/mc:latest</span><span>
  </span><span>depends_on:</span><span>
    </span><span>-</span><span></span><span>minio</span><span>
  </span><span>entrypoint:</span><span> >
    /bin/sh -c "
    mc alias set local http://minio:9000 minioadmin minioadmin &&
    mc mb --ignore-existing local/job-inputs &&
    mc mb --ignore-existing local/job-outputs &&
    echo 'Buckets created'
    "
  </span><span>networks:</span><span>
    </span><span>-</span><span></span><span>backend</span><span>
</span></span></code></div></div></pre>

### Add volume:

<pre class="overflow-visible! px-0!" data-start="2505" data-end="2539"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-yaml"><span><span>volumes:</span><span>
  </span><span>minio_data:</span><span>
</span></span></code></div></div></pre>

✅ This ensures buckets are always present.

---

## 3️⃣ Step 2 — Start MinIO locally

Run:

<pre class="overflow-visible! px-0!" data-start="2633" data-end="2682"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker compose up -d minio minio-init
</span></span></code></div></div></pre>

Verify:

* Console: [http://localhost:9001]()

  Login: `minioadmin / minioadmin`

You should see:

* `job-inputs`
* `job-outputs`

---

## 4️⃣ Step 3 — Install MinIO client (`mc`) locally (optional but recommended)

### macOS:

<pre class="overflow-visible! px-0!" data-start="2908" data-end="2948"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>brew install minio/stable/mc
</span></span></code></div></div></pre>

```
backend % brew install minio-mc
==> Fetching downloads for: minio-mc
✔︎ Bottle Manifest minio-mc (2025-08-13T08-35-41Z)                                  Downloaded    9.8KB/  9.8KB
✔︎ Bottle minio-mc (2025-08-13T08-35-41Z)                                           Downloaded   10.2MB/ 10.2MB
==> Pouring minio-mc--2025-08-13T08-35-41Z.arm64_tahoe.bottle.tar.gz
🍺  /opt/homebrew/Cellar/minio-mc/2025-08-13T08-35-41Z: 7 files, 28.8MB
==> Running `brew cleanup minio-mc`...
Disable this behaviour by setting `HOMEBREW_NO_INSTALL_CLEANUP=1`.
Hide these hints with `HOMEBREW_NO_ENV_HINTS=1` (see `man brew`).
```

### Verify:

<pre class="overflow-visible! px-0!" data-start="2962" data-end="3048"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>mc </span><span>alias</span><span></span><span>set</span><span></span><span>local</span><span> http://localhost:9000 minioadmin minioadmin
mc </span><span>ls</span><span></span><span>local</span><span>
</span></span></code></div></div></pre>

docker compose up -d minio minio-init

check logs: `docker logs backend-minio-init-1`

locally doc this: `mc ls local`

```
(Resilient-Async-Job-Processing-Platform) i750332@GR2F96R7YN Resilient-Async-Job-Processing-Platform % echo '{"hello": "world"}' > test.json
(Resilient-Async-Job-Processing-Platform) i750332@GR2F96R7YN Resilient-Async-Job-Processing-Platform % mc cp test.json local/resilient-async-job-processing-inputs/test.json
...rm/test.json: 19 B / 19 B  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  502 B/s 0s
(Resilient-Async-Job-Processing-Platform) i750332@GR2F96R7YN Resilient-Async-Job-Processing-Platform % 
```

---

## 5️⃣ Step 4 — Define storage config in your backend

Create  **one single source of truth** .

### `app/core/settings.py`

<pre class="overflow-visible! px-0!" data-start="3178" data-end="3411"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-python"><span><span>class</span><span></span><span>Settings</span><span>:
    S3_ENDPOINT = </span><span>"http://minio:9000"</span><span>
    S3_ACCESS_KEY = </span><span>"minioadmin"</span><span>
    S3_SECRET_KEY = </span><span>"minioadmin"</span><span>
    S3_INPUT_BUCKET = </span><span>"job-inputs"</span><span>
    S3_OUTPUT_BUCKET = </span><span>"job-outputs"</span><span>
    S3_REGION = </span><span>"us-east-1"</span><span>
</span></span></code></div></div></pre>

This is **intentionally generic** → reusable in future projects.

---

## 6️⃣ Step 5 — Implement `output_store.py` properly

### `app/workers/output_store.py`

<pre class="overflow-visible! px-0!" data-start="3573" data-end="4131"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-python"><span><span>import</span><span> boto3
</span><span>from</span><span> app.core.settings </span><span>import</span><span> Settings

s3 = boto3.client(
    </span><span>"s3"</span><span>,
    endpoint_url=Settings.S3_ENDPOINT,
    aws_access_key_id=Settings.S3_ACCESS_KEY,
    aws_secret_access_key=Settings.S3_SECRET_KEY,
    region_name=Settings.S3_REGION,
)

</span><span>def</span><span></span><span>store_output</span><span>(</span><span>job_id: str</span><span>, content: </span><span>bytes</span><span>) -> </span><span>str</span><span>:
    key = </span><span>f"{job_id}</span><span>/result.json"

    s3.put_object(
        Bucket=Settings.S3_OUTPUT_BUCKET,
        Key=key,
        Body=content,
        ContentType=</span><span>"application/json"</span><span>,
    )

    </span><span>return</span><span></span><span>f"s3://{Settings.S3_OUTPUT_BUCKET}</span><span>/</span><span>{key}</span><span>"
</span></span></code></div></div></pre>

Now:

* Output is **real**
* Output is **downloadable**
* Output is **persistent**

---

## 7️⃣ Step 6 — Upload real input files

Example:

<pre class="overflow-visible! px-0!" data-start="4272" data-end="4336"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>mc </span><span>cp</span><span> sample.csv </span><span>local</span><span>/job-inputs/uploads/sample.csv
</span></span></code></div></div></pre>

You now have a  **real object** .

---

## 8️⃣ Step 7 — Update job creation contract (critical)

Your job  **must not accept raw files** .

### Correct API contract:

<pre class="overflow-visible! px-0!" data-start="4500" data-end="4632"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-json"><span><span>{</span><span>
  </span><span>"job_type"</span><span>:</span><span></span><span>"CSV_ROW_COUNT"</span><span>,</span><span>
  </span><span>"input_metadata"</span><span>:</span><span></span><span>{</span><span>
    </span><span>"bucket"</span><span>:</span><span></span><span>"job-inputs"</span><span>,</span><span>
    </span><span>"key"</span><span>:</span><span></span><span>"uploads/sample.csv"</span><span>
  </span><span>}</span><span>
</span><span>}</span><span>
</span></span></code></div></div></pre>

This is  **exactly how real systems work** .

---

## 9️⃣ Step 8 — Worker downloads input from MinIO

In `worker.py`:

<pre class="overflow-visible! px-0!" data-start="4751" data-end="4894"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-python"><span><span>def</span><span></span><span>download_input</span><span>(</span><span>bucket: str</span><span>, key: </span><span>str</span><span>) -> </span><span>bytes</span><span>:
    obj = s3.get_object(Bucket=bucket, Key=key)
    </span><span>return</span><span> obj[</span><span>"Body"</span><span>].read()
</span></span></code></div></div></pre>

Processors now operate on  **real bytes** , not fake paths.

---

## 🔟 Step 9 — End-to-end test (THIS IS THE PAYOFF)

1. Upload file to MinIO
2. Create job via API
3. Worker processes it
4. Output appears in `job-outputs`
5. Download result via UI or `mc`

This is  **true E2E** .

---

## 1️⃣1️⃣ Why this is reusable for future projects

Because you now have:

* Storage abstraction
* S3-compatible API
* Zero vendor lock-in
* Drop-in replacement with AWS S3 later

In AWS:

<pre class="overflow-visible! px-0!" data-start="5367" data-end="5398"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-python"><span><span>endpoint_url=</span><span>None</span><span>
</span></span></code></div></div></pre>

Everything else stays the same.
