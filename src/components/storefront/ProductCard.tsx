"use client";

import { useState } from "react";
import Image from "next/image";
import { Icon } from "../ui/Icon";
import { useCart } from "@/lib/store/cart";
import { toast } from "@/lib/store/toast";
import { useSettings } from "@/lib/client/hooks";
import { formatCurrency } from "@/lib/format";
import { useI18n } from "@/lib/useI18n";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

// Shipped placeholder used when the real image fails to load. Living in
// /public means it's always served from the same origin, so it can never
// itself trigger the fallback.
const FALLBACK_IMAGE = "/favicon.svg";

export function ProductCard({
  product,
  onQuickView,
}: {
  product: Product;
  /**
   * Fired when the user activates the card itself (click / Enter / Space)
   * or the explicit "Quick view" hover button. The grid owns the modal
   * state, so the card just reports the intent.
   */
  onQuickView?: () => void;
}) {
  const { t, locale } = useI18n();
  const addItem = useCart((s) => s.addItem);
  const settings = useSettings();
  const currency = settings?.currency ?? "USD";
  const outOfStock = product.stock <= 0;

  // ---------------------------------------------------------------------------
  // Image handling (unchanged from the pre-Quick-View version).
  //   - Try `products.image` (which is always `images[0]` after normalisation).
  //   - On the first failure, log the offending URL and swap in the local
  //     fallback image, rendered `unoptimized` to bypass next/image's host
  //     whitelist and prove the real URL is reachable.
  // ---------------------------------------------------------------------------
  const [imgSrc, setImgSrc] = useState<string>(product.image || FALLBACK_IMAGE);
  const [failed, setFailed] = useState(false);

  function onImageError() {
    if (failed) return;
    // eslint-disable-next-line no-console
    console.error(
      `[ProductCard] image failed to load for product ${product.id} (${product.sku}). ` +
        `URL: ${product.image}. ` +
        `Likely causes: (1) hostname missing from next.config.mjs images.remotePatterns, ` +
        `(2) Supabase bucket 'product-images' not public / missing SELECT policy, ` +
        `(3) the stored value is a path fragment instead of a full https:// URL.`
    );
    setImgSrc(FALLBACK_IMAGE);
    setFailed(true);
  }

  function handleActivate() {
    onQuickView?.();
  }

  // Keyboard activation of the card surface (Enter / Space). We render the
  // card as a <div role="button"> instead of a <button> because we still
  // want a real nested <button> for the cart CTA, and nesting buttons is
  // invalid HTML.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      // Only activate when the card surface itself has focus, not when the
      // key was pressed inside the Add-to-Cart button. Otherwise the
      // button's own click handler plus ours both fire.
      if (e.currentTarget === e.target) {
        e.preventDefault();
        handleActivate();
      }
    }
  }

  return (
    <article
      role={onQuickView ? "button" : undefined}
      tabIndex={onQuickView ? 0 : undefined}
      aria-label={
        onQuickView
          ? `${product.name[locale]} — ${t("product.quickView")}`
          : undefined
      }
      onClick={onQuickView ? handleActivate : undefined}
      onKeyDown={onQuickView ? onKeyDown : undefined}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft transition hover:shadow-lift",
        onQuickView && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-ink-900/60"
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-ink-50">
        <Image
          src={imgSrc}
          alt={product.name[locale]}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
          unoptimized={failed}
          onError={onImageError}
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute top-2 start-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-ink-700 backdrop-blur">
          <Icon name="Star" size={12} className="text-amber-500" />
          {product.rating.toFixed(1)}
        </div>

        {/* Small hint pill announcing multi-image products — a light
            "+N" indicator so shoppers know there's more to see in the
            Quick View. Only visible when the gallery has more than one
            entry. */}
        {product.images.length > 1 && (
          <div className="absolute top-2 end-2 inline-flex items-center gap-1 rounded-full bg-ink-900/80 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            <Icon name="LayoutGrid" size={10} />+{product.images.length - 1}
          </div>
        )}

        {/* Quick View affordance on hover/focus. Pointer-events-none on the
            parent absolute layer keeps the hit-target on the underlying card
            (so the whole card is clickable), and we lift just the button
            itself with pointer-events-auto. */}
        {onQuickView && (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-3 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
            <span className="pointer-events-none inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-ink-800 shadow-soft backdrop-blur">
              <Icon name="Eye" size={12} />
              {t("product.quickView")}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink-900 sm:text-base">
          {product.name[locale]}
        </h3>
        <p className="line-clamp-2 text-xs text-ink-500 sm:text-sm">
          {product.description[locale]}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-base font-semibold tracking-tight sm:text-lg">
            {formatCurrency(product.price, locale, currency)}
          </span>
          <span
            className={cn(
              "text-xs font-medium",
              outOfStock ? "text-red-600" : "text-emerald-600"
            )}
          >
            {outOfStock ? t("product.outOfStock") : t("product.inStock")}
          </span>
        </div>

        {/*
         * Add-to-cart stays as a separate, explicit action. We stop the
         * click from bubbling so it doesn't also open the Quick View — the
         * CTA is for shoppers who already know what they want; the card
         * surface (everywhere else) is for shoppers who want more detail.
         *
         * Cart drawer no longer auto-opens (see src/lib/store/cart.ts) —
         * we surface a toast instead. The cart icon in the Toolbar and
         * BottomNav remain the explicit "view my cart" affordances.
         */}
        <button
          disabled={outOfStock}
          onClick={(e) => {
            e.stopPropagation();
            addItem(product.id, 1);
            toast.success(`${product.name[locale]} added to cart`, {
              icon: "ShoppingBag",
            });
          }}
          onKeyDown={(e) => {
            // Also prevent Enter/Space on the button from triggering the
            // card's keyboard handler above.
            if (e.key === "Enter" || e.key === " ") e.stopPropagation();
          }}
          className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-ink-900 text-sm font-medium text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-300"
        >
          <Icon name="Plus" size={16} />
          {t("product.add")}
        </button>
      </div>
    </article>
  );
}
