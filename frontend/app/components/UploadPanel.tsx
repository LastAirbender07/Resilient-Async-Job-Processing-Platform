"use client";

import { useRef, useState } from "react";
import { Upload, Zap, X } from "lucide-react";
import { createJob, JOB_TYPE_LABELS, type JobType, type JobCreateResponse } from "@/lib/api";
import { useFileUpload } from "@/hooks/useFileUpload";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { DropZone } from "@/components/upload/DropZone";
import { JobTypeSelector } from "@/components/upload/JobTypeSelector";

interface UploadPanelProps {
    onJobCreated: (job: JobCreateResponse) => void;
}

export function UploadPanel({ onJobCreated }: UploadPanelProps) {
    const { file, useTestJson, uploading, progress, error, validateAndSetFile, clearFile, selectTestJson, uploadToMinio } =
        useFileUpload();

    const [jobType, setJobType] = useState<JobType>("TEST_JOB");
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isReady = file !== null || useTestJson;
    const loading = uploading || submitting;

    const handleSubmit = async () => {
        if (!isReady) {
            setSubmitError("Please upload a file or choose Use test.json");
            return;
        }
        setSubmitError(null);
        setSubmitting(true);
        try {
            const inputFilePath = await uploadToMinio();
            const job = await createJob({ job_type: jobType, input_file_path: inputFilePath });
            onJobCreated(job);
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    };

    const displayError = error ?? submitError;

    return (
        <div
            style={{
                background: "var(--surface)",
                border: "1px solid var(--border-2)",
                borderRadius: "20px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* ── Panel Header ── */}
            <div
                style={{
                    background: "var(--surface-2)",
                    borderBottom: "1px solid var(--border)",
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                }}
            >
                <div
                    style={{
                        width: 30, height: 30, borderRadius: 9,
                        background: "linear-gradient(135deg, #4c1d95, #7c3aed)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 0 14px var(--accent-glow)",
                    }}
                >
                    <Upload size={14} color="white" />
                </div>
                <div>
                    <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text)" }}>Submit a Job</p>
                    <p style={{ fontSize: "0.68rem", color: "var(--text-dim)", marginTop: 1 }}>
                        Upload a file or use the test dataset
                    </p>
                </div>
            </div>

            {/* ── Body ── */}
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>

                {/* Step 1: File Source */}
                <div
                    style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: "14px",
                        overflow: "hidden",
                    }}
                >
                    <StepLabel step={1} label="Choose Input File" />
                    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <DropZone
                            file={file}
                            fileInputRef={fileInputRef}
                            onDrop={validateAndSetFile}
                            onClear={clearFile}
                        />

                        {/* Divider */}
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                            <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 600 }}>OR</span>
                            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                        </div>

                        {/* Use test.json */}
                        <button
                            className={`use-test-btn ${useTestJson ? "use-test-btn-active" : ""}`}
                            onClick={selectTestJson}
                        >
                            <Zap size={14} color={useTestJson ? "var(--accent-2)" : "var(--text-dim)"} />
                            Use existing{" "}
                            <code className="code-inline" style={{ background: "rgba(255,255,255,0.07)", padding: "1px 6px", borderRadius: 4 }}>
                                test.json
                            </code>{" "}
                            from MinIO
                        </button>
                    </div>
                </div>

                {/* Step 2: Job Type */}
                <div
                    style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: "14px",
                        overflow: "hidden",
                    }}
                >
                    <StepLabel step={2} label="Select Processor" />
                    <div style={{ padding: "14px 16px" }}>
                        <JobTypeSelector selected={jobType} onSelect={setJobType} />
                    </div>
                </div>

                {/* Upload progress bar (only visible while uploading a real file) */}
                {uploading && (
                    <div>
                        <div
                            style={{
                                height: 4,
                                borderRadius: 99,
                                background: "var(--border-2)",
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    height: "100%",
                                    width: `${progress}%`,
                                    background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
                                    transition: "width 0.2s ease",
                                    borderRadius: 99,
                                }}
                            />
                        </div>
                        <p style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: 4, textAlign: "right" }}>
                            Uploading… {progress}%
                        </p>
                    </div>
                )}

                {/* Error */}
                {displayError && <ErrorBanner message={displayError} />}
            </div>

            {/* ── Footer / Submit ── */}
            <div style={{ padding: "0 20px 20px" }}>
                <button
                    className="submit-btn"
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                        background: isReady
                            ? "linear-gradient(135deg, #6d28d9, #a855f7)"
                            : "var(--surface-2)",
                        color: isReady ? "#fff" : "var(--text-dim)",
                        cursor: loading ? "wait" : isReady ? "pointer" : "not-allowed",
                        boxShadow: isReady && !loading ? "0 4px 24px var(--accent-glow)" : "none",
                        border: isReady ? "none" : "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                    } as React.CSSProperties}
                >
                    {loading ? (
                        <>
                            <Spinner size={15} />
                            {uploading ? `Uploading… ${progress}%` : "Submitting…"}
                        </>
                    ) : (
                        <>
                            <Zap size={15} />
                            {isReady ? "Submit Job" : "Select a file or use test.json"}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

/** Small numbered step label — local to UploadPanel, not worth a separate file. */
function StepLabel({ step, label }: { step: number; label: string }) {
    return (
        <div
            style={{
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
            }}
        >
            <span
                style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: "var(--accent)", color: "white",
                    fontSize: "0.68rem", fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                }}
            >
                {step}
            </span>
            <span
                style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                }}
            >
                {label}
            </span>
        </div>
    );
}
