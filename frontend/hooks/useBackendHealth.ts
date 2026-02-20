// hooks/useBackendHealth.ts
// Responsibility: poll the backend health endpoint and report online/offline status.
// Extracted from page.tsx — page just reads the state, doesn't own the timer.
"use client";

import { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/api";

export type HealthStatus = "checking" | "online" | "offline";

const POLL_INTERVAL_MS = 15_000;

export function useBackendHealth(): HealthStatus {
    const [status, setStatus] = useState<HealthStatus>("checking");

    const check = useCallback(async () => {
        try {
            const r = await fetch(`${API_URL}/health`, { cache: "no-store" });
            setStatus(r.ok ? "online" : "offline");
        } catch {
            setStatus("offline");
        }
    }, []);

    useEffect(() => {
        check();
        const id = setInterval(check, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, [check]);

    return status;
}
