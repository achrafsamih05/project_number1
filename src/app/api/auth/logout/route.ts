import { clearSessionCookie } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

export const POST = () =>
  handle(() => {
    clearSessionCookie();
    return { ok: true };
  });
