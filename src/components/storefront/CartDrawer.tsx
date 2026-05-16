"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { Icon } from "../ui/Icon";
import { useCart } from "@/lib/store/cart";
import { useProducts, useSettings } from "@/lib/client/hooks";
import { formatCurrency } from "@/lib/format";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";

export function CartDrawer() {
  const { t, locale, dir } = useI18n();
  const isOpen = useCart((s) => s.isOpen);
  const close = useCart((s) => s.close);
  const items = useCart((s) => s.items);
  const setQuantity = useCart((s) => s.setQuantity);
  const removeItem = useCart((s) => s.removeItem);
  const clear = useCart((s) => s.clear);
  const { data: products } = useProducts();
  const settings = useSettings();
  const currency = settings?.currency ?? "USD";
  const taxRate = settings?.taxRate ?? 10;

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const lines = useMemo(() => {
    return items
      .map((i) => {
        const product = products.find((p) => p.id === i.productId);
        if (!product) return null;
        return { item: i, product };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
  }, [items, products]);

  const subtotal = lines.reduce(
    (s, { item, product }) => s + product.price * item.quantity,
    0
  );
  const tax = +(subtotal * (taxRate / 100)).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);

  if (!isOpen) return null;

  const drawerAnim = dir === "rtl" ? "animate-slide-in-left" : "animate-slide-in-right";

  return (
    <div className="fixed inset-0 z-50" aria-modal role="dialog">
      <div
        className="absolute inset-0 bg-ink-950/40 animate-fade-in"
        onClick={close}
      />
      <aside
        className={cn(
          "absolute inset-y-0 end-0 flex w-full max-w-md flex-col bg-white shadow-lift",
          drawerAnim
        )}
      >
        <div className="flex items-center justify-between border-b border-ink-100 p-4">
          <h2 className="text-lg font-semibold">{t("cart.title")}</h2>
          <button
            onClick={close}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-600 hover:bg-ink-100"
            aria-label="Close"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-ink-100 text-ink-500">
              <Icon name="ShoppingBag" size={26} />
            </div>
            <p className="text-ink-600">{t("cart.empty")}</p>
            <button
              onClick={close}
              className="inline-flex h-10 items-center rounded-xl bg-ink-900 px-4 text-sm font-medium text-white hover:bg-ink-800"
            >
              {t("cart.empty.cta")}
            </button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-ink-100 overflow-y-auto">
              {lines.map(({ item, product }) => (
                <li key={product.id} className="flex gap-3 p-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ink-50">
                    <Image
                      src={product.image}
                      alt={product.name[locale]}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-sm font-medium text-ink-900">
                        {product.name[locale]}
                      </h3>
                      <button
                        onClick={() => removeItem(product.id)}
                        aria-label={t("cart.remove")}
                        className="grid h-8 w-8 place-items-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-red-600"
                      >
                        <Icon name="Trash2" size={16} />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="inline-flex items-center rounded-xl border border-ink-200">
                        <button
                          onClick={() =>
                            setQuantity(product.id, item.quantity - 1)
                          }
                          className="grid h-8 w-8 place-items-center text-ink-700 hover:bg-ink-50"
                          aria-label="Decrease"
                        >
                          <Icon name="Minus" size={14} />
                        </button>
                        <span className="min-w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            setQuantity(product.id, item.quantity + 1)
                          }
                          className="grid h-8 w-8 place-items-center text-ink-700 hover:bg-ink-50"
                          aria-label="Increase"
                        >
                          <Icon name="Plus" size={14} />
                        </button>
                      </div>
                      <span className="text-sm font-semibold">
                        {formatCurrency(product.price * item.quantity, locale, currency)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-ink-100 p-4 space-y-2">
              <Row label={t("cart.subtotal")} value={formatCurrency(subtotal, locale, currency)} />
              <Row label={`${t("cart.tax").replace(/\(.*\)/, `(${taxRate}%)`)}`} value={formatCurrency(tax, locale, currency)} />
              <Row
                label={t("cart.total")}
                value={formatCurrency(total, locale, currency)}
                bold
              />
              <div className="flex gap-2 pt-2">
                <button
                  onClick={clear}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-ink-200 bg-white text-sm font-medium text-ink-700 hover:border-ink-300"
                >
                  {t("cart.clear")}
                </button>
                <Link
                  href="/checkout"
                  onClick={close}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-ink-900 text-sm font-medium text-white hover:bg-ink-800"
                >
                  {t("cart.checkout")}
                  <Icon name={dir === "rtl" ? "ArrowLeft" : "ArrowRight"} size={16} />
                </Link>
              </div>
            </div>
          </>
        )}
      </aside>
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
    <div
      className={cn(
        "flex items-center justify-between text-sm",
        bold ? "pt-1 text-base font-semibold text-ink-900" : "text-ink-600"
      )}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
