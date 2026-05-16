import { NextRequest } from "next/server";
import {
  deleteProduct,
  getProduct,
  updateProduct,
} from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { emit } from "@/lib/server/bus";
import { handle, httpError } from "@/lib/server/http";

// GET /api/products/:id — public.
export const GET = (
  _: NextRequest,
  { params }: { params: { id: string } }
) =>
  handle(async () => {
    const p = await getProduct(params.id);
    if (!p) httpError(404, "Not found");
    return p;
  });

// PATCH /api/products/:id — admin only.
export const PATCH = (
  req: NextRequest,
  { params }: { params: { id: string } }
) =>
  handle(async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") httpError(401, "Unauthorized");

    const body = await req.json();
    const updated = await updateProduct(params.id, body);
    if (!updated) httpError(404, "Not found");
    emit({ channel: "products", action: "updated", id: params.id });
    return updated;
  });

// DELETE /api/products/:id — admin only.
export const DELETE = (
  _: NextRequest,
  { params }: { params: { id: string } }
) =>
  handle(async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") httpError(401, "Unauthorized");

    const removed = await deleteProduct(params.id);
    if (!removed) httpError(404, "Not found");
    emit({ channel: "products", action: "deleted", id: params.id });
    return removed;
  });
