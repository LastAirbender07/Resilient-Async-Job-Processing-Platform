// hooks/useMinioHealth.ts
// Polls /api/minio-health every 20 s and returns connectivity status.
// Mirrors the pattern of useBackendHealth — keeps Header dumb.
"use client";

import { useState, useEffect } from "react";

export type HealthStatus = "checking" | "online" | "offline";

export function useMinioHealth(): HealthStatus {
    const [status, setStatus] = useState<HealthStatus>("checking");

    useEffect(() => {
        let cancelled = false;

        async function check() {
            try {
                const res = await fetch("/api/minio-health", { cache: "no-store" });
                if (!cancelled) setStatus(res.ok ? "online" : "offline");
            } catch {
                if (!cancelled) setStatus("offline");
            }
        }

        check();
        const id = setInterval(check, 20_000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, []);

    return status;
}
