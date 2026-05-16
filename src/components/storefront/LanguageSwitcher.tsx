"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/types";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 hover:border-ink-300"
        aria-label="Change language"
        aria-expanded={open}
      >
        <Icon name="Globe" size={16} />
        <span className="hidden sm:inline">{LOCALE_LABELS[locale]}</span>
        <span className="sm:hidden uppercase">{locale}</span>
      </button>
      {open && (
        <div className="absolute end-0 mt-2 w-44 animate-pop rounded-xl border border-ink-200 bg-white shadow-lift p-1 z-50">
          {LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLocale(l as Locale);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm",
                l === locale
                  ? "bg-ink-100 text-ink-900"
                  : "text-ink-700 hover:bg-ink-50"
              )}
            >
              <span>{LOCALE_LABELS[l]}</span>
              <span className="text-xs uppercase text-ink-400">{l}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
