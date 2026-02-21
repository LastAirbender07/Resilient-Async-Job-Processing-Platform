// lib/constants.ts — Shared constants for job status and type logic.
// Single source of truth — imported by API client, hooks, and components.

import type { JobStatus } from "./api";

/** Statuses that mean the job has finished (success or failure). */
export const TERMINAL_STATUSES: JobStatus[] = ["COMPLETED", "FAILED", "DEAD"];

/** Ordered sequence of all statuses for display/sorting. */
export const STATUS_ORDER: JobStatus[] = [
    "CREATED",
    "QUEUED",
    "PROCESSING",
    "RETRYING",
    "COMPLETED",
    "FAILED",
    "DEAD",
];

/** The three progress steps shown in the tracker progress bar. */
export const PROGRESS_STEPS: JobStatus[] = ["QUEUED", "PROCESSING", "COMPLETED"];

/** Accepted file extensions for job input files. */
export const ACCEPTED_EXTENSIONS = ["json", "csv"] as const;

/** Max file size accepted by the /api/minio-upload server-side proxy (500 MB).
 *  Files larger than this would need chunked/multipart upload (future work). */
export const MAX_SINGLE_PUT_BYTES = 500 * 1024 * 1024;
