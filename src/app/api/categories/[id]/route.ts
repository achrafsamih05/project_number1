import { NextRequest } from "next/server";
import { deleteCategory, getCategory } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { emit } from "@/lib/server/bus";
import { handle, httpError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// GET /api/categories/:id — public.
export const GET = (
  _: NextRequest,
  { params }: { params: { id: string } }
) =>
  handle(async () => {
    const c = await getCategory(params.id);
    if (!c) httpError(404, "Not found");
    return c;
  });

// DELETE /api/categories/:id — admin only.
export const DELETE = (
  _: NextRequest,
  { params }: { params: { id: string } }
) =>
  handle(async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") httpError(401, "Unauthorized");

    const removed = await deleteCategory(params.id);
    if (!removed) httpError(404, "Not found");
    emit({ channel: "categories", action: "deleted", id: params.id });
    return removed;
  });
