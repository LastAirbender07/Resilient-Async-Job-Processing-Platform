// components/tracker/ProgressBar.tsx
// Responsibility: render a 3-step progress bar for a job's lifecycle.
// Pure presentational — receives status, renders nothing else.
import type { JobStatus } from "@/lib/api";
import { PROGRESS_STEPS } from "@/lib/constants";

interface ProgressBarProps {
    status: JobStatus;
}

export function ProgressBar({ status }: ProgressBarProps) {
    const isFailed = status === "FAILED" || status === "DEAD";
    const stepIndex = PROGRESS_STEPS.indexOf(status as JobStatus);
    const progress = isFailed
        ? 100
        : stepIndex === -1
            ? 0
            : ((stepIndex + 1) / PROGRESS_STEPS.length) * 100;

    return (
        <div className="w-full mt-4">
            <div className="flex justify-between text-xs text-slate-600 mb-1.5">
                {PROGRESS_STEPS.map((s) => (
                    <span
                        key={s}
                        className={`transition-colors duration-300 ${PROGRESS_STEPS.indexOf(s) <= stepIndex && !isFailed
                                ? "text-violet-400"
                                : "text-slate-600"
                            }`}
                    >
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                    </span>
                ))}
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-in-out ${isFailed ? "bg-red-500" : "bg-gradient-to-r from-violet-500 to-purple-400"
                        }`}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}
