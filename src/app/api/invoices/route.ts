import { listInvoices } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { handle, httpError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// GET /api/invoices — admin only.
export const GET = () =>
  handle(async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") httpError(401, "Unauthorized");
    return listInvoices();
  });
