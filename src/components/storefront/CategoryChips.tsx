"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCategories } from "@/lib/client/hooks";
import { Icon } from "../ui/Icon";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";

export function CategoryChips() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get("category") ?? "all";
  const categories = useCategories();

  function select(slug: string) {
    const sp = new URLSearchParams(params.toString());
    if (slug === "all") sp.delete("category");
    else sp.set("category", slug);
    router.push(`/?${sp.toString()}`);
  }

  const items = [
    { slug: "all", name: t("categories.all"), icon: "LayoutGrid" as const },
    ...categories.map((c) => ({
      slug: c.slug,
      name: c.name[locale],
      icon: c.icon,
    })),
  ];

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          {t("categories.title")}
        </h2>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {items.map((c) => {
          const isActive = active === c.slug;
          return (
            <button
              key={c.slug}
              onClick={() => select(c.slug)}
              className={cn(
                "group flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                isActive
                  ? "border-ink-900 bg-ink-900 text-white shadow-soft"
                  : "border-ink-200 bg-white text-ink-700 hover:border-ink-300"
              )}
            >
              <Icon name={c.icon} size={16} />
              {c.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}
