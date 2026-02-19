// app/api/upload/route.ts — Receives file from browser, uploads to MinIO input bucket
import { NextRequest, NextResponse } from "next/server";
import { getMinioClient, INPUT_BUCKET } from "@/lib/minio-client";
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
            return NextResponse.json({ error: "Only .json and .csv files are supported" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const client = getMinioClient();
        const objectKey = file.name;

        await client.putObject(INPUT_BUCKET, objectKey, Readable.from(buffer), buffer.length, {
            "Content-Type": file.type || "application/octet-stream",
        });

        return NextResponse.json({ key: objectKey, bucket: INPUT_BUCKET });
    } catch (err) {
        console.error("[upload] error:", err);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
