"use client";

import { useJobPoller } from "@/hooks/useJobPoller";
import { StatusBadge } from "./StatusBadge";
import { ProgressBar } from "@/components/tracker/ProgressBar";
import { JobResult } from "@/components/tracker/JobResult";
import { JOB_TYPE_LABELS } from "@/lib/api";
import { TERMINAL_STATUSES } from "@/lib/constants";
import { RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";

interface JobTrackerProps {
    jobId: string | null;
}

export function JobTracker({ jobId }: JobTrackerProps) {
    const { job, retrying, retry } = useJobPoller(jobId);

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
            {/* Job ID + type + status */}
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
            <div className="h-1"></div>

            {/* Meta info */}
            <div className="grid grid-cols-3 gap-3 pt-1">
                {[
                    { label: "Input", value: job.input_file_path },
                    { label: "Retries", value: `${job.retry_count} / ${job.max_retries}` },
                    {
                        label: "Finished",
                        value: job.finished_at ? new Date(job.finished_at).toLocaleTimeString() : "—",
                    },
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

            {/* Result */}
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
                <button className="retry-btn" onClick={retry} disabled={retrying}>
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
