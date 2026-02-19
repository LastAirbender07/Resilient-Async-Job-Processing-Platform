"use client";

import type { JobStatus } from "@/lib/api";

const STATUS_CONFIG: Record<
    JobStatus,
    { label: string; color: string; bg: string; pulse?: boolean }
> = {
    CREATED: { label: "Created", color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
    QUEUED: { label: "Queued", color: "#60a5fa", bg: "rgba(96,165,250,0.12)", pulse: true },
    PROCESSING: { label: "Processing", color: "#a78bfa", bg: "rgba(167,139,250,0.12)", pulse: true },
    RETRYING: { label: "Retrying", color: "#fbbf24", bg: "rgba(251,191,36,0.12)", pulse: true },
    COMPLETED: { label: "Completed", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
    FAILED: { label: "Failed", color: "#f87171", bg: "rgba(248,113,113,0.12)" },
    DEAD: { label: "Dead", color: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
};

export function StatusBadge({ status }: { status: JobStatus }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.CREATED;
    return (
        <span
            style={{
                color: cfg.color,
                background: cfg.bg,
                border: `1px solid ${cfg.color}33`,
                borderRadius: "999px",
                padding: "3px 10px",
                fontSize: "0.72rem",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                whiteSpace: "nowrap",
                width: "fit-content",
                letterSpacing: "0.02em",
            }}
        >
            {cfg.pulse && (
                <span
                    className="animate-pulse"
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: cfg.color,
                        flexShrink: 0,
                        display: "inline-block",
                    }}
                />
            )}
            {cfg.label}
        </span>
    );
}
