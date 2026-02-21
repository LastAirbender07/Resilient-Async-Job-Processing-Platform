// hooks/useFileUpload.ts
// Responsibility: file validation, server-proxied MinIO upload with XHR progress.
//
// Upload flow:
//   XHR PUT /api/minio-upload?filename=x.csv  (raw file body)
//     → Next.js server streams to MinIO via internal cluster DNS
//     → No browser-to-MinIO connection needed (browser can't resolve cluster DNS)
"use client";

import { useState, useCallback } from "react";
import { ACCEPTED_EXTENSIONS, MAX_SINGLE_PUT_BYTES } from "@/lib/constants";

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
        if (f.size > MAX_SINGLE_PUT_BYTES) {
            setError(`File exceeds the ${MAX_SINGLE_PUT_BYTES / 1024 / 1024} MB limit`);
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

    /**
     * Uploads `file` to MinIO via the /api/minio-upload proxy with real XHR progress events.
     * The Next.js server streams the body to MinIO — the browser never contacts MinIO directly.
     * Returns the MinIO object key to pass to createJob().
     */
    const uploadToMinio = useCallback(async (): Promise<string> => {
        if (useTestJson) return "test.json";
        if (!file) throw new Error("No file selected");

        setUploading(true);
        setProgress(0);

        try {
            const key = file.name;

            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", `/api/minio-upload?filename=${encodeURIComponent(key)}`);
                xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
                xhr.setRequestHeader("Content-Length", String(file.size));

                xhr.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable) {
                        setProgress(Math.round((e.loaded / e.total) * 100));
                    }
                });

                xhr.addEventListener("load", () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        setProgress(100);
                        resolve();
                    } else {
                        let msg = `Upload failed (${xhr.status})`;
                        try {
                            msg = JSON.parse(xhr.responseText).error ?? msg;
                        } catch { /* ignore */ }
                        reject(new Error(msg));
                    }
                });

                xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
                xhr.send(file);
            });

            return key;
        } finally {
            setUploading(false);
        }
    }, [file, useTestJson]);

    return { file, useTestJson, uploading, progress, error, validateAndSetFile, clearFile, selectTestJson, uploadToMinio };
}
