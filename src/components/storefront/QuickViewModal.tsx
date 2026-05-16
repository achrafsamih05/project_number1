"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { useCart } from "@/lib/store/cart";
import { toast } from "@/lib/store/toast";
import { useSettings } from "@/lib/client/hooks";
import { formatCurrency } from "@/lib/format";
import { useI18n } from "@/lib/useI18n";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// QuickViewModal — floating "Quick View" popup shown when a shopper clicks a
// product card on the main grid.
//
// Layout: centered, max-w-4xl, two-column on md+ (image gallery | details).
// Behaviour:
//   - Opens as a portal-style overlay with a dimmed, animated backdrop that
//     closes the modal on click.
//   - Traps `Escape` to close, locks body scroll while open.
//   - Image gallery has a main image + thumbnail strip and left/right arrows
//     for keyboard & touch users. When a product only has one image the
//     navigation chrome is hidden so the component still looks clean.
//   - Quantity selector is clamped to 1..stock so the user can't add more
//     than what's in stock.
//   - Add to Cart calls the existing Zustand cart store, which pops the
//     side drawer open — identical behaviour to the card CTA.
//
// Design: modern minimal — rounded-2xl, soft shadow, generous padding,
// logical utilities (start-*/end-*) so RTL (Arabic) renders correctly.
// ---------------------------------------------------------------------------

const FALLBACK_IMAGE = "/favicon.svg";

export function QuickViewModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { t, locale, dir } = useI18n();
  const addItem = useCart((s) => s.addItem);
  const settings = useSettings();
  const currency = settings?.currency ?? "USD";
  const outOfStock = product.stock <= 0;

  // Defensive: product.images is always non-empty thanks to productFromRow,
  // but we sanity-check here so we never render an <Image> with src="".
  const images = useMemo(
    () =>
      product.images.length > 0
        ? product.images
        : product.image
        ? [product.image]
        : [FALLBACK_IMAGE],
    [product.images, product.image]
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Reset the gallery when the modal opens for a different product.
  useEffect(() => {
    setActiveIndex(0);
    setQuantity(1);
  }, [product.id]);

  // ---- Body scroll lock + Escape-to-close ---------------------------------
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (images.length > 1) {
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft") prev1();
      }
    };
    window.addEventListener("keydown", onKey);
    // Move focus into the dialog so screen readers pick it up and keyboard
    // users don't stay focused on the triggering card.
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, images.length]);

  function next() {
    setActiveIndex((i) => (i + 1) % images.length);
  }
  function prev1() {
    setActiveIndex((i) => (i - 1 + images.length) % images.length);
  }

  function dec() {
    setQuantity((q) => Math.max(1, q - 1));
  }
  function inc() {
    // Stock is the true upper bound. If the product is flagged out of stock
    // the CTA is disabled anyway, but we still clamp here.
    setQuantity((q) => Math.min(Math.max(product.stock, 1), q + 1));
  }
  function onQuantityInput(e: React.ChangeEvent<HTMLInputElement>) {
    const n = parseInt(e.target.value, 10);
    if (!Number.isFinite(n)) {
      setQuantity(1);
      return;
    }
    setQuantity(Math.max(1, Math.min(Math.max(product.stock, 1), n)));
  }

  function onAddToCart() {
    if (outOfStock) return;
    addItem(product.id, quantity);
    // Cart drawer no longer auto-opens (see src/lib/store/cart.ts). We
    // close the modal so the user is back in the catalog and surface a
    // toast as silent confirmation. The cart icon in the Toolbar is the
    // explicit "view cart" affordance.
    toast.success(`${product.name[locale]} × ${quantity} added to cart`, {
      icon: "ShoppingBag",
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quickview-title"
    >
      {/* Dimmed, slightly-blurred backdrop. Click anywhere on it to dismiss. */}
      <button
        type="button"
        aria-label={t("product.close")}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink-950/50 backdrop-blur-sm"
      />

      <div
        ref={dialogRef}
        tabIndex={-1}
        // w-full + max-w-* + mx-auto => responsive container
        // animate-pop + shadow-lift => polished entrance
        className={cn(
          "relative w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-lift",
          "focus:outline-none animate-pop"
        )}
      >
        {/* Close button floats in the top-end corner so it survives both LTR
            and RTL layouts without extra code. */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t("product.close")}
          className="absolute end-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink-700 shadow-soft backdrop-blur hover:bg-white"
        >
          <Icon name="X" size={18} />
        </button>

        <div className="grid md:grid-cols-2">
          {/* -------------------------------------------------------------
              Image gallery
             ------------------------------------------------------------- */}
          <div className="flex flex-col gap-3 bg-ink-50 p-3 sm:p-4">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-white">
              <GalleryImage
                key={images[activeIndex]}
                src={images[activeIndex]}
                alt={product.name[locale]}
              />

              {images.length > 1 && (
                <>
                  {/* Prev / Next. We use logical "start/end" positioning so
                      RTL locales (Arabic) automatically flip the controls,
                      but the underlying `prev1`/`next` functions still walk
                      the array in index order — which is what RTL users
                      naturally expect (visually "previous" = index - 1). */}
                  <NavButton
                    side="start"
                    label={t("product.previousImage")}
                    onClick={prev1}
                    iconName={dir === "rtl" ? "ChevronRight" : "ChevronLeft"}
                  />
                  <NavButton
                    side="end"
                    label={t("product.nextImage")}
                    onClick={next}
                    iconName={dir === "rtl" ? "ChevronLeft" : "ChevronRight"}
                  />
                  <div className="absolute bottom-2 start-1/2 -translate-x-1/2 rounded-full bg-ink-900/70 px-2 py-0.5 text-xs font-medium text-white">
                    {activeIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail selector — only shown when there's more than one
                image. Uses a horizontally scrollable row so galleries with
                many images stay usable on narrow screens. */}
            {images.length > 1 && (
              <ul
                className="flex gap-2 overflow-x-auto pb-1 no-scrollbar"
                aria-label="Product thumbnails"
              >
                {images.map((url, i) => (
                  <li key={`${url}-${i}`} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveIndex(i)}
                      aria-current={i === activeIndex ? "true" : undefined}
                      aria-label={`Show image ${i + 1}`}
                      className={cn(
                        "relative block h-16 w-16 overflow-hidden rounded-lg bg-white outline outline-2",
                        i === activeIndex
                          ? "outline-ink-900"
                          : "outline-transparent hover:outline-ink-300"
                      )}
                    >
                      <GalleryImage src={url} alt="" small />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* -------------------------------------------------------------
              Details panel
             ------------------------------------------------------------- */}
          <div className="flex flex-col gap-4 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id="quickview-title"
                  className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl"
                >
                  {product.name[locale]}
                </h2>
                <p className="mt-1 text-xs text-ink-500">{product.sku}</p>
              </div>
              <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                <Icon name="Star" size={12} />
                {product.rating.toFixed(1)}
              </div>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-semibold tracking-tight text-ink-900">
                {formatCurrency(product.price, locale, currency)}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  outOfStock ? "text-red-600" : "text-emerald-600"
                )}
              >
                {outOfStock ? t("product.outOfStock") : t("product.inStock")}
                {!outOfStock && product.stock <= 10 && ` · ${product.stock}`}
              </span>
            </div>

            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">
              {product.description[locale]}
            </p>

            {/* Quantity stepper */}
            <div className="mt-auto space-y-3">
              <div className="flex items-center gap-3">
                <label
                  htmlFor="quickview-qty"
                  className="text-xs font-medium uppercase tracking-wide text-ink-500"
                >
                  {t("product.quantity")}
                </label>
                <div className="inline-flex items-center rounded-xl border border-ink-200 bg-white">
                  <button
                    type="button"
                    onClick={dec}
                    disabled={quantity <= 1 || outOfStock}
                    aria-label="Decrease quantity"
                    className="grid h-10 w-10 place-items-center text-ink-700 hover:bg-ink-50 disabled:opacity-40"
                  >
                    <Icon name="Minus" size={16} />
                  </button>
                  <input
                    id="quickview-qty"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={Math.max(product.stock, 1)}
                    value={quantity}
                    onChange={onQuantityInput}
                    disabled={outOfStock}
                    // Hide native spinner so our +/- buttons are the only
                    // way to increment. Keeps the UI visually consistent.
                    className={cn(
                      "h-10 w-14 border-x border-ink-200 bg-transparent text-center text-sm font-medium",
                      "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                      "focus:outline-none",
                      "disabled:opacity-60"
                    )}
                  />
                  <button
                    type="button"
                    onClick={inc}
                    disabled={quantity >= product.stock || outOfStock}
                    aria-label="Increase quantity"
                    className="grid h-10 w-10 place-items-center text-ink-700 hover:bg-ink-50 disabled:opacity-40"
                  >
                    <Icon name="Plus" size={16} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={onAddToCart}
                disabled={outOfStock}
                className={cn(
                  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium transition",
                  "bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-950 shadow-soft",
                  "disabled:cursor-not-allowed disabled:bg-ink-300 disabled:shadow-none"
                )}
              >
                <Icon name="ShoppingBag" size={16} />
                {t("product.add")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Thin wrapper around next/image that falls back to the local placeholder if
 * the remote URL fails (e.g. Supabase host unknown to next.config.mjs). Same
 * defensive pattern used by ProductCard so broken images never cascade.
 */
function GalleryImage({
  src,
  alt,
  small,
}: {
  src: string;
  alt: string;
  small?: boolean;
}) {
  const [current, setCurrent] = useState(src || FALLBACK_IMAGE);
  const [failed, setFailed] = useState(false);
  return (
    <Image
      src={current}
      alt={alt}
      fill
      sizes={small ? "64px" : "(max-width: 768px) 100vw, 50vw"}
      unoptimized={failed}
      onError={() => {
        if (failed) return;
        setCurrent(FALLBACK_IMAGE);
        setFailed(true);
      }}
      className="object-cover"
    />
  );
}

function NavButton({
  side,
  label,
  onClick,
  iconName,
}: {
  side: "start" | "end";
  label: string;
  onClick: () => void;
  iconName: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink-800 shadow-soft backdrop-blur",
        "hover:bg-white",
        side === "start" ? "start-2" : "end-2"
      )}
    >
      <Icon name={iconName} size={18} />
    </button>
  );
}
