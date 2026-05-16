import type { Locale } from "./types";

const LOCALE_TAG: Record<Locale, string> = {
  en: "en-US",
  ar: "ar",
  fr: "fr-FR",
};

export function formatCurrency(amount: number, locale: Locale, currency = "USD") {
  try {
    return new Intl.NumberFormat(LOCALE_TAG[locale], {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function formatDate(iso: string, locale: Locale) {
  try {
    return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}
