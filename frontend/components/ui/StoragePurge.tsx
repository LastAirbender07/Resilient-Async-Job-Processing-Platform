// components/ui/StoragePurge.tsx
// A "Clear MinIO Storage" button with a confirmation modal.
// Calls DELETE /api/minio-purge and shows the result inline.
//
// The modal is rendered via createPortal into document.body to escape the
// header's CSS stacking context (backdropFilter creates a new one, which
// clips position:fixed children to the header instead of the viewport).
"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, AlertTriangle, CheckCircle, XCircle, Loader } from "lucide-react";

type State = "idle" | "confirming" | "loading" | "success" | "error";

interface PurgeResult {
    deleted: { input: number; output: number; total: number };
}

const btnBase: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "5px",
    fontSize: "0.75rem", padding: "5px 10px", borderRadius: "8px",
    border: "1px solid", cursor: "pointer", transition: "all 0.2s",
    background: "transparent", fontFamily: "inherit",
};

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

    // Confirmation modal — portalled into document.body so it escapes the
    // header's stacking context (backdropFilter creates one).
    const modal =
        state === "confirming"
            ? createPortal(
                <div
                    onClick={reset}
                    style={{
                        position: "fixed", inset: 0, zIndex: 9999,
                        background: "rgba(0,0,0,0.75)",
                        backdropFilter: "blur(6px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: "#0d0d1a",
                            border: "1px solid rgba(248,113,113,0.35)",
                            borderRadius: "16px",
                            padding: "28px 32px",
                            maxWidth: "440px",
                            width: "90%",
                            boxShadow: "0 0 50px rgba(248,113,113,0.12)",
                        }}
                    >
                        {/* Title */}
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                            <AlertTriangle size={20} color="#f87171" />
                            <span style={{ fontWeight: 700, color: "#f87171", fontSize: "1rem" }}>
                                Clear MinIO Storage
                            </span>
                        </div>

                        {/* Body */}
                        <p style={{ color: "#94a3b8", fontSize: "0.85rem", lineHeight: 1.7, marginBottom: "24px" }}>
                            This will permanently delete{" "}
                            <strong style={{ color: "#e2e8f0" }}>all files</strong> from both the{" "}
                            <code style={{ color: "#a855f7", background: "rgba(168,85,247,0.1)", padding: "1px 5px", borderRadius: "4px" }}>inputs</code> and{" "}
                            <code style={{ color: "#a855f7", background: "rgba(168,85,247,0.1)", padding: "1px 5px", borderRadius: "4px" }}>outputs</code> buckets.
                            The buckets themselves will NOT be deleted. This cannot be undone.
                        </p>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                            <button
                                onClick={reset}
                                style={{ ...btnBase, color: "#64748b", borderColor: "rgba(100,116,139,0.3)" }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executePurge}
                                style={{ ...btnBase, color: "#fff", borderColor: "transparent", background: "#dc2626", padding: "7px 18px" }}
                            >
                                <Trash2 size={13} /> Yes, delete all files
                            </button>
                        </div>
                    </div>
                </div>,
                document.body   // escape the header's stacking context
            )
            : null;

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

            {/* Loading */}
            {state === "loading" && (
                <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "#f87171", fontSize: "0.75rem" }}>
                    <Loader size={12} /> Purging…
                </span>
            )}

            {/* Success */}
            {state === "success" && result && (
                <span
                    onClick={reset}
                    title="Click to dismiss"
                    style={{ display: "flex", alignItems: "center", gap: "5px", color: "#34d399", fontSize: "0.75rem", cursor: "pointer" }}
                >
                    <CheckCircle size={12} />
                    Cleared {result.deleted.total} file{result.deleted.total !== 1 ? "s" : ""}
                </span>
            )}

            {/* Error */}
            {state === "error" && (
                <span
                    onClick={reset}
                    title={errorMsg ?? ""}
                    style={{ display: "flex", alignItems: "center", gap: "5px", color: "#f87171", fontSize: "0.75rem", cursor: "pointer" }}
                >
                    <XCircle size={12} /> Purge failed
                </span>
            )}

            {/* Portal modal — renders in document.body, outside any stacking context */}
            {modal}
        </>
    );
}
