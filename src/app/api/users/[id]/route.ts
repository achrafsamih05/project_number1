import { NextRequest } from "next/server";
import { deleteUser, getUserById, updateUser } from "@/lib/server/db";
import { getCurrentUser, toPublicUser } from "@/lib/server/auth";
import { emit } from "@/lib/server/bus";
import { handle, httpError } from "@/lib/server/http";
import { requireStoreId } from "@/lib/server/tenant";

// PATCH /api/users/:id — admin only (tenant-scoped). Ban/unban or change role.
export const PATCH = (
  req: NextRequest,
  { params }: { params: { id: string } }
) =>
  handle(async () => {
    const storeId = await requireStoreId();
    const me = await getCurrentUser();
    if (!me || me.role !== "admin") httpError(401, "Unauthorized");

    const target = await getUserById(params.id);
    if (!target) httpError(404, "Not found");
    // Ensure the target user belongs to the same store
    if (target!.storeId !== storeId) httpError(404, "Not found");

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (typeof body.banned === "boolean") patch.banned = body.banned;
    if (
      typeof body.role === "string" &&
      (body.role === "admin" || body.role === "customer")
    ) {
      if (target!.id === me!.id && body.role !== "admin") {
        httpError(400, "Cannot demote yourself");
      }
      patch.role = body.role;
    }

    const updated = await updateUser(params.id, patch, storeId);
    if (!updated) httpError(404, "Not found");
    emit({ channel: "users", action: "updated", id: params.id });
    return toPublicUser(updated!);
  });

// DELETE /api/users/:id — admin only (tenant-scoped). Can't delete yourself.
export const DELETE = (
  _: NextRequest,
  { params }: { params: { id: string } }
) =>
  handle(async () => {
    const storeId = await requireStoreId();
    const me = await getCurrentUser();
    if (!me || me.role !== "admin") httpError(401, "Unauthorized");
    if (me!.id === params.id) httpError(400, "Cannot delete your own account");

    const target = await getUserById(params.id);
    if (!target || target.storeId !== storeId) httpError(404, "Not found");

    const removed = await deleteUser(params.id, storeId);
    if (!removed) httpError(404, "Not found");
    emit({ channel: "users", action: "deleted", id: params.id });
    return toPublicUser(removed!);
  });
