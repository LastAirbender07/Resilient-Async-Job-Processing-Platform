// components/layout/Header.tsx
// Responsibility: render the sticky app header with logo, backend status, and nav links.
"use client";

import { Zap, Activity, Github } from "lucide-react";
import { API_URL } from "@/lib/api";
import { useBackendHealth } from "@/hooks/useBackendHealth";

export function Header() {
    const health = useBackendHealth();

    const statusColor =
        health === "checking" ? "#475569" : health === "online" ? "#34d399" : "#f87171";
    const statusLabel =
        health === "checking" ? "Checking…" : health === "online" ? "Backend Online" : "Backend Offline";

    return (
        <header
            style={{
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(7,7,15,0.85)",
                backdropFilter: "blur(12px)",
                position: "sticky",
                top: 0,
                zIndex: 50,
            }}
        >
            <div
                style={{
                    maxWidth: "1200px",
                    margin: "0 auto",
                    padding: "0 24px",
                    height: "60px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                {/* Logo */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                        style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "10px",
                            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 0 16px rgba(124,58,237,0.4)",
                        }}
                    >
                        <Zap size={16} color="white" />
                    </div>
                    <div>
                        <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "#e2e8f0", lineHeight: 1.1 }}>
                            Resilient Platform
                        </p>
                        <p
                            style={{
                                fontSize: "0.65rem",
                                color: "#475569",
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                            }}
                        >
                            Async Job Processing
                        </p>
                    </div>
                </div>

                {/* Right: backend status + links */}
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    {/* Backend status dot */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                            className="glow-pulse"
                            style={{
                                width: "7px",
                                height: "7px",
                                borderRadius: "50%",
                                background: statusColor,
                                color: statusColor,
                                display: "block",
                            }}
                        />
                        <span style={{ fontSize: "0.75rem", color: "#475569" }}>{statusLabel}</span>
                    </div>

                    {/* API Docs link — uses env var, no hardcoded localhost */}
                    <a
                        href={`${API_URL}/docs`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "0.75rem",
                            color: "#7c3aed",
                            textDecoration: "none",
                            padding: "5px 10px",
                            borderRadius: "8px",
                            border: "1px solid rgba(124,58,237,0.25)",
                            background: "rgba(124,58,237,0.08)",
                            transition: "all 0.2s",
                        }}
                    >
                        <Activity size={12} /> API Docs
                    </a>

                    <a
                        href="https://github.com/LastAirbender07/Resilient-Async-Job-Processing-Platform"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#475569", display: "flex", alignItems: "center" }}
                    >
                        <Github size={18} />
                    </a>
                </div>
            </div>
        </header>
    );
}
