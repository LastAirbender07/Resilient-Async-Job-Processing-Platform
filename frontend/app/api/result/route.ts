// app/api/result/route.ts
// Streams the output file from MinIO directly to the browser.
// Does NOT buffer the whole file in memory — safe for large outputs.
import { NextRequest, NextResponse } from "next/server";
import { getMinioClient, getOutputBucket } from "@/lib/minio-client";
import { Readable } from "stream";

export async function GET(req: NextRequest) {
    const key = req.nextUrl.searchParams.get("key");
    if (!key) {
        return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
    }

    try {
        const client = getMinioClient();
        const bucket = getOutputBucket(); // lazy — only called at request time, not build time
        const nodeStream = await client.getObject(bucket, key);

        // Bridge Node.js Readable → Web ReadableStream so Next.js can stream it
        const webStream = Readable.toWeb(nodeStream) as ReadableStream;

        return new NextResponse(webStream, {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
    } catch (err: any) {
        if (err.code === "NoSuchKey") {
            return NextResponse.json(
                { error: "Result file no longer exists (it may have been purged)." },
                { status: 404 }
            );
        }
        console.error("[result] error:", err);
        return NextResponse.json({ error: "Could not fetch result file" }, { status: 500 });
    }
}
