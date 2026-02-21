import { NextResponse } from "next/server";
import client from "prom-client";

client.collectDefaultMetrics({ prefix: "frontend_" });

// Ensures this route is dynamically rendered per request, not cached statically
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const metrics = await client.register.metrics();
        return new NextResponse(metrics, {
            status: 200,
            headers: {
                "Content-Type": client.register.contentType,
            },
        });
    } catch (err) {
        console.error("[metrics] error:", err);
        return new NextResponse("Failed to generate metrics", { status: 500 });
    }
}
