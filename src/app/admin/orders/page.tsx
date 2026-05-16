"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/ui/Icon";
import { apiSend } from "@/lib/client/api";
import { useOrders, useSettings } from "@/lib/client/hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/useI18n";
import type { Order, OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  processing: "bg-blue-50 text-blue-700",
  shipped: "bg-brand-50 text-brand-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
};

export default function OrdersAdminPage() {
  const { t, locale } = useI18n();
  const { data: orders, reload } = useOrders();
  const settings = useSettings();
  const currency = settings?.currency ?? "USD";
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  // Holds the order currently being edited in the modal. We store the full
  // Order (snapshot at the moment "Edit" was clicked) so the edit form has
  // a stable starting point even if the underlying list re-fetches.
  const [editing, setEditing] = useState<Order | null>(null);

  async function setStatus(id: string, status: OrderStatus) {
    await apiSend(`/api/orders/${id}`, "PATCH", { status });
    await reload();
  }

  const filtered = orders.filter(
    (o) => filter === "all" || o.status === filter
  );

  return (
    <AdminShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("admin.orders")}
          </h1>
          <p className="text-sm text-ink-500">
            Track, edit, and update every order in real time.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          <Chip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label={`All (${orders.length})`}
          />
          {STATUSES.map((s) => {
            const c = orders.filter((o) => o.status === s).length;
            return (
              <Chip
                key={s}
                active={filter === s}
                onClick={() => setFilter(s)}
                label={`${label(s)} (${c})`}
              />
            );
          })}
        </div>

        {/*
         * Responsive orders table. Same swipe-friendly pattern as the rest
         * of the admin: horizontal scroll on small screens, dense columns
         * at lg+.
         */}
        <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-ink-50 text-ink-600">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">Order</th>
                  <th className="hidden px-4 py-3 text-start font-medium md:table-cell">
                    Customer
                  </th>
                  <th className="hidden px-4 py-3 text-start font-medium lg:table-cell">
                    Date
                  </th>
                  <th className="px-4 py-3 text-end font-medium">Total</th>
                  <th className="px-4 py-3 text-start font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((o) => (
                  <Fragment key={o.id}>
                    <tr className="hover:bg-ink-50/50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{o.id}</div>
                        <div className="mt-0.5 text-xs text-ink-500 md:hidden">
                          {o.customer.name} · {formatDate(o.createdAt, locale)}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <div className="font-medium">{o.customer.name}</div>
                        <div className="text-xs text-ink-500">
                          {o.customer.email}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-ink-600 lg:table-cell">
                        {formatDate(o.createdAt, locale)}
                      </td>
                      <td className="px-4 py-3 text-end font-semibold">
                        {formatCurrency(o.total, locale, currency)}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={o.status}
                          onChange={(e) =>
                            setStatus(o.id, e.target.value as OrderStatus)
                          }
                          className={cn(
                            "h-8 rounded-lg border-0 px-2 text-xs font-medium",
                            STATUS_TONE[o.status]
                          )}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {label(s)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => setEditing(o)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-600 hover:bg-ink-100"
                            aria-label="Edit order"
                            title="Edit order"
                          >
                            <Icon name="Edit" size={16} />
                          </button>
                          <button
                            onClick={() =>
                              setExpanded(expanded === o.id ? null : o.id)
                            }
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-600 hover:bg-ink-100"
                            aria-label="Expand"
                          >
                            <Icon
                              name={
                                expanded === o.id ? "ChevronLeft" : "ChevronRight"
                              }
                              size={16}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded === o.id && (
                      <tr className="bg-ink-50/50">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
                                Shipping
                              </h4>
                              <p className="text-sm">{o.customer.address}</p>
                              <p className="text-sm text-ink-600">
                                {o.customer.phone}
                              </p>
                            </div>
                            <div>
                              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
                                Items
                              </h4>
                              <ul className="text-sm">
                                {o.items.map((it) => (
                                  <li
                                    key={it.productId}
                                    className="flex justify-between"
                                  >
                                    <span>
                                      {it.name} × {it.quantity}
                                    </span>
                                    <span className="font-medium">
                                      {formatCurrency(
                                        it.price * it.quantity,
                                        locale,
                                        currency
                                      )}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-ink-400">
                      No orders.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && (
        <OrderEditor
          order={editing}
          currency={currency}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
    </AdminShell>
  );
}

function label(s: OrderStatus) {
  return s[0].toUpperCase() + s.slice(1);
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-ink-900 bg-ink-900 text-white"
          : "border-ink-200 bg-white text-ink-700 hover:border-ink-300"
      )}
    >
      {label}
    </button>
  );
}

// ===========================================================================
// Order editor modal
//
// Edit fields:
//   - customer: name, email, phone, full shipping address (single textarea —
//     orders.customer_address is a single TEXT column, so we keep the form
//     consistent with the storage shape).
//   - items: per-row name / qty / unit price; can remove rows.
//   - totals: tax is editable (so admins can apply a discount/refund), and
//     `subtotal` and `total` are computed live from the items + tax.
//
// Validation on the client mirrors what the server enforces (PATCH route),
// so a busy admin gets immediate feedback before sending the request.
// ===========================================================================

interface DraftItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

function OrderEditor({
  order,
  currency,
  onClose,
  onSaved,
}: {
  order: Order;
  currency: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { locale } = useI18n();

  // Customer block
  const [name, setName] = useState(order.customer.name);
  const [email, setEmail] = useState(order.customer.email ?? "");
  const [phone, setPhone] = useState(order.customer.phone ?? "");
  const [address, setAddress] = useState(order.customer.address);

  // Items + tax
  const [items, setItems] = useState<DraftItem[]>(
    order.items.map((i) => ({ ...i }))
  );
  const [tax, setTax] = useState<number>(order.tax);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll while the modal is open. Same pattern as CartDrawer.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const subtotal = useMemo(
    () =>
      +items
        .reduce(
          (s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0),
          0
        )
        .toFixed(2),
    [items]
  );
  const total = useMemo(
    () => +(subtotal + (Number(tax) || 0)).toFixed(2),
    [subtotal, tax]
  );

  function patchItem(idx: number, change: Partial<DraftItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...change } : it))
    );
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function addItem() {
    setItems((prev) => [
      ...prev,
      { productId: "", name: "", quantity: 1, price: 0 },
    ]);
  }

  async function submit() {
    setError(null);

    // Client-side validation matches the server contract.
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError("Name, phone and address are required.");
      return;
    }
    if (items.length === 0) {
      setError("Order must have at least one item.");
      return;
    }
    for (const [i, it] of items.entries()) {
      if (!it.productId.trim()) {
        setError(`items[${i + 1}].productId is required.`);
        return;
      }
      if (it.quantity < 1) {
        setError(`items[${i + 1}].quantity must be at least 1.`);
        return;
      }
      if (it.price < 0) {
        setError(`items[${i + 1}].price cannot be negative.`);
        return;
      }
    }

    setSaving(true);
    try {
      await apiSend(`/api/orders/${order.id}`, "PATCH", {
        customer: {
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim(),
          address: address.trim(),
        },
        items: items.map((it) => ({
          productId: it.productId.trim(),
          name: it.name.trim() || "Item",
          quantity: Math.max(1, Math.floor(Number(it.quantity) || 0)),
          price: Math.max(0, Number(it.price) || 0),
        })),
        subtotal,
        tax: Math.max(0, Number(tax) || 0),
        total,
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-ink-950/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-lift">
        <header className="flex items-center justify-between border-b border-ink-100 p-4">
          <div>
            <h3 className="text-base font-semibold">Edit order</h3>
            <p className="text-xs text-ink-500">{order.id}</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-600 hover:bg-ink-100"
            aria-label="Close"
          >
            <Icon name="X" size={18} />
          </button>
        </header>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-4">
          {/* Customer section */}
          <section>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Customer
            </h4>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Phone">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Shipping address" wide>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className={inputCls}
                />
              </Field>
            </div>
          </section>

          {/* Items section */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Items
              </h4>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-ink-200 bg-white px-2 text-xs font-medium text-ink-700 hover:border-ink-300"
              >
                <Icon name="Plus" size={14} /> Add item
              </button>
            </div>

            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-200 bg-ink-50 p-4 text-center text-sm text-ink-500">
                No items — add at least one to keep the order valid.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((it, idx) => (
                  <li
                    key={`${it.productId}-${idx}`}
                    className="rounded-xl border border-ink-100 bg-ink-50/40 p-3"
                  >
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_80px_120px_auto]">
                      <input
                        value={it.productId}
                        onChange={(e) =>
                          patchItem(idx, { productId: e.target.value })
                        }
                        placeholder="Product id"
                        className={cn(inputCls, "h-9 text-xs")}
                      />
                      <input
                        value={it.name}
                        onChange={(e) => patchItem(idx, { name: e.target.value })}
                        placeholder="Item name"
                        className={cn(inputCls, "h-9 text-xs")}
                      />
                      <input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) =>
                          patchItem(idx, { quantity: Number(e.target.value) })
                        }
                        className={cn(inputCls, "h-9 text-xs text-end")}
                      />
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={it.price}
                        onChange={(e) =>
                          patchItem(idx, { price: Number(e.target.value) })
                        }
                        className={cn(inputCls, "h-9 text-xs text-end")}
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="grid h-9 w-9 place-items-center rounded-lg text-ink-600 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove item"
                      >
                        <Icon name="Trash2" size={14} />
                      </button>
                    </div>
                    <div className="mt-1 text-end text-xs text-ink-500">
                      Line total:{" "}
                      <span className="font-medium text-ink-700">
                        {formatCurrency(
                          it.quantity * it.price,
                          locale,
                          currency
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Totals section */}
          <section className="rounded-xl border border-ink-100 bg-white p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Totals
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-600">Subtotal</span>
                <span className="font-medium">
                  {formatCurrency(subtotal, locale, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-ink-600">Tax</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={tax}
                  onChange={(e) => setTax(Number(e.target.value))}
                  className={cn(inputCls, "h-9 max-w-[160px] text-end")}
                />
              </div>
              <div className="flex items-center justify-between border-t border-ink-100 pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatCurrency(total, locale, currency)}</span>
              </div>
            </div>
          </section>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-ink-100 p-4">
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-ink-200 bg-white px-4 text-sm font-medium text-ink-700 hover:border-ink-300"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink-900 px-4 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-60"
          >
            <Icon name="Save" size={16} />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm focus:border-ink-900 focus:outline-none";

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", wide && "md:col-span-2")}>
      <span className="mb-1 block text-xs font-medium text-ink-600">
        {label}
      </span>
      {children}
    </label>
  );
}
