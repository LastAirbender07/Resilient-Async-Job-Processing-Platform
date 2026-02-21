// app/api/upload/route.ts
//
// ⚠️  DEPRECATED — no longer called by the frontend.
//
// This multipart upload route was replaced by /api/minio-upload, which accepts
// a raw PUT body (with real XHR progress events) instead of multipart/form-data.
// The new route also streams to MinIO without buffering the whole file in RAM.
//
// Kept for potential external use or testing. Safe to delete when no longer needed.
import { NextRequest, NextResponse } from "next/server";
import { getMinioClient, getInputBucket } from "@/lib/minio-client";
import { Readable } from "stream";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!["json", "csv"].includes(ext || "")) {
            return NextResponse.json(
                { error: "Only .json and .csv files are supported" },
                { status: 400 }
            );
        }

        const client = getMinioClient();
        const bucket = getInputBucket();
        const buffer = Buffer.from(await file.arrayBuffer());

        await client.putObject(bucket, file.name, Readable.from(buffer), buffer.length, {
            "Content-Type": file.type || "application/octet-stream",
        });

        return NextResponse.json({ key: file.name, bucket });
    } catch (err) {
        console.error("[upload] error:", err);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
