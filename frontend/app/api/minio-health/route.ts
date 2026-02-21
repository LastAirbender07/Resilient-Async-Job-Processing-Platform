// app/api/minio-health/route.ts
// Returns MinIO connectivity status — used by useMinioHealth hook.
import { NextResponse } from "next/server";
import { getMinioClient, getInputBucket } from "@/lib/minio-client";

export async function GET() {
    try {
        const client = getMinioClient();
        const bucket = getInputBucket();
        // bucketExists is a lightweight stat call — no data transferred
        await client.bucketExists(bucket);
        return NextResponse.json({ status: "ok" });
    } catch (err) {
        console.error("[minio-health] error:", err);
        return NextResponse.json({ status: "error" }, { status: 503 });
    }
}
