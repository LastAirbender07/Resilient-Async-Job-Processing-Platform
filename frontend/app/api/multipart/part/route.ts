// app/api/multipart/part/route.ts
//
// Uploads a single chunk (part) of a multipart upload to MinIO.
//
// WHY: The browser slices the file into 64 MB Blob chunks and sends them
// one at a time. This route receives the raw chunk body and forwards it to
// MinIO using the SDK's uploadPart() method (the S3 UploadPart operation).
// MinIO returns an ETag for each part; the browser collects all ETags and
// sends them to /api/multipart/complete to assemble the final object.
//
// WHY Buffer and not Readable: The MinIO JS SDK's uploadPart() expects a
// Binary payload (Buffer). For 64 MB chunks, buffering in RAM is fine —
// that's the whole point of chunking: each chunk fits comfortably in memory.
//
// Flow:
//   Browser → PUT /api/multipart/part?uploadId=X&key=K&partNumber=N
//             (body = raw chunk bytes)
//   Next.js server → client.uploadPart({ ..., uploadID, partNumber }, buffer)
//   Response: { etag: "..." }
//
// MinIO requires partNumber to be 1-indexed (1, 2, 3, ...).
// MinIO requires each part to be ≥5 MB, except the last part.
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

        // Buffer the chunk — 64 MB fits comfortably in RAM and is required by
        // the MinIO SDK's uploadPart() which expects a Binary (Buffer) payload.
        const chunkBuffer = Buffer.from(await req.arrayBuffer());

        const result = await client.uploadPart(
            {
                bucketName: bucket,
                objectName: key,
                uploadID: uploadId,
                partNumber,
                headers: {
                    "content-length": String(chunkBuffer.length),
                },
            },
            chunkBuffer
        );

        return NextResponse.json({ etag: result.etag, partNumber });
    } catch (err) {
        console.error(`[multipart/part] error on part ${partNumber}:`, err);
        return NextResponse.json(
            { error: `Failed to upload part ${partNumber}` },
            { status: 500 }
        );
    }
}
