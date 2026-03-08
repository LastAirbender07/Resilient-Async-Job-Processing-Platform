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

/**
 * Files at or below this size are uploaded via a single PUT to /api/minio-upload.
 * Files above this size are uploaded via the multipart upload protocol
 * (/api/multipart/initiate → /api/multipart/part × N → /api/multipart/complete).
 *
 * 500 MB is a sensible threshold: single PUTs are simpler and faster for small
 * files, while multipart gives chunk-level retry and progress for large files.
 */
export const MAX_SINGLE_PUT_BYTES = 500 * 1024 * 1024; // 500 MB

/**
 * Size of each chunk in a multipart upload.
 * MinIO requires parts to be ≥5 MB (except the last). 16 MB is the sweet spot:
 * - Well above MinIO's 5 MB minimum, so the last-part exception rarely matters
 * - Small enough that the Next.js server-side buffer (16 MB per request) stays
 *   well within the frontend pod memory limit (512 Mi) alongside Node.js overhead
 * - Large enough to be efficient (a 600 MB file = ~38 parts, not thousands)
 *
 * Why not 64 MB?  At 64 MB per chunk, the peak RSS (chunk buffer + fetch() body
 * duplication + Next.js base ~130 MB) exceeds 250 MB, which caused OOMKilled
 * at the previous 256 Mi pod limit.
 */
export const MULTIPART_CHUNK_SIZE = 16 * 1024 * 1024; // 16 MB

/**
 * Hard upper limit on file size — enforced client-side before the upload starts.
 * MinIO's single-object PUT limit is 5 GB. Multipart uploads support up to 5 TB
 * (10,000 parts × 500 MB each), but we keep the guard at 5 GB for simplicity.
 * Raise this constant if you need to test with files larger than 5 GB.
 */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB
