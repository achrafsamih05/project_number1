import { NextRequest } from "next/server";
import { getInvoice, updateInvoice } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { emit } from "@/lib/server/bus";
import { handle, httpError } from "@/lib/server/http";

// GET /api/invoices/:id — admin only.
export const GET = (
  _: NextRequest,
  { params }: { params: { id: string } }
) =>
  handle(async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") httpError(401, "Unauthorized");
    const inv = await getInvoice(params.id);
    if (!inv) httpError(404, "Not found");
    return inv;
  });

// PATCH /api/invoices/:id — admin only. Toggle paid/unpaid.
export const PATCH = (
  req: NextRequest,
  { params }: { params: { id: string } }
) =>
  handle(async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") httpError(401, "Unauthorized");
    const body = await req.json();
    const updated = await updateInvoice(params.id, body);
    if (!updated) httpError(404, "Not found");
    emit({ channel: "invoices", action: "updated", id: params.id });
    return updated;
  });
