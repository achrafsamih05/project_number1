import { listInvoices } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { handle, httpError } from "@/lib/server/http";
import { requireStoreId } from "@/lib/server/tenant";

export const dynamic = "force-dynamic";

// GET /api/invoices — admin only (tenant-scoped).
export const GET = () =>
  handle(async () => {
    const storeId = await requireStoreId();
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") httpError(401, "Unauthorized");
    return listInvoices(storeId);
  });
