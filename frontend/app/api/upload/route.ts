// app/api/upload/route.ts — Receives file from browser, uploads to MinIO input bucket.
// Kept as a fallback for small files. For large files, use /api/presign instead.
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
        const bucket = getInputBucket(); // lazy — only called at request time
        const objectKey = file.name;
        const buffer = Buffer.from(await file.arrayBuffer());

        await client.putObject(bucket, objectKey, Readable.from(buffer), buffer.length, {
            "Content-Type": file.type || "application/octet-stream",
        });

        return NextResponse.json({ key: objectKey, bucket });
    } catch (err) {
        console.error("[upload] error:", err);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
