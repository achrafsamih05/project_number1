import type { NextRequest } from "next/server";
import { bus, type BusEvent } from "@/lib/server/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/events — Server-Sent Events stream of DB mutations. Clients
// (storefront and admin) subscribe once and react to "products", "categories",
// "settings", "orders", "invoices" and "users" channels.
//
// Using SSE (vs. WebSockets) keeps the Edge/Node story simple and lets us
// reuse plain fetch on the client. For production multi-instance, replace
// `bus` with Redis pub/sub or Supabase Realtime — the client contract here
// stays the same.
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: BusEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // stream already closed
        }
      };
      const ping = () => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          // closed
        }
      };

      // Initial hello so the client knows the stream is live.
      controller.enqueue(encoder.encode(`: connected\n\n`));
      bus.on("event", send);
      const pingId = setInterval(ping, 25_000);

      const cleanup = () => {
        clearInterval(pingId);
        bus.off("event", send);
        try {
          controller.close();
        } catch {
          /* noop */
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
