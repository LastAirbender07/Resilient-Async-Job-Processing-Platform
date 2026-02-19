"use client";

import { useState, useCallback, useRef } from "react";
import {
    Upload, FileJson, FileText, Zap, ChevronDown, X
} from "lucide-react";
import {
    createJob, JOB_TYPE_LABELS,
    type JobType, type JobCreateResponse,
} from "@/lib/api";

const JOB_TYPES = Object.keys(JOB_TYPE_LABELS) as JobType[];

/* ── colour tokens (matches globals.css vars) ─────────────────────── */
const C = {
    bg: "#07070f",
    surface: "#0d0d1a",
    s2: "#12121f",
    s3: "#181827",
    s4: "#1e1e30",
    border: "rgba(255,255,255,0.06)",
    border2: "rgba(255,255,255,0.10)",
    border3: "rgba(255,255,255,0.15)",
    accent: "#7c3aed",
    accent2: "#a855f7",
    glow: "rgba(124,58,237,0.25)",
    text: "#e2e8f0",
    muted: "#94a3b8",
    dim: "#475569",
    success: "#34d399",
    error: "#f87171",
};

interface UploadPanelProps {
    onJobCreated: (job: JobCreateResponse) => void;
}

export function UploadPanel({ onJobCreated }: UploadPanelProps) {
    const [file, setFile] = useState<File | null>(null);
    const [useTestJson, setUseTestJson] = useState(false);
    const [jobType, setJobType] = useState<JobType>("TEST_JOB");
    const [dragging, setDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateAndSetFile = (f: File) => {
        const ext = f.name.split(".").pop()?.toLowerCase();
        if (!["json", "csv"].includes(ext || "")) {
            setError("Only .json and .csv files are supported");
            return;
        }
        setError(null);
        setFile(f);
        setUseTestJson(false);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) validateAndSetFile(dropped);
    }, []);

    const clearFile = (e: React.MouseEvent) => {
        e.stopPropagation();
        setFile(null);
        setError(null);
    };

    const handleSubmit = async () => {
        if (!file && !useTestJson) {
            setError("Please upload a file or choose Use test.json");
            return;
        }
        setError(null);
        setLoading(true);
        try {
            let inputFilePath = "test.json";
            if (file) {
                const fd = new FormData();
                fd.append("file", file);
                const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
                if (!uploadRes.ok) {
                    const err = await uploadRes.json();
                    throw new Error(err.error || "Upload failed");
                }
                const { key } = await uploadRes.json();
                inputFilePath = key;
            }
            const job = await createJob({ job_type: jobType, input_file_path: inputFilePath });
            onJobCreated(job);
            setFile(null);
            setUseTestJson(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const isReady = file !== null || useTestJson;

    return (
        <div style={{
            background: C.surface,
            border: `1px solid ${C.border2}`,
            borderRadius: "20px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
        }}>

            {/* ── Panel Header ───────────────────────────────────────────── */}
            <div style={{
                background: C.s2,
                borderBottom: `1px solid ${C.border}`,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
            }}>
                <div style={{
                    width: 30, height: 30, borderRadius: 9,
                    background: "linear-gradient(135deg, #4c1d95, #7c3aed)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: `0 0 14px ${C.glow}`,
                }}>
                    <Upload size={14} color="white" />
                </div>
                <div>
                    <p style={{ fontSize: "0.88rem", fontWeight: 700, color: C.text }}>Submit a Job</p>
                    <p style={{ fontSize: "0.68rem", color: C.dim, marginTop: 1 }}>Upload a file or use the test dataset</p>
                </div>
            </div>

            {/* ── Body ───────────────────────────────────────────────────── */}
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>

                {/* ── Step 1: File Source ──────────────────────────────────── */}
                <div style={{
                    background: C.s3,
                    border: `1px solid ${C.border}`,
                    borderRadius: "14px",
                    overflow: "hidden",
                }}>
                    {/* Step label */}
                    <div style={{
                        padding: "10px 16px",
                        borderBottom: `1px solid ${C.border}`,
                        display: "flex", alignItems: "center", gap: "8px"
                    }}>
                        <span style={{
                            width: 20, height: 20, borderRadius: "50%",
                            background: C.accent, color: "white",
                            fontSize: "0.68rem", fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>1</span>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: C.muted, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                            Choose Input File
                        </span>
                    </div>

                    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>

                        {/* Drop Zone */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={handleDrop}
                            style={{
                                border: `2px dashed ${dragging ? C.accent2 : file ? C.accent : C.border2}`,
                                borderRadius: "12px",
                                padding: "22px 16px",
                                textAlign: "center",
                                cursor: "pointer",
                                background: dragging
                                    ? "rgba(168,85,247,0.07)"
                                    : file ? "rgba(124,58,237,0.06)" : C.s4,
                                transition: "all 0.2s ease",
                                position: "relative",
                            }}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json,.csv"
                                style={{ display: "none" }}
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) validateAndSetFile(f);
                                    e.target.value = "";
                                }}
                            />
                            {file ? (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                                    {file.name.endsWith(".csv")
                                        ? <FileText size={20} color={C.accent2} />
                                        : <FileJson size={20} color={C.accent2} />}
                                    <div style={{ textAlign: "left" }}>
                                        <p style={{ fontSize: "0.82rem", fontWeight: 600, color: C.text }}>{file.name}</p>
                                        <p style={{ fontSize: "0.7rem", color: C.dim }}>{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    <button
                                        onClick={clearFile}
                                        style={{
                                            marginLeft: 8, background: "rgba(248,113,113,0.12)",
                                            border: "1px solid rgba(248,113,113,0.25)", borderRadius: 6,
                                            padding: "3px 6px", cursor: "pointer", color: C.error,
                                            display: "flex", alignItems: "center",
                                        }}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <Upload size={24} color={C.dim} style={{ margin: "0 auto 8px" }} />
                                    <p style={{ fontSize: "0.82rem", color: C.muted, fontWeight: 500 }}>
                                        Drag & drop or <span style={{ color: C.accent2 }}>browse</span>
                                    </p>
                                    <p style={{ fontSize: "0.7rem", color: C.dim, marginTop: 4 }}>
                                        Supports .json and .csv
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Divider */}
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ flex: 1, height: 1, background: C.border }} />
                            <span style={{ fontSize: "0.7rem", color: C.dim, fontWeight: 600 }}>OR</span>
                            <div style={{ flex: 1, height: 1, background: C.border }} />
                        </div>

                        {/* Use test.json */}
                        <button
                            onClick={() => { setUseTestJson(true); setFile(null); setError(null); }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "8px",
                                padding: "11px 16px",
                                borderRadius: "10px",
                                border: `1.5px solid ${useTestJson ? C.accent : C.border2}`,
                                background: useTestJson
                                    ? "rgba(124,58,237,0.15)"
                                    : C.s4,
                                color: useTestJson ? C.accent2 : C.muted,
                                fontSize: "0.82rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 0.2s",
                                fontFamily: "inherit",
                                boxShadow: useTestJson ? `0 0 0 3px ${C.glow}` : "none",
                            }}
                            onMouseEnter={(e) => {
                                if (!useTestJson) {
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent;
                                    (e.currentTarget as HTMLButtonElement).style.color = C.text;
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!useTestJson) {
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = C.border2;
                                    (e.currentTarget as HTMLButtonElement).style.color = C.muted;
                                }
                            }}
                        >
                            <Zap size={14} color={useTestJson ? C.accent2 : C.dim} />
                            Use existing{" "}
                            <code style={{
                                fontFamily: "JetBrains Mono, monospace",
                                fontSize: "0.75rem",
                                background: "rgba(255,255,255,0.07)",
                                padding: "1px 6px",
                                borderRadius: 4,
                            }}>test.json</code>{" "}
                            from MinIO
                        </button>
                    </div>
                </div>

                {/* ── Step 2: Job Type ─────────────────────────────────────── */}
                <div style={{
                    background: C.s3,
                    border: `1px solid ${C.border}`,
                    borderRadius: "14px",
                    overflow: "hidden",
                }}>
                    <div style={{
                        padding: "10px 16px",
                        borderBottom: `1px solid ${C.border}`,
                        display: "flex", alignItems: "center", gap: "8px"
                    }}>
                        <span style={{
                            width: 20, height: 20, borderRadius: "50%",
                            background: C.accent, color: "white",
                            fontSize: "0.68rem", fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>2</span>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: C.muted, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                            Select Processor
                        </span>
                    </div>

                    <div style={{ padding: "14px 16px" }}>
                        {/* Job type grid */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                            gap: "8px",
                        }}>
                            {JOB_TYPES.map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setJobType(t)}
                                    style={{
                                        padding: "10px 12px",
                                        borderRadius: "10px",
                                        border: `1.5px solid ${jobType === t ? C.accent : C.border}`,
                                        background: jobType === t
                                            ? "rgba(124,58,237,0.15)"
                                            : C.s4,
                                        color: jobType === t ? C.accent2 : C.muted,
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                        textAlign: "left",
                                        lineHeight: 1.4,
                                        transition: "all 0.18s",
                                        boxShadow: jobType === t ? `0 0 0 3px ${C.glow}` : "none",
                                    }}
                                    onMouseEnter={(e) => {
                                        if (jobType !== t) {
                                            (e.currentTarget).style.borderColor = C.border3;
                                            (e.currentTarget).style.color = C.text;
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (jobType !== t) {
                                            (e.currentTarget).style.borderColor = C.border;
                                            (e.currentTarget).style.color = C.muted;
                                        }
                                    }}
                                >
                                    {JOB_TYPE_LABELS[t]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Error ───────────────────────────────────────────────── */}
                {error && (
                    <div style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        background: "rgba(248,113,113,0.08)",
                        border: "1px solid rgba(248,113,113,0.2)",
                        borderRadius: "10px",
                        padding: "10px 14px",
                    }}>
                        <X size={14} color={C.error} style={{ flexShrink: 0 }} />
                        <p style={{ fontSize: "0.8rem", color: C.error }}>{error}</p>
                    </div>
                )}
            </div>

            {/* ── Footer / Submit ─────────────────────────────────────────── */}
            <div style={{
                padding: "0 20px 20px",
            }}>
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                        width: "100%",
                        padding: "14px",
                        borderRadius: "12px",
                        background: isReady
                            ? "linear-gradient(135deg, #6d28d9, #a855f7)"
                            : C.s4,
                        color: isReady ? "#fff" : C.dim,
                        fontSize: "0.9rem",
                        fontWeight: 700,
                        cursor: loading ? "wait" : isReady ? "pointer" : "not-allowed",
                        fontFamily: "inherit",
                        letterSpacing: "0.02em",
                        transition: "all 0.2s",
                        boxShadow: isReady && !loading ? `0 4px 24px ${C.glow}` : "none",
                        border: isReady ? "none" : `1px solid ${C.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                    } as React.CSSProperties}
                    onMouseEnter={(e) => {
                        if (isReady && !loading) {
                            (e.currentTarget).style.transform = "translateY(-1px)";
                            (e.currentTarget).style.boxShadow = `0 6px 32px ${C.glow}`;
                        }
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget).style.transform = "translateY(0)";
                        (e.currentTarget).style.boxShadow = isReady ? `0 4px 24px ${C.glow}` : "none";
                    }}
                >
                    {loading ? (
                        <>
                            <span style={{
                                width: 15, height: 15,
                                border: "2px solid rgba(255,255,255,0.25)",
                                borderTopColor: "#fff",
                                borderRadius: "50%",
                                display: "inline-block",
                                animation: "spin 0.7s linear infinite",
                            }} />
                            Submitting…
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
