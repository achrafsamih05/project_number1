"use client";

// Convenience hook: returns the active locale, direction, and a translator.

import { useEffect } from "react";
import { dir, t as translate } from "./i18n";
import { useLocale } from "./store/locale";

export function useI18n() {
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);

  useEffect(() => {
    // Keep <html> in sync with the active locale for correct CSS inheritance.
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = dir(locale);
    }
  }, [locale]);

  const t = (key: string) => translate(key, locale);

  return { locale, setLocale, dir: dir(locale), t };
}
