import { NextRequest } from "next/server";
import { deleteCategory, getCategory } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { emit } from "@/lib/server/bus";
import { handle, httpError } from "@/lib/server/http";
import { requireStoreId } from "@/lib/server/tenant";

export const dynamic = "force-dynamic";

// GET /api/categories/:id — public (tenant-scoped).
export const GET = (
  _: NextRequest,
  { params }: { params: { id: string } }
) =>
  handle(async () => {
    const storeId = await requireStoreId();
    const c = await getCategory(params.id, storeId);
    if (!c) httpError(404, "Not found");
    return c;
  });

// DELETE /api/categories/:id — admin only (tenant-scoped).
export const DELETE = (
  _: NextRequest,
  { params }: { params: { id: string } }
) =>
  handle(async () => {
    const storeId = await requireStoreId();
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") httpError(401, "Unauthorized");

    const removed = await deleteCategory(params.id, storeId);
    if (!removed) httpError(404, "Not found");
    emit({ channel: "categories", action: "deleted", id: params.id });
    return removed;
  });
