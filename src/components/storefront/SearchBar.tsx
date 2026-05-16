"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { useI18n } from "@/lib/useI18n";

export function SearchBar() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  // Keep input in sync if URL changes (e.g., back/forward nav).
  useEffect(() => {
    setValue(params.get("q") ?? "");
  }, [params]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set("q", value);
    else sp.delete("q");
    router.push(`/?${sp.toString()}`);
  }

  return (
    <form onSubmit={submit} className="relative">
      <span className="pointer-events-none absolute inset-y-0 start-4 grid place-items-center text-ink-400">
        <Icon name="Search" size={18} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("search.placeholder")}
        className="h-14 w-full rounded-2xl border border-ink-200 bg-white ps-12 pe-32 text-sm shadow-soft transition focus:border-ink-300 focus:shadow-lift focus:outline-none"
      />
      <button
        type="submit"
        className="absolute end-2 top-2 h-10 rounded-xl bg-ink-900 px-4 text-sm font-medium text-white hover:bg-ink-800"
      >
        {t("search.submit")}
      </button>
    </form>
  );
}
