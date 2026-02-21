// components/ui/StoragePurge.tsx
// A "Clear MinIO Storage" button with a confirmation modal.
// Calls DELETE /api/minio-purge and shows the result inline.
"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, CheckCircle, XCircle, Loader } from "lucide-react";

type State = "idle" | "confirming" | "loading" | "success" | "error";

interface PurgeResult {
    deleted: { input: number; output: number; total: number };
}

export function StoragePurge() {
    const [state, setState] = useState<State>("idle");
    const [result, setResult] = useState<PurgeResult | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    async function executePurge() {
        setState("loading");
        try {
            const res = await fetch("/api/minio-purge", { method: "DELETE" });
            const data = await res.json();
            if (res.ok && data.success) {
                setResult(data);
                setState("success");
            } else {
                setErrorMsg(data.error ?? "Purge failed");
                setState("error");
            }
        } catch {
            setErrorMsg("Network error");
            setState("error");
        }
    }

    function reset() {
        setState("idle");
        setResult(null);
        setErrorMsg(null);
    }

    const btnBase: React.CSSProperties = {
        display: "flex", alignItems: "center", gap: "5px",
        fontSize: "0.75rem", padding: "5px 10px", borderRadius: "8px",
        border: "1px solid", cursor: "pointer", transition: "all 0.2s",
        background: "transparent",
    };

    return (
        <>
            {/* Trigger button */}
            {state === "idle" && (
                <button
                    onClick={() => setState("confirming")}
                    title="Clear all MinIO files"
                    style={{
                        ...btnBase,
                        color: "#f87171",
                        borderColor: "rgba(248,113,113,0.25)",
                        background: "rgba(248,113,113,0.08)",
                    }}
                >
                    <Trash2 size={12} /> Clear Storage
                </button>
            )}

            {/* Confirmation modal overlay */}
            {state === "confirming" && (
                <div
                    style={{
                        position: "fixed", inset: 0, zIndex: 200,
                        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    onClick={reset}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: "#0d0d1a", border: "1px solid rgba(248,113,113,0.3)",
                            borderRadius: "16px", padding: "28px 32px", maxWidth: "420px",
                            width: "90%", boxShadow: "0 0 40px rgba(248,113,113,0.15)",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                            <AlertTriangle size={20} color="#f87171" />
                            <span style={{ fontWeight: 700, color: "#f87171", fontSize: "1rem" }}>
                                Clear MinIO Storage
                            </span>
                        </div>
                        <p style={{ color: "#94a3b8", fontSize: "0.85rem", lineHeight: 1.6, marginBottom: "20px" }}>
                            This will permanently delete <strong style={{ color: "#e2e8f0" }}>all files</strong> from
                            both the <code style={{ color: "#a855f7" }}>inputs</code> and{" "}
                            <code style={{ color: "#a855f7" }}>outputs</code> buckets.
                            The buckets themselves will not be deleted. This cannot be undone.
                        </p>
                        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                            <button onClick={reset} style={{ ...btnBase, color: "#64748b", borderColor: "rgba(100,116,139,0.3)" }}>
                                Cancel
                            </button>
                            <button
                                onClick={executePurge}
                                style={{ ...btnBase, color: "#fff", borderColor: "transparent", background: "#dc2626", padding: "6px 16px" }}
                            >
                                <Trash2 size={12} /> Yes, delete all files
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading spinner */}
            {state === "loading" && (
                <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "#f87171", fontSize: "0.75rem" }}>
                    <Loader size={12} className="spin" /> Purging…
                </span>
            )}

            {/* Success */}
            {state === "success" && result && (
                <span
                    onClick={reset}
                    style={{ display: "flex", alignItems: "center", gap: "5px", color: "#34d399", fontSize: "0.75rem", cursor: "pointer" }}
                    title="Click to dismiss"
                >
                    <CheckCircle size={12} />
                    Cleared {result.deleted.total} file{result.deleted.total !== 1 ? "s" : ""}
                </span>
            )}

            {/* Error */}
            {state === "error" && (
                <span
                    onClick={reset}
                    style={{ display: "flex", alignItems: "center", gap: "5px", color: "#f87171", fontSize: "0.75rem", cursor: "pointer" }}
                    title={errorMsg ?? ""}
                >
                    <XCircle size={12} /> Purge failed
                </span>
            )}
        </>
    );
}
