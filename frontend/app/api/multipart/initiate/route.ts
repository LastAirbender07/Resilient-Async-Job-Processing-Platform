// app/api/multipart/initiate/route.ts
//
// Initiates a MinIO multipart upload session.
//
// WHY: Large files (>500 MB) cannot reliably use a single PUT — if the
// connection drops at 1.9 GB, the entire upload is lost. Multipart upload
// splits the file into chunks; only the current chunk needs to be retried.
//
// Flow:
//   Browser → POST /api/multipart/initiate?filename=big.csv
//   Next.js server → MinIO.initiateNewMultipartUpload()
//   Response: { uploadId, key }
//
// The uploadId is a MinIO session identifier. The browser uses it in every
// subsequent /api/multipart/part and /api/multipart/complete call.
import { NextRequest, NextResponse } from "next/server";
import { getMinioClient, getInputBucket } from "@/lib/minio-client";
import { ACCEPTED_EXTENSIONS } from "@/lib/constants";

export async function POST(req: NextRequest) {
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

    try {
        const client = getMinioClient();
        const bucket = getInputBucket();
        const uploadId = await client.initiateNewMultipartUpload(bucket, filename, {});

        return NextResponse.json({ uploadId, key: filename });
    } catch (err) {
        console.error("[multipart/initiate] error:", err);
        return NextResponse.json({ error: "Failed to initiate multipart upload" }, { status: 500 });
    }
}
