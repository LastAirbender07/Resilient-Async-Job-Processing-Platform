// app/api/result/route.ts — Fetches output file from MinIO and streams to browser
import { NextRequest, NextResponse } from "next/server";
import { getMinioClient, OUTPUT_BUCKET } from "@/lib/minio-client";

export async function GET(req: NextRequest) {
    const key = req.nextUrl.searchParams.get("key");
    if (!key) {
        return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
    }

    try {
        const client = getMinioClient();
        const stream = await client.getObject(OUTPUT_BUCKET, key);

        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString("utf-8");

        return new NextResponse(text, {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
    } catch (err) {
        console.error("[result] error:", err);
        return NextResponse.json({ error: "Could not fetch result file" }, { status: 500 });
    }
}
