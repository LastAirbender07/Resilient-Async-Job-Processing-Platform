// lib/minio-client.ts — Server-side MinIO client (used in API routes only).
//
// ⚠️  IMPORTANT: requireEnv() calls MUST stay inside functions — never at module
//    top-level. Next.js evaluates API route modules during `next build` to collect
//    page data. Any top-level env access would crash the Docker build where no
//    runtime env vars are present. Lazy getter functions solve this correctly.
import { Client } from "minio";

function requireEnv(key: string, fallback?: string): string {
    const value = process.env[key] ?? fallback;
    if (!value) {
        throw new Error(
            `[minio-client] Required env var "${key}" is not set. ` +
            `Inject it via the Helm ConfigMap or your .env.local for local dev.`
        );
    }
    return value;
}

const isDev = () => process.env.NODE_ENV !== "production";

let _client: Client | null = null;

/** Returns the singleton MinIO client. Creates it on first call (lazy). */
export function getMinioClient(): Client {
    if (!_client) {
        _client = new Client({
            endPoint: requireEnv("S3_HOST", isDev() ? "localhost" : undefined),
            port: parseInt(requireEnv("S3_PORT", isDev() ? "9000" : undefined)),
            useSSL: process.env.S3_USE_SSL === "true",
            accessKey: requireEnv("S3_ACCESS_KEY", isDev() ? "minioadmin" : undefined),
            secretKey: requireEnv("S3_SECRET_KEY", isDev() ? "minioadmin" : undefined),
        });
    }
    return _client;
}

/** Returns the input bucket name. Call inside route handlers only — never at import time. */
export function getInputBucket(): string {
    return requireEnv(
        "S3_INPUT_BUCKET",
        isDev() ? "resilient-async-job-processing-inputs" : undefined
    );
}

/** Returns the output bucket name. Call inside route handlers only — never at import time. */
export function getOutputBucket(): string {
    return requireEnv(
        "S3_OUTPUT_BUCKET",
        isDev() ? "resilient-async-job-processing-outputs" : undefined
    );
}
