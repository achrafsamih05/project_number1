"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import { Icon, ICONS } from "../ui/Icon";
import { Toaster } from "../ui/Toaster";
import { apiSend } from "@/lib/client/api";
import { useMe } from "@/lib/client/hooks";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, setData } = useMe();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav: NavItem[] = [
    { href: "/admin", label: t("admin.dashboard"), icon: "LayoutDashboard" },
    { href: "/admin/inventory", label: t("admin.inventory"), icon: "Boxes" },
    { href: "/admin/categories", label: t("admin.categories"), icon: "LayoutGrid" },
    { href: "/admin/orders", label: t("admin.orders"), icon: "Package" },
    { href: "/admin/invoices", label: t("admin.invoices"), icon: "FileText" },
    { href: "/admin/expenses", label: t("admin.expenses"), icon: "TrendingUp" },
    { href: "/admin/users", label: t("admin.users"), icon: "Users" },
    { href: "/admin/settings", label: t("admin.settings"), icon: "Settings" },
  ];

  async function logout() {
    await apiSend("/api/auth/logout", "POST");
    setData(null);
    router.push("/login/admin");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-ink-50 md:grid md:grid-cols-[260px_1fr]">
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-40 flex w-64 transform flex-col border-e border-ink-100 bg-white transition md:sticky md:top-0 md:h-dvh md:translate-x-0",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full rtl:translate-x-full rtl:md:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-ink-100 px-4">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-900 text-white font-bold">
              N
            </span>
            <span className="text-base font-semibold">{t("admin.title")}</span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 md:hidden"
            aria-label="Close menu"
          >
            <Icon name="X" size={18} />
          </button>
        </div>
        <nav className="flex-1 p-3">
          {nav.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  isActive
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                )}
              >
                <Icon name={item.icon} size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-ink-100 p-3">
          {me && (
            <div className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-900 text-xs font-semibold text-white">
                {me.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 text-xs">
                <div className="truncate font-medium">{me.name}</div>
                <div className="truncate text-ink-500">{me.email}</div>
              </div>
            </div>
          )}
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-medium text-ink-700 hover:border-ink-300"
          >
            <Icon name="ArrowLeft" size={16} />
            Back to store
          </Link>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-100"
          >
            <Icon name="LogOut" size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink-950/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-ink-100 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-ink-200 bg-white text-ink-700 md:hidden"
            aria-label="Open menu"
          >
            <Icon name="LayoutGrid" size={18} />
          </button>
          <div className="hidden text-sm text-ink-500 md:block">
            {t("admin.title")}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 hover:border-ink-300"
            >
              <Icon name="ShoppingBag" size={16} />
              Store
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {/* Global toast rail — same component the storefront mounts. */}
      <Toaster />
    </div>
  );
}
