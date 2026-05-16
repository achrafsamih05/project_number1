import { listUsers } from "@/lib/server/db";
import { toPublicUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { requireStoreId } from "@/lib/server/tenant";

export const dynamic = "force-dynamic";

// GET /api/users — admin only (gated via middleware, tenant-scoped).
export const GET = () =>
  handle(async () => {
    const storeId = await requireStoreId();
    const users = await listUsers(storeId);
    return users.map(toPublicUser);
  });
