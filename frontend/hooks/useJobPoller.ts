// hooks/useJobPoller.ts
// Responsibility: poll a single job from the backend until it reaches a terminal status.
// Extracted from JobTracker.tsx — the component just renders, this hook owns the fetch cycle.
"use client";

import { useState, useEffect, useCallback } from "react";
import { getJob, retryJob, type JobStatusResponse } from "@/lib/api";
import { TERMINAL_STATUSES } from "@/lib/constants";

const POLL_INTERVAL_MS = 2_000;

interface UseJobPollerResult {
    job: JobStatusResponse | null;
    retrying: boolean;
    retry: () => Promise<void>;
}

export function useJobPoller(jobId: string | null): UseJobPollerResult {
    const [job, setJob] = useState<JobStatusResponse | null>(null);
    const [retrying, setRetrying] = useState(false);

    const fetchJob = useCallback(async () => {
        if (!jobId) return;
        try {
            const data = await getJob(jobId);
            setJob(data);
        } catch {
            /* silently retry on next tick */
        }
    }, [jobId]);

    useEffect(() => {
        setJob(null);
        if (!jobId) return;

        fetchJob();

        const interval = setInterval(async () => {
            const data = await getJob(jobId).catch(() => null);
            if (!data) return;
            setJob(data);
            // Stop polling once the job reaches a terminal state
            if (TERMINAL_STATUSES.includes(data.status)) {
                clearInterval(interval);
            }
        }, POLL_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [jobId, fetchJob]);

    const retry = useCallback(async () => {
        if (!job) return;
        setRetrying(true);
        try {
            const updated = await retryJob(job.job_id);
            setJob(updated);
        } catch (e) {
            console.error("[useJobPoller] retry failed:", e);
        } finally {
            setRetrying(false);
        }
    }, [job]);

    return { job, retrying, retry };
}
