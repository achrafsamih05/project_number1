"use client";

import { useMemo, useRef, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/ui/Icon";
import { useCategories, useProducts, useSettings } from "@/lib/client/hooks";
import { apiSend } from "@/lib/client/api";
import { formatCurrency } from "@/lib/format";
import { useI18n } from "@/lib/useI18n";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Admin inventory
//
// Now manages a full product image GALLERY (text[] column `images`) instead
// of a single URL. The first entry is the cover; the storefront Quick View
// renders the rest as an image carousel.
//
// The editor supports:
//   - multi-file upload (calls /api/upload sequentially, one URL per file)
//   - drag-free reordering via explicit left/right arrow buttons (keeps the
//     implementation lightweight — no extra dependency for DnD)
//   - removing a single image
//   - "Make cover" action that moves any image to position 0
//
// On submit we send `images: string[]`. The API route + DB trigger keep the
// legacy `image` column in sync with `images[0]`.
// ---------------------------------------------------------------------------

interface DraftProduct {
  id?: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  nameFr: string;
  descEn: string;
  descAr: string;
  descFr: string;
  price: number;
  /**
   * Cost-of-goods price. Drives the admin Expenses & Profits margin
   * calculation. 0 is a valid "not priced yet" placeholder so the form
   * never blocks on it.
   */
  purchasePrice: number;
  categoryId: string;
  stock: number;
  images: string[];
}

export default function InventoryPage() {
  const { t, locale } = useI18n();
  const categories = useCategories();
  const { data: list, loading, reload } = useProducts();
  const settings = useSettings();
  const currency = settings?.currency ?? "USD";
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<DraftProduct | null>(null);

  const EMPTY_DRAFT: DraftProduct = {
    sku: "",
    nameEn: "",
    nameAr: "",
    nameFr: "",
    descEn: "",
    descAr: "",
    descFr: "",
    price: 0,
    purchasePrice: 0,
    categoryId: categories[0]?.id ?? "",
    stock: 0,
    images: [],
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      [p.sku, p.name.en, p.name.ar, p.name.fr].join(" ").toLowerCase().includes(q)
    );
  }, [list, query]);

  function toDraft(p: Product): DraftProduct {
    return {
      id: p.id,
      sku: p.sku,
      nameEn: p.name.en,
      nameAr: p.name.ar,
      nameFr: p.name.fr,
      descEn: p.description.en,
      descAr: p.description.ar,
      descFr: p.description.fr,
      price: p.price,
      purchasePrice: p.purchasePrice,
      categoryId: p.categoryId,
      stock: p.stock,
      // Product already normalises single-URL legacy rows into images[].
      images: [...p.images],
    };
  }

  async function save(d: DraftProduct) {
    const gallery = d.images.filter((u) => u && u.trim().length > 0);
    const payload = {
      sku: d.sku,
      name: { en: d.nameEn, ar: d.nameAr, fr: d.nameFr },
      description: { en: d.descEn, ar: d.descAr, fr: d.descFr },
      price: Number(d.price),
      // Send the cost-of-goods price under its canonical camelCase name.
      // The API route + mapper translate to the snake_case `purchase_price`
      // column. Coerced to a finite non-negative number on this side too so
      // the form can't accidentally PATCH NaN into the DB.
      purchasePrice: Math.max(0, Number(d.purchasePrice) || 0),
      categoryId: d.categoryId,
      stock: Number(d.stock),
      // Send the new canonical field. The API route also accepts legacy
      // `image`; we send both so a partially-migrated DB (images column
      // present but trigger not installed) stays consistent.
      images: gallery.length > 0
        ? gallery
        : ["https://picsum.photos/seed/nova/800/800"],
      image:
        gallery[0] ?? "https://picsum.photos/seed/nova/800/800",
    };
    if (d.id) {
      await apiSend(`/api/products/${d.id}`, "PATCH", payload);
    } else {
      await apiSend("/api/products", "POST", payload);
    }
    setEditing(null);
    await reload();
  }

  async function remove(id: string) {
    if (!confirm("Delete this product?")) return;
    await apiSend(`/api/products/${id}`, "DELETE");
    await reload();
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("admin.inventory")}
            </h1>
            <p className="text-sm text-ink-500">
              Manage your product catalog, stock and pricing. Changes propagate
              to the storefront in real time.
            </p>
          </div>
          <button
            onClick={() => setEditing({ ...EMPTY_DRAFT })}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink-900 px-4 text-sm font-medium text-white hover:bg-ink-800"
          >
            <Icon name="Plus" size={16} />
            New product
          </button>
        </header>

        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-ink-400">
            <Icon name="Search" size={16} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by SKU or name…"
            className="h-11 w-full rounded-xl border border-ink-200 bg-white ps-10 pe-4 text-sm focus:border-ink-900 focus:outline-none"
          />
        </div>

        {/*
         * Responsive table wrapper. See README for why we keep a minimum
         * width instead of collapsing to cards — admin workflows benefit
         * from the dense tabular view.
         */}
        <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-ink-50 text-ink-600">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">Product</th>
                  <th className="hidden px-4 py-3 text-start font-medium md:table-cell">
                    SKU
                  </th>
                  <th className="hidden px-4 py-3 text-start font-medium lg:table-cell">
                    Category
                  </th>
                  <th className="hidden px-4 py-3 text-end font-medium md:table-cell">
                    Price
                  </th>
                  <th className="px-4 py-3 text-end font-medium">Stock</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-ink-400"
                    >
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-ink-400"
                    >
                      No products.
                    </td>
                  </tr>
                )}
                {filtered.map((p) => {
                  const cat = categories.find((c) => c.id === p.categoryId);
                  return (
                    <tr key={p.id} className="hover:bg-ink-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {/* Cover thumbnail + a small badge with the
                              gallery size, so the admin can tell at a
                              glance which products have multiple shots. */}
                          <div className="relative h-10 w-10 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.image}
                              alt=""
                              className="h-10 w-10 rounded-lg object-cover bg-ink-100"
                              onError={(e) => {
                                // eslint-disable-next-line no-console
                                console.error(
                                  `[InventoryTable] image failed for product ${p.id} (${p.sku}). URL: ${p.image}`
                                );
                                e.currentTarget.src = "/favicon.svg";
                              }}
                            />
                            {p.images.length > 1 && (
                              <span className="absolute -end-1 -bottom-1 grid h-4 min-w-4 place-items-center rounded-full bg-ink-900 px-1 text-[10px] font-semibold leading-none text-white">
                                {p.images.length}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {p.name[locale]}
                            </div>
                            <div className="mt-0.5 text-xs text-ink-500 md:hidden">
                              {p.sku} ·{" "}
                              {formatCurrency(p.price, locale, currency)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-ink-600 md:table-cell">
                        {p.sku}
                      </td>
                      <td className="hidden px-4 py-3 text-ink-600 lg:table-cell">
                        {cat?.name[locale] ?? "—"}
                      </td>
                      <td className="hidden px-4 py-3 text-end md:table-cell">
                        {formatCurrency(p.price, locale, currency)}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            p.stock <= 10
                              ? "bg-red-50 text-red-700"
                              : p.stock <= 25
                              ? "bg-amber-50 text-amber-700"
                              : "bg-emerald-50 text-emerald-700"
                          )}
                        >
                          {p.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => setEditing(toDraft(p))}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-600 hover:bg-ink-100"
                            aria-label="Edit"
                          >
                            <Icon name="Edit" size={16} />
                          </button>
                          <button
                            onClick={() => remove(p.id)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-ink-600 hover:bg-red-50 hover:text-red-600"
                            aria-label="Delete"
                          >
                            <Icon name="Trash2" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && (
        <ProductEditor
          draft={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </AdminShell>
  );
}

function ProductEditor({
  draft,
  categories,
  onClose,
  onSave,
}: {
  draft: DraftProduct;
  categories: ReturnType<typeof useCategories>;
  onClose: () => void;
  onSave: (d: DraftProduct) => Promise<void>;
}) {
  const [d, setD] = useState<DraftProduct>(draft);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await onSave(d);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-ink-950/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-lift">
        <header className="flex items-center justify-between border-b border-ink-100 p-4">
          <h3 className="text-base font-semibold">
            {d.id ? "Edit product" : "New product"}
          </h3>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-600 hover:bg-ink-100"
            aria-label="Close"
          >
            <Icon name="X" size={18} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <L label="SKU">
              <input
                value={d.sku}
                onChange={(e) => setD({ ...d, sku: e.target.value })}
                className={inputCls}
              />
            </L>
            <L label="Category">
              <select
                value={d.categoryId}
                onChange={(e) => setD({ ...d, categoryId: e.target.value })}
                className={inputCls}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name.en}
                  </option>
                ))}
              </select>
            </L>
            <L label="Price">
              <input
                type="number"
                step="0.01"
                value={d.price}
                onChange={(e) => setD({ ...d, price: Number(e.target.value) })}
                className={inputCls}
              />
            </L>
            <L label="Purchase price (cost)">
              {/*
               * Cost-of-goods (what we paid). Used by the Expenses & Profits
               * dashboard. We render the live margin under the input as a
               * tiny hint so the admin sees a sanity-check number while
               * typing — no extra deps, just a `<p>`.
               */}
              <input
                type="number"
                step="0.01"
                min={0}
                value={d.purchasePrice}
                onChange={(e) =>
                  setD({ ...d, purchasePrice: Number(e.target.value) })
                }
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-ink-500">
                Margin per unit:{" "}
                <span
                  className={cn(
                    "font-medium",
                    d.price - d.purchasePrice < 0
                      ? "text-red-600"
                      : "text-emerald-600"
                  )}
                >
                  {(d.price - d.purchasePrice).toFixed(2)}
                </span>
              </p>
            </L>
            <L label="Stock">
              <input
                type="number"
                value={d.stock}
                onChange={(e) => setD({ ...d, stock: Number(e.target.value) })}
                className={inputCls}
              />
            </L>

            {/*
             * Image gallery editor. Accepts multiple files at once, uploads
             * each sequentially, and appends the returned URLs to
             * `d.images`. The first entry is the cover; the other entries
             * show up in the Quick View carousel on the storefront.
             */}
            <L label="Product images" wide>
              <ImageGalleryEditor
                images={d.images}
                onChange={(next) => setD({ ...d, images: next })}
              />
            </L>

            <L label="Name (EN)">
              <input
                value={d.nameEn}
                onChange={(e) => setD({ ...d, nameEn: e.target.value })}
                className={inputCls}
              />
            </L>
            <L label="Name (AR)">
              <input
                value={d.nameAr}
                onChange={(e) => setD({ ...d, nameAr: e.target.value })}
                className={inputCls}
                dir="rtl"
              />
            </L>
            <L label="Name (FR)" wide>
              <input
                value={d.nameFr}
                onChange={(e) => setD({ ...d, nameFr: e.target.value })}
                className={inputCls}
              />
            </L>
            <L label="Description (EN)" wide>
              <textarea
                value={d.descEn}
                onChange={(e) => setD({ ...d, descEn: e.target.value })}
                rows={2}
                className={inputCls}
              />
            </L>
            <L label="Description (AR)" wide>
              <textarea
                value={d.descAr}
                onChange={(e) => setD({ ...d, descAr: e.target.value })}
                rows={2}
                className={inputCls}
                dir="rtl"
              />
            </L>
            <L label="Description (FR)" wide>
              <textarea
                value={d.descFr}
                onChange={(e) => setD({ ...d, descFr: e.target.value })}
                rows={2}
                className={inputCls}
              />
            </L>
          </div>
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
            {saving ? "Saving…" : "Save"}
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Gallery editor. Stateless from the outside — reads the current array and
 * calls `onChange` with the next one for every mutation (upload, reorder,
 * remove). This keeps the owning `DraftProduct` as the single source of
 * truth so "Cancel" and "Save" behave predictably.
 */
function ImageGalleryEditor({
  images,
  onChange,
}: {
  images: string[];
  onChange: (next: string[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function uploadOne(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    const json = await res.json().catch(() => ({ error: "Invalid JSON" }));
    if (!res.ok) throw new Error(json.error ?? `Upload failed (${res.status})`);
    return (json.data as { url: string }).url;
  }

  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    const added: string[] = [];
    try {
      // Sequential upload keeps the backend simple (one request at a time
      // per admin) and gives us a predictable order: files land in the
      // gallery in the same order the user picked them.
      for (const file of files) {
        added.push(await uploadOne(file));
      }
      onChange([...images, ...added]);
    } catch (err) {
      // Partial success is still committed so the admin doesn't lose work.
      if (added.length > 0) onChange([...images, ...added]);
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function moveTo(from: number, to: number) {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function makeCover(index: number) {
    if (index === 0) return;
    moveTo(index, 0);
  }

  return (
    <div className="space-y-3">
      {/* Gallery grid — small thumbnails with per-item controls. */}
      {images.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((url, i) => (
            <li
              key={`${url}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-xl border border-ink-200 bg-ink-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Product image ${i + 1}`}
                className="h-full w-full object-cover"
                onError={(e) => {
                  // eslint-disable-next-line no-console
                  console.error(
                    `[ImageGalleryEditor] preview failed. URL: ${url}`
                  );
                  e.currentTarget.src = "/favicon.svg";
                }}
              />
              {i === 0 && (
                <span className="absolute start-1 top-1 rounded-md bg-ink-900/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Cover
                </span>
              )}
              {/* Hover/focus overlay with actions. On touch devices the
                  overlay stays visible (no hover), so admins can still
                  reorder/remove on mobile. */}
              <div className="absolute inset-0 flex flex-col justify-between bg-ink-950/0 p-1 transition group-hover:bg-ink-950/40 group-focus-within:bg-ink-950/40">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="grid h-6 w-6 place-items-center rounded-full bg-white/90 text-ink-700 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 hover:text-red-600"
                    aria-label="Remove image"
                  >
                    <Icon name="X" size={12} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => moveTo(i, i - 1)}
                    disabled={i === 0}
                    className="grid h-6 w-6 place-items-center rounded-full bg-white/90 text-ink-700 disabled:opacity-40"
                    aria-label="Move left"
                  >
                    <Icon name="ChevronLeft" size={12} />
                  </button>
                  {i !== 0 && (
                    <button
                      type="button"
                      onClick={() => makeCover(i)}
                      className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-ink-700 hover:text-ink-900"
                    >
                      Cover
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => moveTo(i, i + 1)}
                    disabled={i === images.length - 1}
                    className="grid h-6 w-6 place-items-center rounded-full bg-white/90 text-ink-700 disabled:opacity-40"
                    aria-label="Move right"
                  >
                    <Icon name="ChevronRight" size={12} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid h-28 place-items-center rounded-xl border border-dashed border-ink-200 bg-ink-50 text-xs text-ink-500">
          No images yet — upload one or more below.
        </div>
      )}

      <div className="space-y-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onFilesSelected}
          disabled={uploading}
          className={cn(
            "block w-full text-sm text-ink-700",
            "file:me-3 file:rounded-lg file:border-0 file:bg-ink-900 file:px-3 file:py-2",
            "file:text-sm file:font-medium file:text-white hover:file:bg-ink-800",
            "disabled:opacity-60"
          )}
        />
        {uploading && <p className="text-xs text-ink-500">Uploading…</p>}
        {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
        <p className="text-xs text-ink-500">
          First image becomes the cover. Drag-free reorder via the arrows on
          each thumbnail.
        </p>
      </div>
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm focus:border-ink-900 focus:outline-none";

function L({
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
      <span className="mb-1 block text-xs font-medium text-ink-600">{label}</span>
      {children}
    </label>
  );
}
