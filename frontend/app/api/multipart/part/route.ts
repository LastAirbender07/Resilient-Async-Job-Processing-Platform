// app/api/multipart/part/route.ts
//
// Uploads a single chunk (part) of a multipart upload to MinIO.
//
// WHY presignedUrl and not uploadPart():
//   client.uploadPart() is an INTERNAL MinIO SDK method. Calling it directly
//   throws "Cannot read properties of undefined (reading 'ETag')" because the
//   method relies on private SDK plumbing not exposed in the public interface.
//
//   The correct public approach:
//     1. client.presignedUrl('PUT', bucket, key, TTL, { uploadId, partNumber })
//        → generates a presigned MinIO URL scoped to this specific part
//     2. fetch(presignedUrl, { method: 'PUT', body: chunkBuffer })
//        → server-side HTTP PUT to MinIO (cluster DNS resolves fine from server)
//     3. Read ETag from response headers and return it to the browser
//
// Flow:
//   Browser → PUT /api/multipart/part?uploadId=X&key=K&partNumber=N
//             (body = raw chunk bytes, Content-Length = chunk size in bytes)
//   Next.js server → presignedUrl → fetch(presignedUrl) → MinIO
//   Response: { etag: "..." }
//
// MinIO requires partNumber to be 1-indexed (1, 2, 3, ...).
// MinIO requires each part ≥5 MB, except the last part.
// At 64 MB chunks, this is always satisfied.
import { NextRequest, NextResponse } from "next/server";
import { getMinioClient, getInputBucket } from "@/lib/minio-client";

export async function PUT(req: NextRequest) {
    const uploadId = req.nextUrl.searchParams.get("uploadId");
    const key = req.nextUrl.searchParams.get("key");
    const partNumberStr = req.nextUrl.searchParams.get("partNumber");

    if (!uploadId || !key || !partNumberStr) {
        return NextResponse.json(
            { error: "Missing required query params: uploadId, key, partNumber" },
            { status: 400 }
        );
    }

    const partNumber = parseInt(partNumberStr, 10);
    if (isNaN(partNumber) || partNumber < 1 || partNumber > 10000) {
        return NextResponse.json(
            { error: "partNumber must be an integer between 1 and 10000" },
            { status: 400 }
        );
    }

    if (!req.body) {
        return NextResponse.json({ error: "No chunk body provided" }, { status: 400 });
    }

    try {
        const client = getMinioClient();
        const bucket = getInputBucket();

        // Buffer the chunk. At 64 MB per chunk this is fine in RAM.
        const chunkBuffer = Buffer.from(await req.arrayBuffer());

        // Generate a presigned PUT URL scoped to this specific part.
        // reqParams causes MinIO to add ?partNumber=N&uploadId=X to the URL,
        // making it an S3 UploadPart presigned URL (not a regular PUT).
        const presignedUrl = await client.presignedUrl(
            "PUT",
            bucket,
            key,
            15 * 60, // 15 minute TTL — more than enough for one 64 MB chunk
            {
                uploadId,
                partNumber: String(partNumber),
            }
        );

        // Execute the PUT from the Next.js server — cluster DNS resolves MinIO.
        const minioRes = await fetch(presignedUrl, {
            method: "PUT",
            body: chunkBuffer,
            headers: {
                "Content-Length": String(chunkBuffer.length),
            },
        });

        if (!minioRes.ok) {
            const text = await minioRes.text().catch(() => "");
            console.error(`[multipart/part] MinIO rejected part ${partNumber}:`, text);
            return NextResponse.json(
                { error: `MinIO rejected part ${partNumber}: ${minioRes.status}` },
                { status: 502 }
            );
        }

        // MinIO returns the ETag in the response headers for UploadPart.
        // Strip surrounding quotes (MinIO wraps ETags in double-quotes).
        const etag = (minioRes.headers.get("etag") ?? "").replace(/"/g, "");
        if (!etag) {
            return NextResponse.json(
                { error: "MinIO did not return an ETag for this part" },
                { status: 502 }
            );
        }

        return NextResponse.json({ etag, partNumber });
    } catch (err) {
        console.error(`[multipart/part] error on part ${partNumber}:`, err);
        return NextResponse.json(
            { error: `Failed to upload part ${partNumber}` },
            { status: 500 }
        );
    }
}
