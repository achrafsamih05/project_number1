"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { apiGet } from "@/lib/client/api";
import { useMe, useSettings } from "@/lib/client/hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/useI18n";
import type { Invoice, Order, Settings } from "@/lib/types";

// ---------------------------------------------------------------------------
// Dedicated A4 print view for an invoice.
//
//   /admin/invoices/<id>/print
//
// Design
//   - Intentionally NOT wrapped in AdminShell so the sidebar, top bar, and
//     storefront footer don't leak into the printed document. Instead the
//     page has its own minimal "control bar" at the top (Print / Back) that
//     is hidden in print via a `print-hide` class (see @media print below).
//   - Uses Tailwind for on-screen styling and a small block of plain CSS
//     for the print-only rules. We prefer CSS over a library like
//     `react-to-print` so we don't have to add a dependency — browsers
//     already render @media print correctly when the page is designed for
//     print from the start.
//   - The invoice sheet is exactly `210mm` wide (A4 width) on print and a
//     max of 860px on screen, which is the sweet spot between "looks like
//     a document" and "readable in a modal-ish admin preview".
//
// Realtime
//   - `useSettings()` keeps the store name, contact info and currency in
//     sync with the admin Settings page; if the operator tweaks the store
//     name right before printing, this page reflects it without a reload.
// ---------------------------------------------------------------------------

export default function InvoicePrintPage({
  params,
}: {
  params: { id: string };
}) {
  const { t, locale } = useI18n();
  const settings = useSettings();
  const { data: me, loading: meLoading } = useMe();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Admin-only invoice fetch. We wait for `useMe()` to resolve before
  // firing the request so a brief anonymous flash doesn't trigger a 401
  // toast on the admin's own reload.
  useEffect(() => {
    if (meLoading) return;
    if (!me || me.role !== "admin") {
      setError("Unauthorized");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const inv = await apiGet<Invoice>(`/api/invoices/${params.id}`);
        if (cancelled) return;
        setInvoice(inv);
        const ord = await apiGet<Order>(`/api/orders/${inv.orderId}`);
        if (cancelled) return;
        setOrder(ord);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, me, meLoading]);

  if (error) {
    return (
      <Shell>
        <div className="mx-auto max-w-xl py-16 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <Link
            href="/admin/invoices"
            className="mt-4 inline-flex items-center gap-2 text-sm text-ink-700 hover:text-ink-900"
          >
            <Icon name="ArrowLeft" size={16} />
            {t("invoice.back")}
          </Link>
        </div>
      </Shell>
    );
  }

  if (!invoice || !order || !settings) {
    return (
      <Shell>
        <div className="py-16 text-center text-ink-400">Loading…</div>
      </Shell>
    );
  }

  return (
    <Shell>
      <ControlBar onPrint={() => window.print()} />
      <InvoiceSheet
        invoice={invoice}
        order={order}
        settings={settings}
        locale={locale}
        t={t}
      />
    </Shell>
  );
}

// ============================================================================
// Shell + control bar
// ============================================================================

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink-100 print:bg-white">
      {/*
       * Print-specific CSS. Scoped via `data-invoice-print` so it only
       * affects this page. The rules:
       *   - Force A4 geometry and remove default browser headers/footers.
       *   - Hide anything marked `.print-hide` (control bar, breadcrumbs).
       *   - Strip the gray backdrop so the paper is truly white.
       *   - Preserve background colors (status pill, header band) via
       *     print-color-adjust: exact.
       */}
      <style jsx global>{`
        @page {
          size: A4;
          margin: 14mm 12mm;
        }
        @media print {
          html,
          body {
            background: #ffffff !important;
          }
          .print-hide {
            display: none !important;
          }
          .print-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
          }
          .print-sheet * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      {children}
    </div>
  );
}

function ControlBar({ onPrint }: { onPrint: () => void }) {
  const { t } = useI18n();
  return (
    <div className="print-hide sticky top-0 z-10 border-b border-ink-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-[860px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/admin/invoices"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 hover:border-ink-300"
        >
          <Icon name="ArrowLeft" size={16} />
          {t("invoice.back")}
        </Link>
        <button
          onClick={onPrint}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink-900 px-4 text-sm font-medium text-white hover:bg-ink-800"
        >
          <Icon name="Printer" size={16} />
          {t("invoice.print")}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// The actual invoice sheet (the thing that gets printed)
// ============================================================================

const STATUS_COPY: Record<Invoice["status"], string> = {
  paid: "PAID",
  unpaid: "UNPAID",
  overdue: "OVERDUE",
};

const STATUS_COLOR: Record<Invoice["status"], string> = {
  paid: "bg-emerald-600 text-white",
  unpaid: "bg-amber-500 text-white",
  overdue: "bg-red-600 text-white",
};

function InvoiceSheet({
  invoice,
  order,
  settings,
  locale,
  t,
}: {
  invoice: Invoice;
  order: Order;
  settings: Settings;
  locale: "en" | "ar" | "fr";
  t: (key: string) => string;
}) {
  const { storeName, currency } = settings;
  const lines = order.items.map((it) => ({
    ...it,
    total: it.price * it.quantity,
  }));
  const subtotal = order.subtotal;
  const tax = order.tax;
  const total = invoice.amount;

  return (
    <div className="mx-auto my-8 w-full max-w-[860px] px-4 sm:px-6 print:m-0 print:max-w-none print:px-0">
      <article
        className="print-sheet relative overflow-hidden rounded-2xl bg-white text-ink-900 shadow-lift print:rounded-none print:shadow-none"
        style={{ minHeight: "267mm" }}
        data-invoice-print
      >
        {/* Accent band at the top — kept slim so it stays tasteful on print */}
        <div className="h-2 bg-ink-900" />

        <div className="p-8 sm:p-12">
          {/* ==== Header: logo/brand on the left, invoice meta on the right ==== */}
          <header className="flex flex-col gap-6 border-b border-ink-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-ink-900 text-2xl font-bold text-white">
                {storeName.trim().charAt(0).toUpperCase() || "N"}
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {storeName}
                </h1>
                {settings.footerTagline && (
                  <p className="mt-1 max-w-xs text-sm text-ink-500">
                    {settings.footerTagline}
                  </p>
                )}
              </div>
            </div>

            <div className="text-end">
              <div className="text-xs uppercase tracking-[0.2em] text-ink-400">
                {t("invoice.title")}
              </div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">
                {invoice.number}
              </div>
              <div
                className={`mt-2 inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLOR[invoice.status]}`}
              >
                {STATUS_COPY[invoice.status]}
              </div>
            </div>
          </header>

          {/* ==== Parties + meta grid ==== */}
          <section className="mt-8 grid gap-8 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                {t("invoice.billTo")}
              </div>
              <div className="mt-2 space-y-0.5 text-sm">
                <div className="font-semibold text-ink-900">
                  {order.customer.name}
                </div>
                {order.customer.email && (
                  <div className="text-ink-600">{order.customer.email}</div>
                )}
                {order.customer.phone && (
                  <div className="text-ink-600">{order.customer.phone}</div>
                )}
                {order.customer.address && (
                  <div className="text-ink-600">{order.customer.address}</div>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                {t("invoice.from")}
              </div>
              <div className="mt-2 space-y-0.5 text-sm">
                <div className="font-semibold text-ink-900">{storeName}</div>
                {settings.contactEmail && (
                  <div className="text-ink-600">{settings.contactEmail}</div>
                )}
                {settings.contactPhone && (
                  <div className="text-ink-600">{settings.contactPhone}</div>
                )}
                {settings.address && (
                  <div className="text-ink-600">{settings.address}</div>
                )}
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 rounded-xl border border-ink-100 bg-ink-50 p-4 text-sm sm:grid-cols-3 print:bg-ink-50">
            <MetaRow label={t("invoice.number")} value={invoice.number} />
            <MetaRow
              label={t("invoice.issued")}
              value={formatDate(invoice.issuedAt, locale)}
            />
            <MetaRow
              label={t("invoice.due")}
              value={formatDate(invoice.dueAt, locale)}
            />
          </section>

          {/* ==== Items table ==== */}
          <section className="mt-8">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-[11px] uppercase tracking-wider text-ink-500">
                  <th className="py-3 pe-3 font-semibold">{t("invoice.item")}</th>
                  <th className="py-3 px-3 text-end font-semibold">
                    {t("invoice.qty")}
                  </th>
                  <th className="py-3 px-3 text-end font-semibold">
                    {t("invoice.unitPrice")}
                  </th>
                  <th className="py-3 ps-3 text-end font-semibold">
                    {t("invoice.lineTotal")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-6 text-center text-ink-400"
                    >
                      —
                    </td>
                  </tr>
                )}
                {lines.map((it) => (
                  <tr
                    key={it.productId}
                    className="border-b border-ink-100 align-top"
                  >
                    <td className="py-3 pe-3">
                      <div className="font-medium text-ink-900">{it.name}</div>
                      <div className="text-xs text-ink-500">#{it.productId}</div>
                    </td>
                    <td className="py-3 px-3 text-end tabular-nums">
                      {it.quantity}
                    </td>
                    <td className="py-3 px-3 text-end tabular-nums">
                      {formatCurrency(it.price, locale, currency)}
                    </td>
                    <td className="py-3 ps-3 text-end font-semibold tabular-nums">
                      {formatCurrency(it.total, locale, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ==== Totals ==== */}
          <section className="mt-6 flex justify-end">
            <dl className="w-full max-w-xs space-y-1 text-sm">
              <div className="flex items-baseline justify-between">
                <dt className="text-ink-500">{t("invoice.subtotal")}</dt>
                <dd className="font-medium tabular-nums">
                  {formatCurrency(subtotal, locale, currency)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-ink-500">
                  {t("invoice.tax")}
                  {settings.taxRate > 0 && (
                    <span className="ms-1 text-xs text-ink-400">
                      ({settings.taxRate}%)
                    </span>
                  )}
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatCurrency(tax, locale, currency)}
                </dd>
              </div>
              <div className="mt-2 flex items-baseline justify-between border-t border-ink-900 pt-2 text-base">
                <dt className="font-semibold">{t("invoice.total")}</dt>
                <dd className="font-bold tabular-nums">
                  {formatCurrency(total, locale, currency)}
                </dd>
              </div>
            </dl>
          </section>

          {/* ==== Footer: thank-you + contact fallback ==== */}
          <footer className="mt-16 border-t border-ink-100 pt-6 text-sm">
            <div className="text-lg font-semibold tracking-tight">
              {t("invoice.thankYou")}
            </div>
            <p className="mt-1 text-ink-500">
              {storeName} · {t("invoice.number")} {invoice.number}
            </p>
            {(settings.contactEmail ||
              settings.contactPhone ||
              settings.address) && (
              <p className="mt-3 text-xs text-ink-500">
                {[settings.contactEmail, settings.contactPhone, settings.address]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </footer>
        </div>
      </article>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
        {label}
      </div>
      <div className="mt-0.5 font-medium text-ink-900">{value}</div>
    </div>
  );
}
