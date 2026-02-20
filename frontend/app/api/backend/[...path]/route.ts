// app/api/backend/[...path]/route.ts
//
// Catch-all proxy for all backend API calls.
//
// WHY this exists instead of next.config.ts rewrites:
//   - next.config.ts is compiled at `next build` — env vars read there are
//     baked into the bundle, NOT evaluated at pod startup.
//   - API routes run on the Node.js server and resolve process.env at
//     REQUEST TIME, making BACKEND_API_URL truly runtime-configurable
//     via the Helm ConfigMap without rebuilding the image.
//
// Request flow:
//   Browser → /api/backend/jobs → this route → BACKEND_API_URL/jobs → backend pod
import { NextRequest, NextResponse } from "next/server";

// Read at request time — runtime env var injection works correctly here.
function getBackendUrl(): string {
    return process.env.BACKEND_API_URL ?? "http://localhost:5001";
}

async function proxy(req: NextRequest, path: string): Promise<NextResponse> {
    const targetUrl = `${getBackendUrl()}/${path}${req.nextUrl.search}`;

    try {
        const init: RequestInit = {
            method: req.method,
            headers: { "Content-Type": "application/json" },
        };

        // Forward body for mutating methods
        if (!["GET", "HEAD"].includes(req.method)) {
            init.body = await req.text();
        }

        const upstream = await fetch(targetUrl, init);
        const body = await upstream.text();

        return new NextResponse(body, {
            status: upstream.status,
            headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
        });
    } catch (err) {
        console.error(`[backend-proxy] ${req.method} ${targetUrl} failed:`, err);
        return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
    }
}

// Next.js App Router requires each HTTP method to be exported by name.
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    return proxy(req, path.join("/"));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    return proxy(req, path.join("/"));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    return proxy(req, path.join("/"));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    return proxy(req, path.join("/"));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    return proxy(req, path.join("/"));
}
