// lib/minio-client.ts — Server-side MinIO client (used in API routes only)
import { Client } from "minio";

let _client: Client | null = null;

export function getMinioClient(): Client {
    if (!_client) {
        _client = new Client({
            endPoint: process.env.MINIO_ENDPOINT || "localhost",
            port: parseInt(process.env.MINIO_PORT || "9000"),
            useSSL: process.env.MINIO_USE_SSL === "true",
            accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
            secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
        });
    }
    return _client;
}

export const INPUT_BUCKET =
    process.env.MINIO_INPUT_BUCKET || "resilient-async-job-processing-inputs";
export const OUTPUT_BUCKET =
    process.env.MINIO_OUTPUT_BUCKET || "resilient-async-job-processing-outputs";
