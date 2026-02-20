// hooks/useFileUpload.ts
// Responsibility: file validation, presigned-URL fetch, direct-to-MinIO upload with progress.
// This keeps all upload logic out of UploadPanel — the component just renders state.
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
    /** Uploads the selected file to MinIO via a presigned URL.
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
     * Uploads `file` to MinIO via a presigned PUT URL with real XHR progress events.
     * Returns the MinIO object key to pass to createJob().
     */
    const uploadToMinio = useCallback(async (): Promise<string> => {
        if (useTestJson) return "test.json";
        if (!file) throw new Error("No file selected");

        setUploading(true);
        setProgress(0);

        try {
            // Step 1: Ask our API route for a short-lived presigned URL
            const presignRes = await fetch(
                `/api/presign?filename=${encodeURIComponent(file.name)}`
            );
            if (!presignRes.ok) {
                const err = await presignRes.json();
                throw new Error(err.error || "Failed to get upload URL");
            }
            const { url, key } = await presignRes.json();

            // Step 2: PUT the file straight to MinIO with progress tracking via XHR
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", url);
                xhr.setRequestHeader(
                    "Content-Type",
                    file.type || "application/octet-stream"
                );

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
                        reject(new Error(`Upload failed with status ${xhr.status}`));
                    }
                });

                xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
                xhr.send(file);
            });

            return key as string;
        } finally {
            setUploading(false);
        }
    }, [file, useTestJson]);

    return {
        file,
        useTestJson,
        uploading,
        progress,
        error,
        validateAndSetFile,
        clearFile,
        selectTestJson,
        uploadToMinio,
    };
}
