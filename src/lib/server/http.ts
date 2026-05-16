import "server-only";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Uniform JSON error envelope for API routes.
//
// Why: if a handler throws (missing env var, Supabase network blip, bad
// request body, etc.) Next.js would otherwise return an HTML error page.
// The client's apiGet()/apiSend() helpers parse response bodies as JSON and
// would surface that as "Invalid JSON". Wrapping every handler with
// `handle(() => ...)` guarantees the response is always a JSON envelope.
//
// Usage:
//   export const GET = (req: NextRequest) =>
//     handle(() => doTheThing(req));
// ---------------------------------------------------------------------------

export function httpError(status: number, message: string): never {
  const e = new Error(message) as Error & { status?: number };
  e.status = status;
  throw e;
}

function statusFor(err: unknown): number {
  if (typeof err === "object" && err !== null && "status" in err) {
    const s = (err as { status?: unknown }).status;
    if (typeof s === "number" && s >= 400 && s < 600) return s;
  }
  return 500;
}

function messageFor(err: unknown): string {
  if (err instanceof Error) return err.message || "Internal Server Error";
  if (typeof err === "string") return err;
  return "Internal Server Error";
}

export async function handle<T>(
  fn: () => Promise<T> | T
): Promise<NextResponse> {
  try {
    const result = await fn();
    // If the handler already returned a NextResponse, pass it through.
    if (result instanceof NextResponse) return result;
    return NextResponse.json({ data: result });
  } catch (err) {
    const status = statusFor(err);
    const message = messageFor(err);
    // Log server-side with context; the client only sees the message.
    if (status >= 500) {
      // eslint-disable-next-line no-console
      console.error("[api] 500:", err);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
