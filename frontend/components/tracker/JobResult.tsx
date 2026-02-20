// components/tracker/JobResult.tsx
// Responsibility: fetch and display the output file content for a completed job.
// Owns its own data fetch — JobTracker just passes the output key.
"use client";

import { useState, useEffect } from "react";
import { FileDown } from "lucide-react";

interface JobResultProps {
    outputKey: string;
}

export function JobResult({ outputKey }: JobResultProps) {
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/result?key=${encodeURIComponent(outputKey)}`)
            .then((r) => {
                if (!r.ok) throw new Error("Could not load result");
                return r.text();
            })
            .then(setContent)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [outputKey]);

    if (loading) return <div className="result-skeleton animate-pulse" />;
    if (error) return <p className="text-sm text-red-400">{error}</p>;

    let pretty = content ?? "";
    try {
        pretty = JSON.stringify(JSON.parse(pretty), null, 2);
    } catch {
        // CSV or non-JSON — keep as-is
    }

    return (
        <div className="result-block">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                    {outputKey}
                </span>
                <button
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    onClick={() => navigator.clipboard.writeText(pretty)}
                >
                    Copy
                </button>
            </div>
            <pre className="result-pre">{pretty}</pre>
        </div>
    );
}
