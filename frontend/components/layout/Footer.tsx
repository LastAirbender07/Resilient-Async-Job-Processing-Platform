// components/layout/Footer.tsx
// Responsibility: render the app footer. Pure presentational — no logic.
export function Footer() {
    return (
        <footer
            style={{
                borderTop: "1px solid rgba(255,255,255,0.05)",
                padding: "20px 24px",
                textAlign: "center",
                color: "#334155",
                fontSize: "0.75rem",
            }}
        >
            Resilient Async Job Processing Platform · Built with Next.js + FastAPI + MinIO + Redis
        </footer>
    );
}
