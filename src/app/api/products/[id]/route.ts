import { NextRequest } from "next/server";
import {
  deleteProduct,
  getProduct,
  updateProduct,
} from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { emit } from "@/lib/server/bus";
import { handle, httpError } from "@/lib/server/http";
import { requireStoreId } from "@/lib/server/tenant";

// GET /api/products/:id — public (tenant-scoped).
export const GET = (
  _: NextRequest,
  { params }: { params: { id: string } }
) =>
  handle(async () => {
    const storeId = await requireStoreId();
    const p = await getProduct(params.id, storeId);
    if (!p) httpError(404, "Not found");
    return p;
  });

// PATCH /api/products/:id — admin only (tenant-scoped).
export const PATCH = (
  req: NextRequest,
  { params }: { params: { id: string } }
) =>
  handle(async () => {
    const storeId = await requireStoreId();
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") httpError(401, "Unauthorized");

    const body = await req.json();
    const updated = await updateProduct(params.id, body, storeId);
    if (!updated) httpError(404, "Not found");
    emit({ channel: "products", action: "updated", id: params.id });
    return updated;
  });

// DELETE /api/products/:id — admin only (tenant-scoped).
export const DELETE = (
  _: NextRequest,
  { params }: { params: { id: string } }
) =>
  handle(async () => {
    const storeId = await requireStoreId();
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") httpError(401, "Unauthorized");

    const removed = await deleteProduct(params.id, storeId);
    if (!removed) httpError(404, "Not found");
    emit({ channel: "products", action: "deleted", id: params.id });
    return removed;
  });
