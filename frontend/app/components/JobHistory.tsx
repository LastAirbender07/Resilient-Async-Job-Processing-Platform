"use client";

import { useJobHistory } from "@/hooks/useJobHistory";
import { StatusBadge } from "./StatusBadge";
import { JOB_TYPE_LABELS } from "@/lib/api";
import { RefreshCw, History, ChevronLeft, ChevronRight } from "lucide-react";

interface JobHistoryProps {
    refreshTrigger: number;
    onSelectJob: (jobId: string) => void;
}

export function JobHistory({ refreshTrigger, onSelectJob }: JobHistoryProps) {
    const {
        jobs, total, page, totalPages, loading,
        retryingId, refresh, goToPage, retry,
    } = useJobHistory(refreshTrigger);

    return (
        <div className="card">
            {/* Header row */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <div className="icon-wrapper">
                        <History className="w-4 h-4 text-violet-400" />
                    </div>
                    <h2 className="section-title">Job History</h2>
                    <span className="ml-1 text-xs text-slate-600">({total})</span>
                </div>
                <button
                    onClick={refresh}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-white/5 transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                </button>
            </div>

            {jobs.length === 0 && !loading ? (
                <p className="text-sm text-slate-600 text-center py-8">No jobs yet.</p>
            ) : (
                <div className="overflow-x-auto -mx-5 px-5">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5">
                                {["Job ID", "Type", "Input File", "Status", "Created", ""].map((h) => (
                                    <th
                                        key={h}
                                        className="pb-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide pr-4 last:pr-0"
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {jobs.map((job) => {
                                const canRetry =
                                    (job.status === "FAILED" || job.status === "DEAD") &&
                                    job.retry_count < job.max_retries;
                                return (
                                    <tr
                                        key={job.job_id}
                                        className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                                        onClick={() => onSelectJob(job.job_id)}
                                    >
                                        <td className="py-3 pr-4">
                                            <span className="font-mono text-xs text-slate-400 group-hover:text-violet-400 transition-colors">
                                                {job.job_id.split("-")[0]}…
                                            </span>
                                        </td>
                                        <td className="py-3 pr-4 text-slate-300 whitespace-nowrap">
                                            {JOB_TYPE_LABELS[job.job_type]}
                                        </td>
                                        <td className="py-3 pr-4 font-mono text-xs text-slate-500 max-w-[140px] truncate">
                                            {job.input_file_path}
                                        </td>
                                        <td className="py-3 pr-4">
                                            <StatusBadge status={job.status} />
                                        </td>
                                        <td className="py-3 pr-4 text-xs text-slate-600 whitespace-nowrap">
                                            {new Date(job.created_at).toLocaleString()}
                                        </td>
                                        <td className="py-3 text-right">
                                            {canRetry && (
                                                <button
                                                    className="retry-btn-sm"
                                                    onClick={(e) => retry(job.job_id, e)}
                                                    disabled={retryingId === job.job_id}
                                                >
                                                    <RefreshCw
                                                        className={`w-3 h-3 ${retryingId === job.job_id ? "animate-spin" : ""}`}
                                                    />
                                                    Retry
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                    <span className="text-xs text-slate-600">
                        Page {page + 1} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            className="pagination-btn"
                            onClick={() => goToPage(Math.max(0, page - 1))}
                            disabled={page === 0}
                        >
                            <ChevronLeft className="w-3.5 h-3.5" /> Prev
                        </button>
                        <button
                            className="pagination-btn"
                            onClick={() => goToPage(Math.min(totalPages - 1, page + 1))}
                            disabled={page === totalPages - 1}
                        >
                            Next <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
