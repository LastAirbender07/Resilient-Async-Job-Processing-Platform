"use client";

import { useState, useEffect, useCallback } from "react";
import { API_URL, type JobCreateResponse } from "@/lib/api";
import { UploadPanel } from "./components/UploadPanel";
import { JobTracker } from "./components/JobTracker";
import { JobHistory } from "./components/JobHistory";
import { Zap, Activity, Github } from "lucide-react";

export default function Home() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  // Health check
  const checkHealth = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/health`, { cache: "no-store" });
      setBackendOnline(r.ok);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const id = setInterval(checkHealth, 15000);
    return () => clearInterval(id);
  }, [checkHealth]);

  const handleJobCreated = (job: JobCreateResponse) => {
    setActiveJobId(job.job_id);
    setHistoryRefresh((n) => n + 1);
  };

  const handleSelectJob = (jobId: string) => {
    setActiveJobId(jobId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen">
      {/* ─── Header ─── */}
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
              <p style={{ fontSize: "0.65rem", color: "#475569", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Async Job Processing
              </p>
            </div>
          </div>

          {/* Right side */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Backend status */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                className="glow-pulse"
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: backendOnline === null ? "#475569" : backendOnline ? "#34d399" : "#f87171",
                  color: backendOnline === null ? "#475569" : backendOnline ? "#34d399" : "#f87171",
                  display: "block",
                }}
              />
              <span style={{ fontSize: "0.75rem", color: "#475569" }}>
                {backendOnline === null ? "Checking…" : backendOnline ? "Backend Online" : "Backend Offline"}
              </span>
            </div>

            <a
              href="http://localhost:5001/docs"
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

      {/* ─── Main ─── */}
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Hero */}
        <div style={{ marginBottom: "40px", textAlign: "center" }}>
          <h1
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
              fontWeight: 700,
              background: "linear-gradient(135deg, #e2e8f0 30%, #a855f7)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              marginBottom: "12px",
            }}
          >
            Process Files, Instantly
          </h1>
          <p style={{ color: "#475569", fontSize: "0.95rem", maxWidth: "480px", margin: "0 auto" }}>
            Upload a JSON or CSV file, pick a processor, and watch your job run — results delivered straight to the UI.
          </p>
        </div>

        {/* ─── Top Section: Upload + Live Tracker ─── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "20px",
            marginBottom: "20px",
          }}
        >
          <UploadPanel onJobCreated={handleJobCreated} />

          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <div className="icon-wrapper"><Activity size={14} color="#a855f7" /></div>
              <h2 className="section-title">Live Job Tracker</h2>
              {activeJobId && (
                <span
                  style={{
                    fontSize: "0.65rem",
                    color: "#7c3aed",
                    background: "rgba(124,58,237,0.1)",
                    border: "1px solid rgba(124,58,237,0.2)",
                    borderRadius: "99px",
                    padding: "2px 8px",
                  }}
                >
                  Active
                </span>
              )}
            </div>
            <JobTracker jobId={activeJobId} />
          </div>
        </div>

        {/* ─── Job History ─── */}
        <JobHistory
          refreshTrigger={historyRefresh}
          onSelectJob={handleSelectJob}
        />
      </main>

      {/* ─── Footer ─── */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          padding: "20px 24px",
          textAlign: "center",
          color: "#334155",
          fontSize: "0.75rem",
        }}
      >
        Resilient Async Job Processing Platform · Built with Next.js 16 + FastAPI + MinIO + Redis
      </footer>
    </div>
  );
}
