import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

// Server-Sent Events endpoint for real-time queue refresh signals.
// Clients subscribe and receive a "refresh" event whenever the server
// detects queue activity. We use a simple heartbeat + periodic tick
// model here — a full implementation would broadcast on DB mutations
// via a pub/sub layer (Redis, pg LISTEN/NOTIFY, etc.).
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const HEARTBEAT_INTERVAL_MS = 25_000; // keep connection alive
  const REFRESH_INTERVAL_MS = 15_000;   // push refresh every 15 s

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      function send(event: string, data: string) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          closed = true;
        }
      }

      // Send initial connection confirmation
      send("connected", JSON.stringify({ ts: Date.now() }));

      // Periodic refresh signal
      const refreshTimer = setInterval(() => {
        send("refresh", JSON.stringify({ ts: Date.now() }));
      }, REFRESH_INTERVAL_MS);

      // Heartbeat comment to prevent proxy timeout
      const heartbeatTimer = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          closed = true;
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Clean up when the client disconnects
      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(refreshTimer);
        clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering
    },
  });
}
