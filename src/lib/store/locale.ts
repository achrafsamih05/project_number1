"use client";

// Locale store. Keeping it separate from the cart makes it easy to sync
// the <html> dir/lang attributes from a single place.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "../types";

interface LocaleState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useLocale = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "en",
      setLocale: (l) => set({ locale: l }),
    }),
    { name: "nova-locale" }
  )
);
