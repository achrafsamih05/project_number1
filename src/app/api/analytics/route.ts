import {
  getSettings,
  listInvoices,
  listOrders,
  listProducts,
  listUsers,
} from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { requireStoreId } from "@/lib/server/tenant";

export const dynamic = "force-dynamic";

// GET /api/analytics — admin only (gated via middleware, tenant-scoped).
export const GET = () =>
  handle(async () => {
    const storeId = await requireStoreId();
    const [orders, invoices, products, users, settings] = await Promise.all([
      listOrders(storeId),
      listInvoices(storeId),
      listProducts(storeId),
      listUsers(storeId),
      getSettings(storeId),
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
      .map((p) => ({ id: p.id, name: p.name.en, nameAr: p.name.ar, stock: p.stock, sku: p.sku, price: p.price, purchasePrice: p.purchasePrice }));

    // --- Micro-ERP Metrics (scoped to store) ---
    // Capital Tied: Σ(stock × purchase_price) — money locked in inventory
    // Projected Revenue: Σ(stock × price) — if all stock sells at list price
    // Projected Profit: Σ(stock × (price - purchase_price)) — net margin on stock
    let capitalTied = 0;
    let projectedRevenue = 0;
    let projectedProfit = 0;
    let totalStockUnits = 0;
    let unpricedProducts = 0;

    for (const p of products) {
      capitalTied += p.purchasePrice * p.stock;
      projectedRevenue += p.price * p.stock;
      projectedProfit += (p.price - p.purchasePrice) * p.stock;
      totalStockUnits += p.stock;
      if (p.purchasePrice <= 0) unpricedProducts += 1;
    }

    const averageMargin = capitalTied > 0 ? (projectedProfit / capitalTied) * 100 : 0;

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

    // --- Inventory Intelligence: Run Rate & Stock Depletion Prediction ---
    // Calculate units sold per product in the last 14 days
    const fourteenDaysAgo = new Date(Date.now() - 14 * DAY);
    const recentOrders = orders.filter(
      (o) => new Date(o.createdAt) >= fourteenDaysAgo
    );

    // Aggregate units sold per productId in the last 14 days
    const unitsSold14d = new Map<string, number>();
    for (const o of recentOrders) {
      for (const item of o.items) {
        unitsSold14d.set(
          item.productId,
          (unitsSold14d.get(item.productId) ?? 0) + item.quantity
        );
      }
    }

    // Build inventory intelligence per product
    const inventoryIntelligence = products.map((p) => {
      const sold = unitsSold14d.get(p.id) ?? 0;
      const dailyRunRate = sold / 14;
      const daysLeft = dailyRunRate > 0 ? p.stock / dailyRunRate : null; // null = no recent sales
      let status: "critical" | "warning" | "healthy" | "stable";
      if (dailyRunRate === 0) {
        status = "stable"; // No recent sales — stable/no velocity
      } else if (daysLeft !== null && daysLeft <= 3) {
        status = "critical"; // Out of stock risk
      } else if (daysLeft !== null && daysLeft <= 7) {
        status = "warning"; // Restock recommended
      } else {
        status = "healthy";
      }
      return {
        productId: p.id,
        name: p.name.en,
        nameAr: p.name.ar,
        sku: p.sku,
        stock: p.stock,
        unitsSold14d: sold,
        dailyRunRate: +dailyRunRate.toFixed(2),
        daysLeft: daysLeft !== null ? +daysLeft.toFixed(1) : null,
        status,
      };
    })
    // Sort: critical first, then warning, then healthy, then stable
    .sort((a, b) => {
      const priority = { critical: 0, warning: 1, healthy: 2, stable: 3 };
      return priority[a.status] - priority[b.status] || (a.daysLeft ?? 999) - (b.daysLeft ?? 999);
    });

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
      // Micro-ERP metrics
      erp: {
        capitalTied: +capitalTied.toFixed(2),
        projectedRevenue: +projectedRevenue.toFixed(2),
        projectedProfit: +projectedProfit.toFixed(2),
        averageMargin: +averageMargin.toFixed(1),
        totalStockUnits,
        unpricedProducts,
      },
      // Inventory Intelligence
      inventoryIntelligence,
    };
  });
