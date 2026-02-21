// app/api/minio-upload/route.ts
//
// Server-side streaming upload proxy to MinIO.
//
// WHY this exists instead of presigned URLs:
//   MinIO's presigned URLs contain the internal cluster DNS name
//   (e.g. resilient-platform-minio-service:9000) which the browser
//   cannot resolve. By routing the upload through this API route,
//   the file goes: Browser → Next.js server (resolvable) → MinIO (cluster DNS).
//
// The browser sends a PUT request with the raw file body.
// We stream it directly to MinIO without buffering in RAM.
import { NextRequest, NextResponse } from "next/server";
import { getMinioClient, getInputBucket } from "@/lib/minio-client";
import { Readable } from "stream";
import { ACCEPTED_EXTENSIONS } from "@/lib/constants";

export async function PUT(req: NextRequest) {
    const filename = req.nextUrl.searchParams.get("filename");
    if (!filename) {
        return NextResponse.json({ error: "Missing filename query param" }, { status: 400 });
    }

    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
        return NextResponse.json(
            { error: `Only ${ACCEPTED_EXTENSIONS.join(", ")} files are supported` },
            { status: 400 }
        );
    }

    if (!req.body) {
        return NextResponse.json({ error: "No file body" }, { status: 400 });
    }

    const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
    const contentType = req.headers.get("content-type") ?? "application/octet-stream";

    try {
        const client = getMinioClient();
        const bucket = getInputBucket();

        // Double-cast: Next.js req.body is Web API ReadableStream; Readable.fromWeb
        // expects the Node.js stream/web variant. Identical at runtime.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nodeStream = Readable.fromWeb(req.body as any);

        await client.putObject(bucket, filename, nodeStream, contentLength, {
            "Content-Type": contentType,
        });

        return NextResponse.json({ key: filename, bucket });
    } catch (err) {
        console.error("[minio-upload] error:", err);
        return NextResponse.json({ error: "Upload to MinIO failed" }, { status: 500 });
    }
}
