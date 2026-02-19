"use client";

import { useState, useEffect, useCallback } from "react";
import { getJob, retryJob, TERMINAL_STATUSES, JOB_TYPE_LABELS, type JobStatusResponse, type JobStatus } from "@/lib/api";
import { StatusBadge } from "./StatusBadge";
import { RefreshCw, CheckCircle2, XCircle, FileDown, Clock } from "lucide-react";

const PROGRESS_STEPS: JobStatus[] = ["QUEUED", "PROCESSING", "COMPLETED"];

function ProgressBar({ status }: { status: JobStatus }) {
    const isFailed = status === "FAILED" || status === "DEAD";
    const stepIndex = PROGRESS_STEPS.indexOf(status as JobStatus);
    const progress = isFailed ? 100 : stepIndex === -1 ? 0 : ((stepIndex + 1) / PROGRESS_STEPS.length) * 100;

    return (
        <div className="w-full mt-4">
            <div className="flex justify-between text-xs text-slate-600 mb-1.5">
                {PROGRESS_STEPS.map((s) => (
                    <span
                        key={s}
                        className={`transition-colors duration-300 ${PROGRESS_STEPS.indexOf(s) <= stepIndex && !isFailed
                                ? "text-violet-400"
                                : "text-slate-600"
                            }`}
                    >
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                    </span>
                ))}
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-in-out ${isFailed ? "bg-red-500" : "bg-gradient-to-r from-violet-500 to-purple-400"
                        }`}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}

interface JobResultProps {
    outputKey: string;
}

function JobResult({ outputKey }: JobResultProps) {
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
        // CSV or non-JSON - keep as-is
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

interface JobTrackerProps {
    jobId: string | null;
}

export function JobTracker({ jobId }: JobTrackerProps) {
    const [job, setJob] = useState<JobStatusResponse | null>(null);
    const [retrying, setRetrying] = useState(false);

    const fetchJob = useCallback(async () => {
        if (!jobId) return;
        try {
            const data = await getJob(jobId);
            setJob(data);
        } catch {
            /* silently retry */
        }
    }, [jobId]);

    useEffect(() => {
        setJob(null);
        if (!jobId) return;
        fetchJob();
        const interval = setInterval(() => {
            setJob((prev) => {
                if (prev && TERMINAL_STATUSES.includes(prev.status)) {
                    clearInterval(interval);
                    return prev;
                }
                return prev;
            });
            fetchJob();
        }, 2000);
        return () => clearInterval(interval);
    }, [jobId, fetchJob]);

    const handleRetry = async () => {
        if (!job) return;
        setRetrying(true);
        try {
            const updated = await retryJob(job.job_id);
            setJob(updated);
        } catch (e) {
            console.error(e);
        } finally {
            setRetrying(false);
        }
    };

    if (!jobId) {
        return (
            <div className="card flex flex-col items-center justify-center gap-3 py-12 text-center">
                <Clock className="w-8 h-8 text-slate-700" />
                <p className="text-slate-600 text-sm">Submit a job to start tracking</p>
            </div>
        );
    }

    if (!job) {
        return (
            <div className="card">
                <div className="tracker-skeleton animate-pulse space-y-3">
                    <div className="h-4 bg-white/5 rounded w-2/3" />
                    <div className="h-2 bg-white/5 rounded w-full" />
                    <div className="h-2 bg-white/5 rounded w-3/4" />
                </div>
            </div>
        );
    }

    const isTerminal = TERMINAL_STATUSES.includes(job.status);
    const isFailed = job.status === "FAILED" || job.status === "DEAD";
    const isCompleted = job.status === "COMPLETED";

    return (
        <div className="card space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <p className="text-xs text-slate-500 font-mono">{job.job_id}</p>
                    <p className="text-sm font-semibold text-slate-200 mt-0.5">
                        {JOB_TYPE_LABELS[job.job_type]}
                    </p>
                </div>
                <StatusBadge status={job.status} />
            </div>

            <ProgressBar status={job.status} />

            {/* Meta info row */}
            <div className="grid grid-cols-3 gap-3 pt-1">
                {[
                    { label: "Input", value: job.input_file_path },
                    { label: "Retries", value: `${job.retry_count} / ${job.max_retries}` },
                    { label: "Finished", value: job.finished_at ? new Date(job.finished_at).toLocaleTimeString() : "—" },
                ].map((item) => (
                    <div key={item.label} className="meta-card">
                        <span className="text-xs text-slate-600">{item.label}</span>
                        <span className="text-xs text-slate-300 font-mono truncate">{item.value}</span>
                    </div>
                ))}
            </div>

            {/* Error message */}
            {isFailed && job.error_message && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-400">{job.error_message}</p>
                </div>
            )}

            {/* Success result */}
            {isCompleted && job.output_file_path && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm font-semibold">Result</span>
                    </div>
                    <JobResult outputKey={job.output_file_path} />
                </div>
            )}

            {/* Retry button */}
            {isFailed && job.retry_count < job.max_retries && (
                <button className="retry-btn" onClick={handleRetry} disabled={retrying}>
                    <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
                    {retrying ? "Retrying…" : "Retry Job"}
                </button>
            )}

            {!isTerminal && (
                <p className="text-xs text-slate-600 text-center animate-pulse">
                    Auto-refreshing every 2s…
                </p>
            )}
        </div>
    );
}
