// hooks/useJobHistory.ts
// Responsibility: fetch, paginate, and auto-refresh the list of all jobs.
// Extracted from JobHistory.tsx — the component just renders the data this hook produces.
"use client";

import { useState, useEffect, useCallback } from "react";
import { listJobs, retryJob, type JobStatusResponse } from "@/lib/api";
import { TERMINAL_STATUSES } from "@/lib/constants";

const PAGE_SIZE = 8;
const AUTO_REFRESH_MS = 5_000;

interface UseJobHistoryResult {
    jobs: JobStatusResponse[];
    total: number;
    page: number;
    totalPages: number;
    loading: boolean;
    retryingId: string | null;
    refresh: () => void;
    goToPage: (page: number) => void;
    retry: (jobId: string, e: React.MouseEvent) => Promise<void>;
}

export function useJobHistory(refreshTrigger: number): UseJobHistoryResult {
    const [jobs, setJobs] = useState<JobStatusResponse[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [retryingId, setRetryingId] = useState<string | null>(null);

    const fetchJobs = useCallback(async () => {
        setLoading(true);
        try {
            const data = await listJobs(PAGE_SIZE, page * PAGE_SIZE);
            setJobs(data.items);
            setTotal(data.total);
        } catch {
            /* ignore network blips */
        } finally {
            setLoading(false);
        }
    }, [page]);

    // Fetch whenever page changes or a caller requests a refresh
    useEffect(() => {
        fetchJobs();
    }, [fetchJobs, refreshTrigger]);

    // Auto-refresh every 5 s while any non-terminal jobs are present
    useEffect(() => {
        const hasActive = jobs.some((j) => !TERMINAL_STATUSES.includes(j.status));
        if (!hasActive) return;
        const id = setInterval(fetchJobs, AUTO_REFRESH_MS);
        return () => clearInterval(id);
    }, [jobs, fetchJobs]);

    const retry = useCallback(
        async (jobId: string, e: React.MouseEvent) => {
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
        },
        [fetchJobs]
    );

    const totalPages = Math.ceil(total / PAGE_SIZE);

    return {
        jobs,
        total,
        page,
        totalPages,
        loading,
        retryingId,
        refresh: fetchJobs,
        goToPage: setPage,
        retry,
    };
}
