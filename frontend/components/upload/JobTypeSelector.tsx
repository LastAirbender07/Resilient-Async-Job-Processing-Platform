// components/upload/JobTypeSelector.tsx
// Responsibility: render a grid of job type toggle buttons.
// Pure presentational — receives selected type and calls back on change.
import { JOB_TYPE_LABELS, type JobType } from "@/lib/api";

const JOB_TYPES = Object.keys(JOB_TYPE_LABELS) as JobType[];

interface JobTypeSelectorProps {
    selected: JobType;
    onSelect: (type: JobType) => void;
}

export function JobTypeSelector({ selected, onSelect }: JobTypeSelectorProps) {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: "8px",
            }}
        >
            {JOB_TYPES.map((t) => (
                <button
                    key={t}
                    onClick={() => onSelect(t)}
                    style={{
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: `1.5px solid ${selected === t ? "var(--accent)" : "var(--border)"}`,
                        background: selected === t ? "rgba(124,58,237,0.15)" : "var(--surface-2)",
                        color: selected === t ? "var(--accent-2)" : "var(--text-muted)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "left",
                        lineHeight: 1.4,
                        transition: "all 0.18s",
                        boxShadow: selected === t ? "0 0 0 3px var(--accent-glow)" : "none",
                    }}
                // CSS :hover handles hover effect via the .card:hover rule in globals.css
                // no onMouseEnter/Leave DOM mutations needed
                >
                    {JOB_TYPE_LABELS[t]}
                </button>
            ))}
        </div>
    );
}
