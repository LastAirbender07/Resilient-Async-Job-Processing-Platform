// app/api/minio-purge/route.ts
//
// Deletes ALL objects from both the input and output MinIO buckets.
// Deliberately does NOT delete the bucket itself — only the objects inside.
//
// Security note: this is an unprotected admin endpoint — suitable for a
// learning project but in production should be behind auth middleware.
import { NextResponse } from "next/server";
import { getMinioClient, getInputBucket, getOutputBucket } from "@/lib/minio-client";
import { BucketItem } from "minio";

/** Lists all objects in a bucket recursively, then removes them. Returns count deleted. */
async function purgeBucket(
    client: Awaited<ReturnType<typeof getMinioClient>>,
    bucket: string,
    excludeNames: string[] = []
): Promise<number> {
    const objectNames: string[] = [];

    // listObjectsV2 is an event-based Node.js stream — wrap in a Promise
    await new Promise<void>((resolve, reject) => {
        const stream = client.listObjectsV2(bucket, "", true);
        stream.on("data", (obj: BucketItem) => {
            if (obj.name && !excludeNames.includes(obj.name)) {
                objectNames.push(obj.name);
            }
        });
        stream.on("end", resolve);
        stream.on("error", reject);
    });

    if (objectNames.length > 0) {
        await client.removeObjects(
            bucket,
            objectNames.map((name) => ({ name }))
        );
    }

    return objectNames.length;
}

export async function DELETE() {
    try {
        const client = getMinioClient();
        const inputBucket = getInputBucket();
        const outputBucket = getOutputBucket();

        const [inputDeleted, outputDeleted] = await Promise.all([
            // Keep the default test.json created by the helm init container so the UI button still works
            purgeBucket(client, inputBucket, ["test.json"]),
            purgeBucket(client, outputBucket),
        ]);

        return NextResponse.json({
            success: true,
            deleted: {
                input: inputDeleted,
                output: outputDeleted,
                total: inputDeleted + outputDeleted,
            },
        });
    } catch (err) {
        console.error("[minio-purge] error:", err);
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
    }
}
