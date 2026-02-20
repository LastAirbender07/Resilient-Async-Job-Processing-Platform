// app/api/presign/route.ts
// Returns a short-lived MinIO presigned PUT URL so the browser can upload
// directly to MinIO without routing the file bytes through this server.
// This is the correct approach for large files — zero server-side RAM usage.
import { NextRequest, NextResponse } from "next/server";
import { getMinioClient, getInputBucket } from "@/lib/minio-client";
import { ACCEPTED_EXTENSIONS } from "@/lib/constants";

/** Presigned URL validity in seconds (15 minutes). */
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
        const bucket = getInputBucket(); // lazy — only called at request time

        // Use the original filename as the object key.
        // In production you may want to prefix with a UUID to avoid collisions.
        const objectKey = filename;

        const presignedUrl = await client.presignedPutObject(
            bucket,
            objectKey,
            PRESIGN_TTL_SECONDS
        );

        return NextResponse.json({ url: presignedUrl, key: objectKey });
    } catch (err) {
        console.error("[presign] error:", err);
        return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
    }
}
