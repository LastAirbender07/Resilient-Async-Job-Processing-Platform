"use client";

import { useState, useEffect, useCallback } from "react";
import { listJobs, retryJob, JOB_TYPE_LABELS, type JobStatusResponse } from "@/lib/api";
import { StatusBadge } from "./StatusBadge";
import { RefreshCw, History, ChevronLeft, ChevronRight } from "lucide-react";

interface JobHistoryProps {
    refreshTrigger: number;    // increment to force a refresh
    onSelectJob: (jobId: string) => void;
}

export function JobHistory({ refreshTrigger, onSelectJob }: JobHistoryProps) {
    const [jobs, setJobs] = useState<JobStatusResponse[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [retryingId, setRetryingId] = useState<string | null>(null);

    const LIMIT = 8;

    const fetchJobs = useCallback(async () => {
        setLoading(true);
        try {
            const data = await listJobs(LIMIT, page * LIMIT);
            setJobs(data.items);
            setTotal(data.total);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => { fetchJobs(); }, [fetchJobs, refreshTrigger]);

    // Auto-refresh every 5s if any non-terminal jobs exist
    useEffect(() => {
        const hasActive = jobs.some((j) => !["COMPLETED", "FAILED", "DEAD"].includes(j.status));
        if (!hasActive) return;
        const id = setInterval(fetchJobs, 5000);
        return () => clearInterval(id);
    }, [jobs, fetchJobs]);

    const handleRetry = async (jobId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setRetryingId(jobId);
        try {
            await retryJob(jobId);
            await fetchJobs();
        } catch {
            /* ignore */
        } finally {
            setRetryingId(null);
        }
    };

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <div className="icon-wrapper"><History className="w-4 h-4 text-violet-400" /></div>
                    <h2 className="section-title">Job History</h2>
                    <span className="ml-1 text-xs text-slate-600">({total})</span>
                </div>
                <button
                    onClick={fetchJobs}
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
                                    <th key={h} className="pb-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide pr-4 last:pr-0">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {jobs.map((job) => {
                                const canRetry = (job.status === "FAILED" || job.status === "DEAD") && job.retry_count < job.max_retries;
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
                                                    onClick={(e) => handleRetry(job.job_id, e)}
                                                    disabled={retryingId === job.job_id}
                                                >
                                                    <RefreshCw className={`w-3 h-3 ${retryingId === job.job_id ? "animate-spin" : ""}`} />
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
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                        >
                            <ChevronLeft className="w-3.5 h-3.5" /> Prev
                        </button>
                        <button
                            className="pagination-btn"
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
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
