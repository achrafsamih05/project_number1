import { NextRequest } from "next/server";
import { getOrder, updateOrder } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { emit } from "@/lib/server/bus";
import { handle, httpError } from "@/lib/server/http";
import type { Order, OrderStatus, ShippingAddress } from "@/lib/types";

const VALID: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

// GET /api/orders/:id — owner or admin.
export const GET = (
  _: NextRequest,
  { params }: { params: { id: string } }
) =>
  handle(async () => {
    const o = await getOrder(params.id);
    if (!o) httpError(404, "Not found");
    const user = await getCurrentUser();
    if (!user) httpError(401, "Unauthorized");
    if (user!.role !== "admin" && o!.userId !== user!.id) {
      httpError(403, "Forbidden");
    }
    return o;
  });

// PATCH /api/orders/:id — admin only.
//
// Accepts any combination of:
//   { status? }                               — quick-status updates from the
//                                               admin orders list (existing
//                                               behaviour, unchanged).
//   { customer?: { name, email, phone, address, city?, postalCode?, country? } }
//                                             — edit shipping/contact details.
//   { items?: Array<{ productId, name, quantity, price }> }
//                                             — full items replacement.
//   { subtotal?, tax?, total? }               — admin-set totals (used when
//                                               the admin reprices an order
//                                               manually). Recomputed from
//                                               items if items are sent and
//                                               totals are not.
//
// We validate each field independently so a typo in one section never leaks
// half-applied state into the database.
export const PATCH = (
  req: NextRequest,
  { params }: { params: { id: string } }
) =>
  handle(async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") httpError(401, "Unauthorized");

    const body = (await req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) httpError(400, "Invalid body");

    const patch: Partial<Order> = {};

    // --- status ---
    if (body!.status !== undefined) {
      const s = body!.status as OrderStatus;
      if (!VALID.includes(s)) httpError(400, "Invalid status");
      patch.status = s;
    }

    // --- customer ---
    if (body!.customer && typeof body!.customer === "object") {
      const c = body!.customer as Partial<ShippingAddress>;
      if (typeof c.name !== "string" || c.name.trim().length === 0) {
        httpError(400, "customer.name is required");
      }
      if (typeof c.address !== "string" || c.address.trim().length === 0) {
        httpError(400, "customer.address is required");
      }
      patch.customer = {
        name: c.name!.trim(),
        email: typeof c.email === "string" && c.email.trim().length > 0
          ? c.email.trim().toLowerCase()
          : undefined,
        phone: typeof c.phone === "string" ? c.phone.trim() : "",
        address: c.address!.trim(),
        city: typeof c.city === "string" ? c.city.trim() : undefined,
        postalCode:
          typeof c.postalCode === "string" ? c.postalCode.trim() : undefined,
        country: typeof c.country === "string" ? c.country.trim() : undefined,
      };
    }

    // --- items ---
    let computedSubtotal: number | undefined;
    if (body!.items !== undefined) {
      if (!Array.isArray(body!.items)) {
        httpError(400, "items must be an array");
      }
      const items = (body!.items as Array<Record<string, unknown>>).map(
        (raw, idx) => {
          const productId =
            typeof raw.productId === "string" ? raw.productId : "";
          const name =
            typeof raw.name === "string" && raw.name.trim().length > 0
              ? raw.name
              : `Item ${idx + 1}`;
          const quantity = Math.max(
            1,
            Math.floor(Number(raw.quantity) || 0)
          );
          const price = Math.max(0, Number(raw.price) || 0);
          if (!productId) {
            httpError(400, `items[${idx}].productId is required`);
          }
          return { productId, name, quantity, price };
        }
      );
      patch.items = items;
      computedSubtotal = +items
        .reduce((s, i) => s + i.price * i.quantity, 0)
        .toFixed(2);
    }

    // --- totals ---
    // If the caller passed explicit totals, take those; otherwise, when
    // items were replaced, recompute subtotal from the items and leave
    // tax/total alone unless the route already had a tax rate. We avoid
    // pulling settings here — the client-side editor sends precomputed
    // totals so the admin sees what they confirm.
    if (body!.subtotal !== undefined)
      patch.subtotal = Math.max(0, Number(body!.subtotal) || 0);
    else if (computedSubtotal !== undefined) patch.subtotal = computedSubtotal;

    if (body!.tax !== undefined) patch.tax = Math.max(0, Number(body!.tax) || 0);
    if (body!.total !== undefined)
      patch.total = Math.max(0, Number(body!.total) || 0);

    if (Object.keys(patch).length === 0) {
      httpError(400, "No fields to update");
    }

    const updated = await updateOrder(params.id, patch);
    if (!updated) httpError(404, "Not found");
    emit({ channel: "orders", action: "updated", id: params.id });
    return updated;
  });
