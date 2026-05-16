"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/ui/Icon";
import {
  useInvoices,
  useOrders,
  useSettings,
} from "@/lib/client/hooks";
import { apiSend } from "@/lib/client/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/useI18n";
import type { Invoice, Order } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<Invoice["status"], string> = {
  paid: "bg-emerald-50 text-emerald-700",
  unpaid: "bg-amber-50 text-amber-700",
  overdue: "bg-red-50 text-red-700",
};

/**
 * Opens the dedicated A4 print view in a new tab. We use target="_blank"
 * instead of window.print() on the list page so the admin:
 *   - gets a full-page preview before committing to print,
 *   - can keep the list open and print multiple invoices in parallel,
 *   - sees the proper "Save as PDF" option in the browser print dialog
 *     (which honours the @page size: A4 rule defined on the print page).
 */
function printUrl(invoice: Invoice) {
  return `/admin/invoices/${invoice.id}/print`;
}

export default function InvoicesAdminPage() {
  const { t, locale } = useI18n();
  const { data: invoices, reload } = useInvoices();
  const { data: orders } = useOrders();
  const settings = useSettings();
  const currency = settings?.currency ?? "USD";
  const [viewing, setViewing] = useState<Invoice | null>(null);

  async function togglePaid(inv: Invoice) {
    await apiSend(`/api/invoices/${inv.id}`, "PATCH", {
      status: inv.status === "paid" ? "unpaid" : "paid",
    });
    await reload();
  }

  const linkedOrder = (inv: Invoice) =>
    orders.find((o) => o.id === inv.orderId);

  return (
    <AdminShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("admin.invoices")}
          </h1>
          <p className="text-sm text-ink-500">
            Digital invoices are auto-generated at checkout.
          </p>
        </header>

        {/*
         * Responsive invoices table:
         *   - overflow-x-auto wrapper + min-w-[820px] table keeps every
         *     column readable while allowing horizontal scroll on phones.
         *   - Order / Issued / Due columns fold away on mobile; the
         *     invoice number cell folds the order id + issued date under
         *     itself so the data is still reachable.
         */}
        <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-ink-50 text-ink-600">
              <tr>
                <th className="px-4 py-3 text-start font-medium">Invoice</th>
                <th className="hidden px-4 py-3 text-start font-medium md:table-cell">
                  Order
                </th>
                <th className="hidden px-4 py-3 text-start font-medium lg:table-cell">
                  Issued
                </th>
                <th className="hidden px-4 py-3 text-start font-medium lg:table-cell">
                  Due
                </th>
                <th className="px-4 py-3 text-end font-medium">Amount</th>
                <th className="px-4 py-3 text-start font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-ink-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{inv.number}</div>
                    {/* Mobile: fold order id + issued date under the number. */}
                    <div className="mt-0.5 text-xs text-ink-500 md:hidden">
                      {inv.orderId} · {formatDate(inv.issuedAt, locale)}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-ink-600 md:table-cell">
                    {inv.orderId}
                  </td>
                  <td className="hidden px-4 py-3 text-ink-600 lg:table-cell">
                    {formatDate(inv.issuedAt, locale)}
                  </td>
                  <td className="hidden px-4 py-3 text-ink-600 lg:table-cell">
                    {formatDate(inv.dueAt, locale)}
                  </td>
                  <td className="px-4 py-3 text-end font-semibold">
                    {formatCurrency(inv.amount, locale, currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_TONE[inv.status]
                      )}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => setViewing(inv)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-ink-600 hover:bg-ink-100"
                        aria-label="View"
                        title="View"
                      >
                        <Icon name="FileText" size={16} />
                      </button>
                      <a
                        href={printUrl(inv)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="grid h-8 w-8 place-items-center rounded-lg text-ink-600 hover:bg-ink-100"
                        aria-label={t("invoice.print")}
                        title={t("invoice.print")}
                      >
                        <Icon name="Printer" size={16} />
                      </a>
                      <button
                        onClick={() => togglePaid(inv)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-ink-600 hover:bg-emerald-50 hover:text-emerald-600"
                        aria-label="Toggle paid"
                        title="Toggle paid"
                      >
                        <Icon name="CheckCircle2" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-ink-400">
                    No invoices.
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </div>
      </div>

      {viewing && (
        <InvoiceModal
          invoice={viewing}
          order={linkedOrder(viewing)}
          currency={currency}
          onClose={() => setViewing(null)}
        />
      )}
    </AdminShell>
  );
}

function InvoiceModal({
  invoice,
  order,
  currency,
  onClose,
}: {
  invoice: Invoice;
  order?: Order;
  currency: string;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-ink-950/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-lift">
        <header className="flex items-center justify-between border-b border-ink-100 p-4">
          <div>
            <h3 className="text-base font-semibold">{invoice.number}</h3>
            <p className="text-xs text-ink-500">
              Issued {formatDate(invoice.issuedAt, locale)} · Due{" "}
              {formatDate(invoice.dueAt, locale)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-600 hover:bg-ink-100"
            aria-label="Close"
          >
            <Icon name="X" size={18} />
          </button>
        </header>
        <div className="space-y-5 p-6">
          <section className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-500">
                Billed to
              </div>
              <div className="mt-1 font-medium">
                {order?.customer.name ?? "—"}
              </div>
              <div className="text-sm text-ink-600">
                {order?.customer.email}
              </div>
              <div className="text-sm text-ink-600">
                {order?.customer.address}
              </div>
            </div>
            <div className="text-end">
              <div className="text-xs uppercase tracking-wide text-ink-500">
                From
              </div>
              <div className="mt-1 font-medium">Nova Commerce</div>
              <div className="text-sm text-ink-600">hello@nova.shop</div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-ink-100">
            <table className="min-w-full text-sm">
              <thead className="bg-ink-50 text-ink-600">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">Item</th>
                  <th className="px-3 py-2 text-end font-medium">Qty</th>
                  <th className="px-3 py-2 text-end font-medium">Price</th>
                  <th className="px-3 py-2 text-end font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {(order?.items ?? []).map((it) => (
                  <tr key={it.productId}>
                    <td className="px-3 py-2">{it.name}</td>
                    <td className="px-3 py-2 text-end">{it.quantity}</td>
                    <td className="px-3 py-2 text-end">
                      {formatCurrency(it.price, locale, currency)}
                    </td>
                    <td className="px-3 py-2 text-end font-medium">
                      {formatCurrency(it.price * it.quantity, locale, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="space-y-1 text-sm">
            <div className="flex justify-between text-ink-600">
              <span>Subtotal</span>
              <span>{formatCurrency(order?.subtotal ?? 0, locale, currency)}</span>
            </div>
            <div className="flex justify-between text-ink-600">
              <span>Tax</span>
              <span>{formatCurrency(order?.tax ?? 0, locale, currency)}</span>
            </div>
            <div className="flex justify-between pt-1 text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(invoice.amount, locale, currency)}</span>
            </div>
          </section>
        </div>
        <footer className="flex justify-end gap-2 border-t border-ink-100 p-4">
          {/*
           * Opens the dedicated A4 print template in a new tab. This is the
           * "Print Invoice" flow requested in the spec: a professional,
           * corporate layout with the store logo, customer block, line
           * items table, and Thank-you footer — all tuned for A4 via the
           * print page's @page and @media print rules.
           */}
          <a
            href={printUrl(invoice)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink-900 px-4 text-sm font-medium text-white hover:bg-ink-800"
          >
            <Icon name="Printer" size={16} />
            {t("invoice.print")}
          </a>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-ink-200 bg-white px-4 text-sm font-medium text-ink-700 hover:border-ink-300"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
