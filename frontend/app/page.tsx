"use client";

import { useState } from "react";
import { type JobCreateResponse } from "@/lib/api";
import { UploadPanel } from "./components/UploadPanel";
import { JobTracker } from "./components/JobTracker";
import { JobHistory } from "./components/JobHistory";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Activity } from "lucide-react";

export default function Home() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);

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
      <Header />

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

        {/* Top section: Upload + Live Tracker */}
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
              <div className="icon-wrapper">
                <Activity size={14} color="#a855f7" />
              </div>
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

        {/* Job History */}
        <JobHistory refreshTrigger={historyRefresh} onSelectJob={handleSelectJob} />
      </main>

      <Footer />
    </div>
  );
}
