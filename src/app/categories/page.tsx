"use client";

import Link from "next/link";
import { StoreShell } from "@/components/storefront/StoreShell";
import { Icon } from "@/components/ui/Icon";
import { useCategories, useProducts } from "@/lib/client/hooks";
import { useI18n } from "@/lib/useI18n";

export default function CategoriesPage() {
  const { t, locale } = useI18n();
  const categories = useCategories();
  const { data: products } = useProducts();

  return (
    <StoreShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("categories.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-500">{t("hero.subtitle")}</p>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((c) => {
            const count = products.filter((p) => p.categoryId === c.id).length;
            return (
              <Link
                key={c.id}
                href={`/?category=${c.slug}`}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft transition hover:shadow-lift"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-100 text-ink-700 transition group-hover:bg-ink-900 group-hover:text-white">
                    <Icon name={c.icon} size={18} />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-ink-900">
                      {c.name[locale]}
                    </div>
                    <div className="text-xs text-ink-500">
                      {count} {count === 1 ? "item" : "items"}
                    </div>
                  </div>
                </div>
                <Icon name="ChevronRight" size={16} className="text-ink-400" />
              </Link>
            );
          })}
        </div>
      </div>
    </StoreShell>
  );
}
