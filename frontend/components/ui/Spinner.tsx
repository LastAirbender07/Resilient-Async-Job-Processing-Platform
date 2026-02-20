// components/ui/Spinner.tsx
// Responsibility: render a CSS spinning indicator. Reusable across the app.

interface SpinnerProps {
    size?: number;
}

export function Spinner({ size = 15 }: SpinnerProps) {
    return (
        <span
            style={{
                width: size,
                height: size,
                border: "2px solid rgba(255,255,255,0.25)",
                borderTopColor: "#fff",
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin 0.7s linear infinite",
                flexShrink: 0,
            }}
        />
    );
}
