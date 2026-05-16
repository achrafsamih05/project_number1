"use client";

// ---------------------------------------------------------------------------
// Admin "Expenses & Profits" view.
//
// What it shows, per the brief:
//   1. Total capital tied in stock        Σ purchase_price * stock
//   2. Projected revenue at sale          Σ price * stock
//   3. Projected gross profit             Σ (price − purchase_price) * stock
//   4. Average margin %                   profit / capital_tied
//   5. A per-product breakdown table sorted by absolute projected profit so
//      the highest-impact rows surface first.
//
// Data source: `useProducts()` already fetches the catalog and re-fetches on
// the `products` realtime channel, so this view stays in sync without any
// new API endpoints. The math is intentionally done client-side because:
//   - it's a constant-time per row computation,
//   - keeping it close to the table makes it trivial to add column toggles
//     or filters later, and
//   - the catalog payload is what the storefront already streams to every
//     visitor — there's no extra cost in fetching it again here.
//
// Edge cases handled:
//   - purchase_price = 0 (legacy rows): margin reported as "—" and the row
//     contributes 0 to capital_tied, so totals stay correct.
//   - negative margin (price < purchase_price): margin pill turns red.
//   - empty catalog: shows a friendly empty-state instead of a blank grid.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/ui/Icon";
import { useProducts, useSettings } from "@/lib/client/hooks";
import { formatCurrency } from "@/lib/format";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

interface RowMetrics {
  product: Product;
  capitalTied: number; // purchase_price * stock
  potentialRevenue: number; // price * stock
  projectedProfit: number; // (price − purchase_price) * stock
  marginPct: number | null; // null when purchase_price is 0 (margin is undefined)
}

function computeRow(p: Product): RowMetrics {
  const capitalTied = p.purchasePrice * p.stock;
  const potentialRevenue = p.price * p.stock;
  const projectedProfit = (p.price - p.purchasePrice) * p.stock;
  // If we never paid for the unit, "margin %" is meaningless — show "—"
  // rather than dividing by zero or quoting a misleading 100%.
  const marginPct =
    p.purchasePrice > 0
      ? ((p.price - p.purchasePrice) / p.purchasePrice) * 100
      : null;
  return { product: p, capitalTied, potentialRevenue, projectedProfit, marginPct };
}

export default function ExpensesPage() {
  const { t, locale } = useI18n();
  const { data: products, loading } = useProducts();
  const settings = useSettings();
  const currency = settings?.currency ?? "USD";

  const rows = useMemo<RowMetrics[]>(
    () =>
      products
        .map(computeRow)
        // Highest absolute projected profit first — those rows drive the
        // bottom line and deserve the top of the table.
        .sort((a, b) => Math.abs(b.projectedProfit) - Math.abs(a.projectedProfit)),
    [products]
  );

  // Aggregates. Computed in one pass so we don't iterate the (potentially
  // long) product list multiple times when the catalog grows.
  const totals = useMemo(() => {
    let capital = 0;
    let revenue = 0;
    let profit = 0;
    let stockUnits = 0;
    let unpriced = 0; // products with purchase_price = 0
    for (const r of rows) {
      capital += r.capitalTied;
      revenue += r.potentialRevenue;
      profit += r.projectedProfit;
      stockUnits += r.product.stock;
      if (r.product.purchasePrice <= 0) unpriced += 1;
    }
    const avgMargin = capital > 0 ? (profit / capital) * 100 : 0;
    return { capital, revenue, profit, stockUnits, unpriced, avgMargin };
  }, [rows]);

  return (
    <AdminShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("admin.expenses")}
          </h1>
          <p className="text-sm text-ink-500">
            Capital tied in stock and projected gross profit, computed from
            <code className="mx-1 rounded bg-ink-100 px-1 text-xs">
              (price − purchase_price) × stock
            </code>
            for every product in the catalog.
          </p>
        </header>

        {/* Top-line summary cards. Four equal columns at lg, two at md, one
            on mobile so each metric stays readable. */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            label="Capital tied in stock"
            value={formatCurrency(totals.capital, locale, currency)}
            hint={`${totals.stockUnits} units across ${rows.length} products`}
            icon="DollarSign"
            tone="ink"
          />
          <Card
            label="Projected revenue"
            value={formatCurrency(totals.revenue, locale, currency)}
            hint="If everything sells at list price"
            icon="ShoppingBag"
            tone="brand"
          />
          <Card
            label="Projected gross profit"
            value={formatCurrency(totals.profit, locale, currency)}
            hint="Revenue minus cost-of-goods"
            icon="TrendingUp"
            tone={totals.profit >= 0 ? "emerald" : "red"}
          />
          <Card
            label="Average margin"
            value={`${totals.avgMargin.toFixed(1)}%`}
            hint={
              totals.unpriced > 0
                ? `${totals.unpriced} product(s) have no purchase price set`
                : "Weighted by capital tied"
            }
            icon="TrendingUp"
            tone={totals.avgMargin >= 0 ? "emerald" : "red"}
          />
        </section>

        {/* Per-product breakdown. Reuses the same swipe-friendly table
            pattern as the rest of the admin. */}
        <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-ink-50 text-ink-600">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">Product</th>
                  <th className="px-4 py-3 text-end font-medium">Stock</th>
                  <th className="hidden px-4 py-3 text-end font-medium md:table-cell">
                    Cost
                  </th>
                  <th className="hidden px-4 py-3 text-end font-medium md:table-cell">
                    Sale
                  </th>
                  <th className="px-4 py-3 text-end font-medium">
                    Capital tied
                  </th>
                  <th className="px-4 py-3 text-end font-medium">
                    Projected profit
                  </th>
                  <th className="px-4 py-3 text-end font-medium">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {loading && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-ink-400"
                    >
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-ink-400"
                    >
                      No products yet — add some from the Inventory page.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.product.id} className="hover:bg-ink-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.product.image}
                          alt=""
                          className="h-10 w-10 flex-none rounded-lg object-cover bg-ink-100"
                          onError={(e) => {
                            e.currentTarget.src = "/favicon.svg";
                          }}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {r.product.name[locale]}
                          </div>
                          <div className="text-xs text-ink-500">
                            {r.product.sku}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-end">{r.product.stock}</td>
                    <td className="hidden px-4 py-3 text-end text-ink-600 md:table-cell">
                      {r.product.purchasePrice > 0
                        ? formatCurrency(
                            r.product.purchasePrice,
                            locale,
                            currency
                          )
                        : "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-end md:table-cell">
                      {formatCurrency(r.product.price, locale, currency)}
                    </td>
                    <td className="px-4 py-3 text-end font-medium">
                      {formatCurrency(r.capitalTied, locale, currency)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-end font-semibold",
                        r.projectedProfit < 0
                          ? "text-red-600"
                          : r.projectedProfit > 0
                          ? "text-emerald-600"
                          : "text-ink-500"
                      )}
                    >
                      {formatCurrency(r.projectedProfit, locale, currency)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {r.marginPct == null ? (
                        <span className="text-xs text-ink-400">—</span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            r.marginPct < 0
                              ? "bg-red-50 text-red-700"
                              : r.marginPct < 10
                              ? "bg-amber-50 text-amber-700"
                              : "bg-emerald-50 text-emerald-700"
                          )}
                        >
                          {r.marginPct.toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

// ---------- Local UI bits --------------------------------------------------

type CardTone = "ink" | "brand" | "emerald" | "red";

const TONE: Record<CardTone, { icon: string; ring: string }> = {
  ink: { icon: "bg-ink-900 text-white", ring: "ring-ink-100" },
  brand: { icon: "bg-brand-500 text-white", ring: "ring-brand-100" },
  emerald: { icon: "bg-emerald-500 text-white", ring: "ring-emerald-100" },
  red: { icon: "bg-red-500 text-white", ring: "ring-red-100" },
};

function Card({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: string;
  tone: CardTone;
}) {
  const palette = TONE[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft ring-1",
        palette.ring
      )}
    >
      <span
        className={cn(
          "grid h-10 w-10 flex-none place-items-center rounded-xl",
          palette.icon
        )}
      >
        <Icon name={icon} size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
          {label}
        </p>
        <p className="mt-0.5 truncate text-xl font-semibold tracking-tight">
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
      </div>
    </div>
  );
}
