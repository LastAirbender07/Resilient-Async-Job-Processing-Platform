// app/api/presign/route.ts
//
// ⚠️  DEPRECATED — no longer called by the frontend.
//
// The presigned URL approach was replaced by /api/minio-upload, a server-side
// streaming proxy. Presigned URLs embedded the cluster-internal MinIO DNS
// (resilient-platform-minio-service:9000) which browsers cannot resolve.
//
// This file is kept to avoid breaking any external callers or curl scripts
// that might use it for testing. It is safe to delete when no longer needed.
import { NextRequest, NextResponse } from "next/server";
import { getMinioClient, getInputBucket } from "@/lib/minio-client";
import { ACCEPTED_EXTENSIONS } from "@/lib/constants";

const PRESIGN_TTL_SECONDS = 15 * 60;

export async function GET(req: NextRequest) {
    const filename = req.nextUrl.searchParams.get("filename");

    if (!filename) {
        return NextResponse.json({ error: "Missing filename parameter" }, { status: 400 });
    }

    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
        return NextResponse.json(
            { error: `Only ${ACCEPTED_EXTENSIONS.join(", ")} files are supported` },
            { status: 400 }
        );
    }

    try {
        const client = getMinioClient();
        const bucket = getInputBucket();
        const presignedUrl = await client.presignedPutObject(bucket, filename, PRESIGN_TTL_SECONDS);
        return NextResponse.json({ url: presignedUrl, key: filename });
    } catch (err) {
        console.error("[presign] error:", err);
        return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
    }
}
