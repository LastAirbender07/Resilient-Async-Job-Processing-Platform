// lib/api.ts — Typed backend API client
// API_URL points to the catch-all proxy at /api/backend/[...path].
// That route reads BACKEND_API_URL at request time (truly runtime — not build time).
// Never use NEXT_PUBLIC_ here: those are baked into the client bundle at build time.
export const API_URL = "/api/backend";

export type JobStatus =
  | "CREATED"
  | "QUEUED"
  | "PROCESSING"
  | "RETRYING"
  | "FAILED"
  | "COMPLETED"
  | "DEAD";

export type JobType =
  | "TEST_JOB"
  | "CSV_ROW_COUNT"
  | "CSV_COLUMN_STATS"
  | "CSV_DEDUPLICATE"
  | "JSON_CANONICALIZE";

export interface JobCreateRequest {
  job_type: JobType;
  input_file_path: string;
  input_metadata?: Record<string, unknown>;
  max_retries?: number;
}

export interface JobCreateResponse {
  job_id: string;
  status: JobStatus;
}

export interface JobStatusResponse {
  job_id: string;
  job_type: JobType;
  status: JobStatus;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  input_file_path: string;
  output_file_path: string | null;
  created_at: string;
  updated_at: string;
  next_run_at: string | null;
  finished_at: string | null;
}

export interface JobListResponse {
  items: JobStatusResponse[];
  total: number;
  limit: number;
  offset: number;
}

export async function createJob(payload: JobCreateRequest): Promise<JobCreateResponse> {
  const res = await fetch(`${API_URL}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to create job");
  }
  return res.json();
}

export async function getJob(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`${API_URL}/jobs/${jobId}`);
  if (!res.ok) throw new Error("Failed to fetch job");
  return res.json();
}

export async function listJobs(limit = 20, offset = 0): Promise<JobListResponse> {
  const res = await fetch(`${API_URL}/jobs?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error("Failed to list jobs");
  return res.json();
}

export async function retryJob(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`${API_URL}/jobs/${jobId}/retry`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to retry job");
  }
  return res.json();
}

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  TEST_JOB: "Test Job",
  CSV_ROW_COUNT: "CSV Row Count",
  CSV_COLUMN_STATS: "CSV Column Stats",
  CSV_DEDUPLICATE: "CSV Deduplicate",
  JSON_CANONICALIZE: "JSON Canonicalize",
};

export const STATUS_ORDER: JobStatus[] = [
  "CREATED",
  "QUEUED",
  "PROCESSING",
  "RETRYING",
  "COMPLETED",
  "FAILED",
  "DEAD",
];

export const TERMINAL_STATUSES: JobStatus[] = ["COMPLETED", "FAILED", "DEAD"];
