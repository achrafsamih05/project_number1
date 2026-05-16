import { listUsers } from "@/lib/server/db";
import { toPublicUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// GET /api/users — admin only (gated via middleware).
export const GET = () =>
  handle(async () => {
    const users = await listUsers();
    return users.map(toPublicUser);
  });
