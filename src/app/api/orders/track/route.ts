import { NextRequest } from "next/server";
import { getOrder } from "@/lib/server/db";
import { handle, httpError } from "@/lib/server/http";

// ---------------------------------------------------------------------------
// Public order tracking endpoint.
//
//   GET /api/orders/track?id=<order_id>&email=<customer_email>
//   GET /api/orders/track?id=<order_id>&phone=<customer_phone>
//
// Supports lookup by EITHER email or phone paired with the order id.
// Since the checkout refactor makes email optional (guests order with only
// phone), the phone-based path is the primary one. Email lookup is kept for
// backward compatibility with orders that were placed before the refactor.
//
// Security model: the caller must supply the order id PLUS a matching
// identifier (email or phone). Neither alone is sufficient.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

interface PublicOrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface PublicOrder {
  id: string;
  status: string;
  createdAt: string;
  customer: {
    name: string;
    email?: string;
    phone: string;
    address: string;
  };
  items: PublicOrderItem[];
  subtotal: number;
  tax: number;
  total: number;
}

function redactEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const at = email.indexOf("@");
  if (at <= 1) return "***" + email.slice(at);
  return email[0] + "***" + email.slice(at);
}

function redactPhone(phone: string): string {
  if (phone.length <= 4) return "***" + phone;
  return "***" + phone.slice(-4);
}

export const GET = (req: NextRequest) =>
  handle(async () => {
    const { searchParams } = new URL(req.url);
    const idRaw = searchParams.get("id")?.trim() ?? "";
    const emailRaw = searchParams.get("email")?.trim().toLowerCase() ?? "";
    const phoneRaw = searchParams.get("phone")?.trim() ?? "";

    if (!idRaw) {
      httpError(400, "Order id is required");
    }

    // Must provide at least one identifier alongside the order id.
    if (!emailRaw && !phoneRaw) {
      httpError(400, "Either email or phone is required for tracking");
    }

    const order = await getOrder(idRaw);
    // Constant "Not found" message regardless of which check failed, so the
    // endpoint cannot be used to confirm whether an order id exists.
    if (!order) httpError(404, "Order not found");

    // Verify the provided identifier matches.
    let matched = false;

    if (emailRaw && order!.customer.email) {
      matched = order!.customer.email.toLowerCase().trim() === emailRaw;
    }

    if (!matched && phoneRaw) {
      // Normalize phone comparison: strip whitespace and common formatting
      // characters so "05 55 12 34" matches "0555 1234" etc.
      const normalize = (p: string) => p.replace(/[\s\-\(\)\.]/g, "");
      matched = normalize(order!.customer.phone) === normalize(phoneRaw);
    }

    if (!matched) {
      httpError(404, "Order not found");
    }

    const sanitized: PublicOrder = {
      id: order!.id,
      status: order!.status,
      createdAt: order!.createdAt,
      customer: {
        name: order!.customer.name,
        email: redactEmail(order!.customer.email),
        phone: redactPhone(order!.customer.phone),
        address: order!.customer.address,
      },
      items: order!.items.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        price: it.price,
      })),
      subtotal: order!.subtotal,
      tax: order!.tax,
      total: order!.total,
    };
    return sanitized;
  });
