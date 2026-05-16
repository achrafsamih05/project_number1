"use client";

// ---------------------------------------------------------------------------
// /track — public customer-facing order tracking page.
//
// Pairs with GET /api/orders/track?id=…&email=…  (see route.ts for the
// security model — id + email act as a paired bearer secret, no auth
// session required). This page renders:
//
//   1. A simple form that takes order id + email.
//   2. After a successful lookup, the order status, items, totals and a
//      shipping address snapshot — using the *redacted* email returned by
//      the API so a screenshot doesn't leak the contact address.
//
// Deliberately minimal: no auth, no profile lookup, no realtime — refresh
// the form to re-fetch. Anyone with the order id + matching email can see
// their own order; everyone else gets a generic 404 message.
// ---------------------------------------------------------------------------

import { FormEvent, useState } from "react";
import { StoreShell } from "@/components/storefront/StoreShell";
import { Icon } from "@/components/ui/Icon";
import { useSettings } from "@/lib/client/hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";

interface PublicOrder {
  id: string;
  status: string;
  createdAt: string;
  customer: { name: string; email?: string; phone: string; address: string };
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  tax: number;
  total: number;
}

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  processing: "bg-blue-50 text-blue-700",
  shipped: "bg-brand-50 text-brand-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
};

export default function TrackPage() {
  const { locale } = useI18n();
  const settings = useSettings();
  const currency = settings?.currency ?? "USD";

  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOrder(null);
    if (!orderId.trim()) {
      setError("Order ID is required.");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setError("Please enter either your phone number or email.");
      return;
    }
    setLoading(true);
    try {
      // Build query params — send whichever identifier(s) the user provided.
      const params = new URLSearchParams({ id: orderId.trim() });
      if (phone.trim()) params.set("phone", phone.trim());
      if (email.trim()) params.set("email", email.trim());

      const res = await fetch(
        `/api/orders/track?${params.toString()}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 404
            ? "We couldn't find an order matching those details."
            : json.error ?? "Lookup failed."
        );
        return;
      }
      setOrder(json.data as PublicOrder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <StoreShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            Track your order
          </h1>
          <p className="text-sm text-ink-500">
            Enter your order ID and phone number to check the status. You can
            also use your email if you provided one during checkout.
          </p>
        </header>

        <form
          onSubmit={lookup}
          className="space-y-3 rounded-2xl border border-ink-100 bg-white p-5 shadow-soft"
        >
          <Field label="Order ID">
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="o-1042"
              autoComplete="off"
              className={inputCls}
            />
          </Field>
          <Field label="Phone number">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05 55 12 34 56"
              autoComplete="tel"
              className={inputCls}
            />
          </Field>
          <Field label="Email (optional)">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className={inputCls}
            />
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-900 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-60"
          >
            <Icon name="Search" size={16} />
            {loading ? "Looking up…" : "Track order"}
          </button>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </form>

        {order && (
          <section className="space-y-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">Order {order.id}</h2>
                <p className="text-xs text-ink-500">
                  Placed {formatDate(order.createdAt, locale)}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                  STATUS_TONE[order.status] ?? "bg-ink-100 text-ink-700"
                )}
              >
                {order.status[0].toUpperCase() + order.status.slice(1)}
              </span>
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              <Block label="Customer">
                <p className="text-sm font-medium">{order.customer.name}</p>
                <p className="text-xs text-ink-500">{order.customer.phone}</p>
                {order.customer.email && (
                  <p className="text-xs text-ink-500">{order.customer.email}</p>
                )}
              </Block>
              <Block label="Shipping address">
                <p className="text-sm whitespace-pre-line">
                  {order.customer.address}
                </p>
              </Block>
            </div>

            <Block label="Items">
              <ul className="divide-y divide-ink-100 text-sm">
                {order.items.map((it, i) => (
                  <li
                    key={`${it.name}-${i}`}
                    className="flex items-center justify-between py-2"
                  >
                    <span>
                      {it.name} <span className="text-ink-500">× {it.quantity}</span>
                    </span>
                    <span className="font-medium">
                      {formatCurrency(it.price * it.quantity, locale, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </Block>

            <div className="space-y-1 border-t border-ink-100 pt-3 text-sm">
              <Row label="Subtotal" value={formatCurrency(order.subtotal, locale, currency)} />
              <Row label="Tax" value={formatCurrency(order.tax, locale, currency)} />
              <Row
                label="Total"
                value={formatCurrency(order.total, locale, currency)}
                bold
              />
            </div>
          </section>
        )}
      </div>
    </StoreShell>
  );
}

const inputCls =
  "h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm focus:border-ink-900 focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-700">{label}</span>
      {children}
    </label>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </h3>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn(bold ? "font-semibold" : "text-ink-600")}>{label}</span>
      <span className={cn(bold ? "font-semibold" : "")}>{value}</span>
    </div>
  );
}
