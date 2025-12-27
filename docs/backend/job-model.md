### Job

Fields (initial draft):

* job_id (UUID)
* user_id
* status
* input_file_path
* output_file_path (optional)
* retry_count
* max_retries
* error_message
* created_at
* updated_at

### Job States

<pre class="overflow-visible! px-0!" data-start="1255" data-end="1331"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>CREATED</span><span> → QUEUED → PROCESSING
→ COMPLETED
→ FAILED → RETRYING → DEAD
</span></span></code></div></div></pre>

For each transition, specify:

* who triggers it (API / worker)
* when it happens
* whether it is idempotent

This document will guide:

* DB schema
* API responses
* worker logic
* frontend UI states
