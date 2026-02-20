// components/ui/ErrorBanner.tsx
// Responsibility: display an inline error message. Reusable across panels.
import { X } from "lucide-react";

interface ErrorBannerProps {
    message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
                borderRadius: "10px",
                padding: "10px 14px",
            }}
        >
            <X size={14} color="var(--error)" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: "0.8rem", color: "var(--error)" }}>{message}</p>
        </div>
    );
}
