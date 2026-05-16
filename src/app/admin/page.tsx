"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon, ICONS } from "@/components/ui/Icon";
import { apiGet } from "@/lib/client/api";
import { useRealtime } from "@/lib/client/realtime";
import { formatCurrency } from "@/lib/format";
import { useI18n } from "@/lib/useI18n";

interface Analytics {
  revenue: number;
  outstanding: number;
  orders: number;
  products: number;
  totalUsers: number;
  activeUsers: number;
  unpaid: number;
  orderStatus: {
    pending: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
  };
  topProducts: { productId: string; name: string; qty: number; revenue: number }[];
  lowStock: { id: string; name: string; stock: number; sku: string }[];
  series: { date: string; revenue: number; orders: number }[];
  currency: string;
}

export default function AdminHome() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<Analytics | null>(null);

  async function load() {
    try {
      const d = await apiGet<Analytics>("/api/analytics");
      setData(d);
    } catch {
      setData(null);
    }
  }

  useEffect(() => {
    load();
  }, []);
  useRealtime(["orders", "invoices", "products", "users", "settings"], load);

  const maxDayRevenue = Math.max(1, ...(data?.series.map((s) => s.revenue) ?? [0]));

  return (
    <AdminShell>
      <div className="space-y-6">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("admin.dashboard")}
            </h1>
            <p className="text-sm text-ink-500">
              Real-time overview of revenue, orders, users and stock.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            icon="DollarSign"
            label="Revenue (paid)"
            value={data ? formatCurrency(data.revenue, locale, data.currency) : "—"}
            hint={
              data
                ? `Outstanding ${formatCurrency(data.outstanding, locale, data.currency)}`
                : undefined
            }
            tone="brand"
          />
          <Stat
            icon="ShoppingCart"
            label="Total orders"
            value={data ? String(data.orders) : "—"}
            hint={
              data
                ? `${data.orderStatus.pending} pending · ${data.orderStatus.delivered} delivered`
                : undefined
            }
          />
          <Stat
            icon="Users"
            label="Active users"
            value={data ? String(data.activeUsers) : "—"}
            hint={data ? `of ${data.totalUsers} total` : undefined}
          />
          <Stat
            icon="AlertCircle"
            label="Stock alerts"
            value={data ? String(data.lowStock.length) : "—"}
            tone={data && data.lowStock.length > 0 ? "warn" : undefined}
          />
        </div>

        {data && (
          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Revenue · last 14 days</h2>
              <span className="text-xs text-ink-500">
                paid invoices only
              </span>
            </div>
            <div className="flex h-40 items-end gap-1">
              {data.series.map((d) => {
                const h = Math.round((d.revenue / maxDayRevenue) * 100);
                return (
                  <div
                    key={d.date}
                    className="group relative flex-1"
                    title={`${d.date} · ${formatCurrency(d.revenue, locale, data.currency)}`}
                  >
                    <div
                      className="w-full rounded-t bg-ink-900/80 transition group-hover:bg-brand-500"
                      style={{ height: `${Math.max(2, h)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-ink-400">
              <span>{data.series[0]?.date}</span>
              <span>{data.series[data.series.length - 1]?.date}</span>
            </div>
          </section>
        )}

        <div className="grid gap-4 lg:grid-cols-5">
          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft lg:col-span-3">
            <h2 className="mb-4 text-base font-semibold">Top products</h2>
            {data && data.topProducts.length > 0 ? (
              <ul className="space-y-3">
                {data.topProducts.map((p, i) => {
                  const max = data.topProducts[0]?.revenue || 1;
                  const pct = Math.round((p.revenue / max) * 100);
                  return (
                    <li key={p.productId}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {i + 1}. {p.name}
                        </span>
                        <span className="text-ink-600">
                          {formatCurrency(p.revenue, locale, data.currency)}{" "}
                          <span className="text-ink-400">· {p.qty} sold</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full bg-ink-900"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-ink-400">No sales yet.</p>
            )}
          </section>

          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft lg:col-span-2">
            <h2 className="mb-4 text-base font-semibold">Order status</h2>
            {data && (
              <div className="space-y-3">
                <Bar label="Pending" value={data.orderStatus.pending} total={data.orders} icon="Clock" color="bg-amber-500" />
                <Bar label="Processing" value={data.orderStatus.processing} total={data.orders} icon="RefreshCw" color="bg-blue-500" />
                <Bar label="Shipped" value={data.orderStatus.shipped} total={data.orders} icon="Truck" color="bg-brand-500" />
                <Bar label="Delivered" value={data.orderStatus.delivered} total={data.orders} icon="CheckCircle2" color="bg-emerald-500" />
                <Bar label="Cancelled" value={data.orderStatus.cancelled} total={data.orders} icon="XCircle" color="bg-red-500" />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft lg:col-span-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Stock alerts</h2>
              <Link
                href="/admin/inventory"
                className="text-sm text-brand-600 hover:underline"
              >
                Manage inventory
              </Link>
            </div>
            {data && data.lowStock.length > 0 ? (
              <ul className="divide-y divide-ink-100">
                {data.lowStock.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-ink-500">{p.sku}</div>
                    </div>
                    <span
                      className={
                        p.stock <= 10
                          ? "rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700"
                          : "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"
                      }
                    >
                      {p.stock} left
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-400">
                All products well stocked.
              </p>
            )}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: keyof typeof ICONS;
  label: string;
  value: string;
  hint?: string;
  tone?: "brand" | "warn";
}) {
  const toneClass =
    tone === "brand"
      ? "bg-brand-50 text-brand-700"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700"
      : "bg-ink-100 text-ink-700";
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${toneClass}`}>
          <Icon name={icon} size={18} />
        </span>
        <div className="min-w-0">
          <div className="text-xs text-ink-500">{label}</div>
          <div className="text-lg font-semibold">{value}</div>
          {hint && <div className="truncate text-xs text-ink-400">{hint}</div>}
        </div>
      </div>
    </div>
  );
}

function Bar({
  label,
  value,
  total,
  icon,
  color,
}: {
  label: string;
  value: number;
  total: number;
  icon: keyof typeof ICONS;
  color: string;
}) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <Icon name={icon} size={14} />
          {label}
        </span>
        <span className="text-ink-600">
          {value} <span className="text-ink-400">/ {total}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
