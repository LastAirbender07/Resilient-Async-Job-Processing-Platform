// components/upload/DropZone.tsx
// Responsibility: file drag-and-drop + browse UI. Calls back with a validated File.
// All validation logic lives in useFileUpload — this component just handles UI events.
"use client";

import { useCallback, useState } from "react";
import { Upload, FileJson, FileText, X } from "lucide-react";

interface DropZoneProps {
    file: File | null;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onDrop: (file: File) => void;
    onClear: (e: React.MouseEvent) => void;
}

export function DropZone({ file, fileInputRef, onDrop, onClear }: DropZoneProps) {
    const [dragging, setDragging] = useState(false);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragging(false);
            const dropped = e.dataTransfer.files[0];
            if (dropped) onDrop(dropped);
        },
        [onDrop]
    );

    return (
        <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`drop-zone ${dragging ? "drop-zone-active" : ""} ${file ? "drop-zone-filled" : ""}`}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                style={{ display: "none" }}
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onDrop(f);
                    e.target.value = "";
                }}
            />

            {file ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                    {file.name.endsWith(".csv") ? (
                        <FileText size={20} color="var(--accent-2)" />
                    ) : (
                        <FileJson size={20} color="var(--accent-2)" />
                    )}
                    <div style={{ textAlign: "left" }}>
                        <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text)" }}>{file.name}</p>
                        <p style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                            {(file.size / 1024).toFixed(1)} KB
                        </p>
                    </div>
                    <button
                        onClick={onClear}
                        style={{
                            marginLeft: 8,
                            background: "rgba(248,113,113,0.12)",
                            border: "1px solid rgba(248,113,113,0.25)",
                            borderRadius: 6,
                            padding: "3px 6px",
                            cursor: "pointer",
                            color: "var(--error)",
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        <X size={12} />
                    </button>
                </div>
            ) : (
                <>
                    <Upload size={24} color="var(--text-dim)" style={{ margin: "0 auto 8px" }} />
                    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 500 }}>
                        Drag &amp; drop or <span style={{ color: "var(--accent-2)" }}>browse</span>
                    </p>
                    <p style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: 4 }}>
                        Supports .json and .csv
                    </p>
                </>
            )}
        </div>
    );
}
