// app/api/multipart/complete/route.ts
//
// Completes a MinIO multipart upload by assembling all uploaded parts.
//
// Flow:
//   Browser → POST /api/multipart/complete
//   Body: { uploadId: string, key: string, parts: [{partNumber: number, etag: string}] }
//   Next.js server → MinIO.completeMultipartUpload()
//   Response: { key }
//
// MinIO atomically assembles the parts in partNumber order. If any part
// is missing or the ETags don't match, MinIO returns an error.
import { NextRequest, NextResponse } from "next/server";
import { getMinioClient, getInputBucket } from "@/lib/minio-client";

interface Part {
    partNumber: number;
    etag: string;
}

interface CompleteBody {
    uploadId: string;
    key: string;
    parts: Part[];
}

export async function POST(req: NextRequest) {
    let body: CompleteBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { uploadId, key, parts } = body;
    if (!uploadId || !key || !parts?.length) {
        return NextResponse.json(
            { error: "Missing required fields: uploadId, key, parts" },
            { status: 400 }
        );
    }

    try {
        const client = getMinioClient();
        const bucket = getInputBucket();

        // MinIO SDK.completeMultipartUpload expects { part: number, etag?: string }[]
        // sorted by part number (ascending).
        const sortedParts = [...parts]
            .sort((a, b) => a.partNumber - b.partNumber)
            .map(({ partNumber, etag }) => ({ part: partNumber, etag }));

        await client.completeMultipartUpload(bucket, key, uploadId, sortedParts);

        return NextResponse.json({ key, bucket });
    } catch (err) {
        console.error("[multipart/complete] error:", err);
        return NextResponse.json({ error: "Failed to complete multipart upload" }, { status: 500 });
    }
}
