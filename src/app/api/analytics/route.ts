import {
  getSettings,
  listInvoices,
  listOrders,
  listProducts,
  listUsers,
} from "@/lib/server/db";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// GET /api/analytics — admin only (gated via middleware).
// Returns real, computed numbers — no placeholders.
export const GET = () =>
  handle(async () => {
    const [orders, invoices, products, users, settings] = await Promise.all([
      listOrders(),
      listInvoices(),
      listProducts(),
      listUsers(),
      getSettings(),
    ]);

    const revenue = +invoices
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + i.amount, 0)
      .toFixed(2);

    const outstanding = +invoices
      .filter((i) => i.status !== "paid")
      .reduce((s, i) => s + i.amount, 0)
      .toFixed(2);

    const pending = orders.filter((o) => o.status === "pending").length;
    const processing = orders.filter((o) => o.status === "processing").length;
    const shipped = orders.filter((o) => o.status === "shipped").length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;

    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const customerIdsWithOrders = new Set(
      orders.map((o) => o.userId).filter((x): x is string => !!x)
    );
    const activeUsers = users.filter(
      (u) =>
        !u.banned &&
        u.role === "customer" &&
        (customerIdsWithOrders.has(u.id) ||
          (u.lastSeenAt && now - new Date(u.lastSeenAt).getTime() < THIRTY_DAYS))
    ).length;

    const totalUsers = users.filter((u) => u.role === "customer").length;

    const totals = new Map<
      string,
      { name: string; qty: number; revenue: number }
    >();
    for (const o of orders) {
      for (const it of o.items) {
        const cur =
          totals.get(it.productId) ?? { name: it.name, qty: 0, revenue: 0 };
        cur.qty += it.quantity;
        cur.revenue += it.price * it.quantity;
        totals.set(it.productId, cur);
      }
    }
    const topProducts = Array.from(totals.entries())
      .map(([productId, v]) => ({ productId, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const lowStock = products
      .filter((p) => p.stock <= settings.lowStockThreshold)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 8)
      .map((p) => ({ id: p.id, name: p.name.en, stock: p.stock, sku: p.sku }));

    const DAY = 24 * 60 * 60 * 1000;
    const series: { date: string; revenue: number; orders: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const start = new Date(Date.now() - i * DAY);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + DAY);
      const dayInvoices = invoices.filter(
        (inv) =>
          inv.status === "paid" &&
          new Date(inv.issuedAt) >= start &&
          new Date(inv.issuedAt) < end
      );
      const dayOrders = orders.filter(
        (o) => new Date(o.createdAt) >= start && new Date(o.createdAt) < end
      );
      series.push({
        date: start.toISOString().slice(0, 10),
        revenue: +dayInvoices.reduce((s, i) => s + i.amount, 0).toFixed(2),
        orders: dayOrders.length,
      });
    }

    return {
      revenue,
      outstanding,
      orders: orders.length,
      products: products.length,
      totalUsers,
      activeUsers,
      orderStatus: { pending, processing, shipped, delivered, cancelled },
      unpaid: invoices.filter((i) => i.status !== "paid").length,
      topProducts,
      lowStock,
      series,
      currency: settings.currency,
    };
  });
