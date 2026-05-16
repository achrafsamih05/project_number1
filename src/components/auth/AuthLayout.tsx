"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { useI18n } from "@/lib/useI18n";
import { useSettings } from "@/lib/client/hooks";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  accent = "brand",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  accent?: "brand" | "dark";
}) {
  useI18n(); // sync html dir/lang
  const settings = useSettings();
  const storeName = settings?.storeName ?? "Nova";

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside
        className={
          accent === "dark"
            ? "relative hidden overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-ink-950 p-10 text-white lg:flex lg:flex-col lg:justify-between"
            : "relative hidden overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 p-10 text-white lg:flex lg:flex-col lg:justify-between"
        }
      >
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-lg font-bold">
            {storeName.charAt(0).toUpperCase()}
          </span>
          <span className="text-lg font-semibold tracking-tight">{storeName}</span>
        </Link>
        <div className="relative space-y-3">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            {accent === "dark" ? "Run your store with confidence." : "Shop faster. Live better."}
          </h2>
          <p className="text-white/70">
            {accent === "dark"
              ? "Manage inventory, orders, invoices and customers in one modern dashboard."
              : "Save your address once and check out in a single click — anywhere, in any language."}
          </p>
        </div>
        <p className="relative text-xs text-white/60">
          {new Date().getFullYear()} {storeName}
        </p>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-6">
          <header className="space-y-1 text-center lg:text-start">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-ink-500">{subtitle}</p>}
          </header>
          {children}
          {footer && <div className="pt-2 text-center text-sm text-ink-600">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
