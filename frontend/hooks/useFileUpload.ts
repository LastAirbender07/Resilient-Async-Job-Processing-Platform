// hooks/useFileUpload.ts
// Responsibility: file validation, upload with XHR progress.
//
// Upload routing (automatic, based on file size):
//   file.size <= MAX_SINGLE_PUT_BYTES (500 MB)
//     → Single PUT to /api/minio-upload (existing path, unchanged)
//       XHR progress events work natively from browser to Next.js server.
//
//   file.size > MAX_SINGLE_PUT_BYTES (→ up to MAX_FILE_SIZE_BYTES = 5 GB)
//     → Multipart upload via 3 server-side routes:
//       1. POST /api/multipart/initiate  → { uploadId, key }
//       2. PUT  /api/multipart/part × N  → { etag } per 64 MB chunk
//       3. POST /api/multipart/complete  → { key }
//       Progress = bytesUploaded / file.size (updated after each chunk)
//
// In both cases the browser never contacts MinIO directly.
// Next.js server → MinIO uses internal cluster DNS.
"use client";

import { useState, useCallback } from "react";
import {
    ACCEPTED_EXTENSIONS,
    MAX_SINGLE_PUT_BYTES,
    MULTIPART_CHUNK_SIZE,
    MAX_FILE_SIZE_BYTES,
} from "@/lib/constants";

export interface UploadState {
    file: File | null;
    useTestJson: boolean;
    uploading: boolean;
    /** Upload progress 0–100. Only meaningful while uploading === true. */
    progress: number;
    error: string | null;
}

interface UseFileUploadResult extends UploadState {
    validateAndSetFile: (f: File) => void;
    clearFile: (e: React.MouseEvent) => void;
    selectTestJson: () => void;
    /** Uploads the selected file to MinIO via the server-side proxy.
     *  Returns the MinIO object key on success, throws on error. */
    uploadToMinio: () => Promise<string>;
}

export function useFileUpload(): UseFileUploadResult {
    const [file, setFile] = useState<File | null>(null);
    const [useTestJson, setUseTestJson] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const validateAndSetFile = useCallback((f: File) => {
        const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
        if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
            setError(`Only ${ACCEPTED_EXTENSIONS.join(", ")} files are supported`);
            return;
        }
        if (f.size > MAX_FILE_SIZE_BYTES) {
            const gb = (MAX_FILE_SIZE_BYTES / 1024 / 1024 / 1024).toFixed(0);
            setError(`File exceeds the ${gb} GB limit`);
            return;
        }
        setError(null);
        setFile(f);
        setUseTestJson(false);
    }, []);

    const clearFile = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setFile(null);
        setError(null);
        setProgress(0);
    }, []);

    const selectTestJson = useCallback(() => {
        setUseTestJson(true);
        setFile(null);
        setError(null);
        setProgress(0);
    }, []);

    // ── Single-PUT path (files ≤ 500 MB) ────────────────────────────────────
    // Uses a real XHR so the browser reports upload progress natively.
    // The Next.js server streams the body to MinIO without buffering in RAM.
    const uploadSinglePut = useCallback(
        (f: File): Promise<string> => {
            const key = f.name;
            return new Promise<string>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", `/api/minio-upload?filename=${encodeURIComponent(key)}`);
                xhr.setRequestHeader("Content-Type", f.type || "application/octet-stream");
                xhr.setRequestHeader("Content-Length", String(f.size));

                xhr.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable) {
                        setProgress(Math.round((e.loaded / e.total) * 100));
                    }
                });

                xhr.addEventListener("load", () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        setProgress(100);
                        resolve(key);
                    } else {
                        let msg = `Upload failed (${xhr.status})`;
                        try {
                            msg = JSON.parse(xhr.responseText).error ?? msg;
                        } catch { /* ignore */ }
                        reject(new Error(msg));
                    }
                });

                xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
                xhr.send(f);
            });
        },
        []
    );

    // ── Multipart path (files > 500 MB) ─────────────────────────────────────
    // Slices the file into MULTIPART_CHUNK_SIZE (64 MB) Blob chunks.
    // Each chunk is sent as a separate PUT to /api/multipart/part, which
    // buffers the 64 MB chunk and calls MinIO's UploadPart operation.
    // Progress is updated after each chunk completes.
    const uploadMultipart = useCallback(
        async (f: File): Promise<string> => {
            const key = f.name;

            // 1. Initiate — get uploadId from MinIO
            const initiateRes = await fetch(
                `/api/multipart/initiate?filename=${encodeURIComponent(key)}`,
                { method: "POST" }
            );
            if (!initiateRes.ok) {
                const body = await initiateRes.json().catch(() => ({}));
                throw new Error(body.error ?? "Failed to initiate multipart upload");
            }
            const { uploadId } = await initiateRes.json();

            // 2. Upload parts sequentially
            const totalChunks = Math.ceil(f.size / MULTIPART_CHUNK_SIZE);
            const parts: { partNumber: number; etag: string }[] = [];
            let bytesUploaded = 0;

            for (let i = 0; i < totalChunks; i++) {
                const partNumber = i + 1; // MinIO is 1-indexed
                const start = i * MULTIPART_CHUNK_SIZE;
                const end = Math.min(start + MULTIPART_CHUNK_SIZE, f.size);
                const chunk = f.slice(start, end);

                const partRes = await fetch(
                    `/api/multipart/part?uploadId=${encodeURIComponent(uploadId)}&key=${encodeURIComponent(key)}&partNumber=${partNumber}`,
                    {
                        method: "PUT",
                        body: chunk,
                        headers: {
                            "Content-Length": String(chunk.size),
                        },
                        // duplex required in some environments when streaming a body
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ...(typeof window !== "undefined" ? {} : { duplex: "half" } as any),
                    }
                );

                if (!partRes.ok) {
                    const body = await partRes.json().catch(() => ({}));
                    throw new Error(body.error ?? `Failed to upload part ${partNumber}`);
                }

                const { etag } = await partRes.json();
                parts.push({ partNumber, etag });

                bytesUploaded += chunk.size;
                setProgress(Math.round((bytesUploaded / f.size) * 100));
            }

            // 3. Complete — tell MinIO to assemble the parts
            const completeRes = await fetch("/api/multipart/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uploadId, key, parts }),
            });

            if (!completeRes.ok) {
                const body = await completeRes.json().catch(() => ({}));
                throw new Error(body.error ?? "Failed to complete multipart upload");
            }

            return key;
        },
        []
    );

    // ── Public upload entry-point ───────────────────────────────────────────
    const uploadToMinio = useCallback(async (): Promise<string> => {
        if (useTestJson) return "test.json";
        if (!file) throw new Error("No file selected");

        setUploading(true);
        setProgress(0);

        try {
            // Route to the right upload strategy based on file size
            if (file.size <= MAX_SINGLE_PUT_BYTES) {
                return await uploadSinglePut(file);
            } else {
                return await uploadMultipart(file);
            }
        } finally {
            setUploading(false);
        }
    }, [file, useTestJson, uploadSinglePut, uploadMultipart]);

    return { file, useTestJson, uploading, progress, error, validateAndSetFile, clearFile, selectTestJson, uploadToMinio };
}
