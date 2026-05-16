"use client";

import { useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon, ICONS } from "@/components/ui/Icon";
import { apiSend } from "@/lib/client/api";
import { useCategories, useProducts } from "@/lib/client/hooks";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";

// Curated subset of icons that make sense for categories. We keep the list
// short on purpose so the admin picks from known-good options — any string
// is still accepted by the API, but the dropdown nudges toward consistency.
const CATEGORY_ICON_OPTIONS: Array<keyof typeof ICONS> = [
  "LayoutGrid",
  "Cpu",
  "Smartphone",
  "Wrench",
  "Sofa",
  "Shirt",
  "Dumbbell",
  "ShoppingBag",
  "Package",
  "Boxes",
  "Star",
];

interface Draft {
  nameEn: string;
  nameAr: string;
  nameFr: string;
  slug: string;
  icon: string;
}

const EMPTY_DRAFT: Draft = {
  nameEn: "",
  nameAr: "",
  nameFr: "",
  slug: "",
  icon: "LayoutGrid",
};

// Mirror of api/categories POST logic so we can show live slug hints in the
// form while still letting the server be the source of truth.
function slugify(v: string): string {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CategoriesAdminPage() {
  const { t, locale } = useI18n();
  const categories = useCategories();
  const { data: products } = useProducts();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // How many products sit in each category — surfaced in the list and also
  // used to warn before deletion.
  const productCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + 1);
    }
    return map;
  }, [products]);

  const slugPreview = draft.slug || slugify(draft.nameEn);

  async function submit() {
    setError(null);
    if (!draft.nameEn.trim()) {
      setError("English name is required.");
      return;
    }
    const slug = slugify(draft.slug || draft.nameEn);
    if (!slug) {
      setError("Could not derive a slug from this name.");
      return;
    }
    setSaving(true);
    try {
      await apiSend("/api/categories", "POST", {
        slug,
        name: {
          en: draft.nameEn.trim(),
          ar: draft.nameAr.trim() || draft.nameEn.trim(),
          fr: draft.nameFr.trim() || draft.nameEn.trim(),
        },
        icon: draft.icon || "LayoutGrid",
      });
      setDraft(EMPTY_DRAFT);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create category.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const count = productCountByCategory.get(id) ?? 0;
    const extra =
      count > 0
        ? `\n\n${count} product${count === 1 ? "" : "s"} currently use this category.`
        : "";
    if (!confirm(`Delete this category?${extra}`)) return;
    try {
      await apiSend(`/api/categories/${id}`, "DELETE");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("admin.categories")}
          </h1>
          <p className="text-sm text-ink-500">
            Curate the taxonomy that powers the storefront navigation.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* --- List --------------------------------------------------- */}
          <section className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-ink-50 text-ink-600">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium">Name</th>
                    <th className="hidden px-4 py-3 text-start font-medium md:table-cell">
                      Slug
                    </th>
                    <th className="px-4 py-3 text-end font-medium">Products</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {categories.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-ink-400"
                      >
                        No categories yet. Create your first one on the right.
                      </td>
                    </tr>
                  )}
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-ink-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-50 text-ink-700">
                            <Icon name={c.icon} size={18} />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {c.name[locale]}
                            </div>
                            <div className="text-xs text-ink-500 md:hidden">
                              /{c.slug}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-ink-600 md:table-cell">
                        <code className="rounded bg-ink-50 px-1.5 py-0.5 text-xs">
                          {c.slug}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-end text-ink-600">
                        {productCountByCategory.get(c.id) ?? 0}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <button
                          onClick={() => remove(c.id)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-ink-600 hover:bg-red-50 hover:text-red-600"
                          aria-label="Delete"
                        >
                          <Icon name="Trash2" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* --- Create form ------------------------------------------- */}
          <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
            <h2 className="mb-1 text-base font-semibold">New category</h2>
            <p className="mb-4 text-xs text-ink-500">
              Name is multilingual. Slug defaults to the English name; you can
              override it.
            </p>
            <div className="space-y-3">
              <Field label="Name (EN)">
                <input
                  value={draft.nameEn}
                  onChange={(e) =>
                    setDraft({ ...draft, nameEn: e.target.value })
                  }
                  placeholder="Electronics"
                  className={inputCls}
                />
              </Field>
              <Field label="Name (AR)">
                <input
                  value={draft.nameAr}
                  onChange={(e) =>
                    setDraft({ ...draft, nameAr: e.target.value })
                  }
                  placeholder="إلكترونيات"
                  dir="rtl"
                  className={inputCls}
                />
              </Field>
              <Field label="Name (FR)">
                <input
                  value={draft.nameFr}
                  onChange={(e) =>
                    setDraft({ ...draft, nameFr: e.target.value })
                  }
                  placeholder="Électronique"
                  className={inputCls}
                />
              </Field>
              <Field
                label="Slug"
                hint={
                  slugPreview
                    ? `URL: /categories?c=${slugPreview}`
                    : undefined
                }
              >
                <input
                  value={draft.slug}
                  onChange={(e) =>
                    setDraft({ ...draft, slug: slugify(e.target.value) })
                  }
                  placeholder="electronics"
                  className={inputCls}
                />
              </Field>
              <Field label="Icon">
                <div className="flex items-center gap-2">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-200 bg-white text-ink-700">
                    <Icon name={draft.icon} size={18} />
                  </span>
                  <select
                    value={draft.icon}
                    onChange={(e) =>
                      setDraft({ ...draft, icon: e.target.value })
                    }
                    className={inputCls}
                  >
                    {CATEGORY_ICON_OPTIONS.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              )}

              <button
                onClick={submit}
                disabled={saving}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-60"
              >
                <Icon name="Plus" size={16} />
                {saving ? "Creating…" : "Create category"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm focus:border-ink-900 focus:outline-none";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block")}>
      <span className="mb-1 block text-xs font-medium text-ink-600">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-500">{hint}</span>}
    </label>
  );
}
