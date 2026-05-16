import { NextRequest } from "next/server";
import {
  createInvoice,
  createOrder,
  getProduct,
  getSettings,
  listOrders,
  nextInvoiceId,
  nextOrderId,
  updateProduct,
} from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { emit } from "@/lib/server/bus";
import { handle, httpError } from "@/lib/server/http";
import { requireStoreId } from "@/lib/server/tenant";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/orders — admin sees all (for the store), customer sees own.
export const GET = () =>
  handle(async () => {
    const storeId = await requireStoreId();
    const user = await getCurrentUser();
    const all = await listOrders(storeId);
    if (!user) return [];
    if (user.role === "admin") return all;
    return all.filter((o) => o.userId === user.id);
  });

// POST /api/orders — creates an order + invoice (tenant-scoped).
export const POST = (req: NextRequest) =>
  handle(async () => {
    const storeId = await requireStoreId();
    const body = await req.json();
    const { customer: customerIn, items, useProfile } = body as {
      customer?: Order["customer"];
      items: { productId: string; quantity: number }[];
      useProfile?: boolean;
    };

    const user = await getCurrentUser();
    let customer = customerIn;

    if (useProfile) {
      if (!user) httpError(401, "Must be logged in to use saved profile");
      if (!user!.address || !user!.phone) {
        httpError(400, "Profile missing shipping details");
      }
      customer = {
        name: user!.name,
        email: user!.email,
        phone: user!.phone!,
        address: [user!.address, user!.city, user!.postalCode, user!.country]
          .filter(Boolean)
          .join(", "),
      };
    }

    if (!customer?.phone || !customer?.name || !Array.isArray(items) || items.length === 0) {
      httpError(400, "customer (name + phone) and non-empty items are required");
    }

    const orderItems: Order["items"] = [];
    for (const it of items) {
      const p = await getProduct(it.productId, storeId);
      if (!p) continue;
      const qty = Math.max(1, Math.min(it.quantity, p.stock));
      if (qty <= 0) continue;
      orderItems.push({
        productId: p.id,
        name: p.name.en,
        quantity: qty,
        price: p.price,
      });
      await updateProduct(p.id, { stock: p.stock - qty }, storeId);
      emit({ channel: "products", action: "updated", id: p.id });
    }

    if (orderItems.length === 0) httpError(400, "No purchasable items");

    const settings = await getSettings(storeId);
    const subtotal = +orderItems
      .reduce((s, i) => s + i.price * i.quantity, 0)
      .toFixed(2);
    const tax = +(subtotal * (settings.taxRate / 100)).toFixed(2);
    const total = +(subtotal + tax).toFixed(2);

    const orderId = await nextOrderId();
    const order: Order = {
      id: orderId,
      storeId,
      userId: user?.id,
      customer: customer!,
      items: orderItems,
      subtotal,
      tax,
      total,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    await createOrder(order);
    emit({ channel: "orders", action: "created", id: order.id });

    const now = new Date();
    const due = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const invoiceId = await nextInvoiceId();
    const number = `INV-${now.getFullYear()}-${invoiceId.replace("i-", "")}`;
    await createInvoice({
      id: invoiceId,
      storeId,
      orderId: order.id,
      number,
      issuedAt: now.toISOString(),
      dueAt: due.toISOString(),
      status: "unpaid",
      amount: total,
    });
    emit({ channel: "invoices", action: "created", id: invoiceId });

    return order;
  });
