"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../ui/Icon";
import { useMe } from "@/lib/client/hooks";
import { apiSend } from "@/lib/client/api";
import { useI18n } from "@/lib/useI18n";

export function UserMenu() {
  const { t } = useI18n();
  const router = useRouter();
  const { data: me, setData } = useMe();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!me) {
    return (
      <Link
        href="/login"
        className="inline-flex h-10 items-center rounded-xl border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 hover:border-ink-300"
      >
        <Icon name="User" size={16} className="me-1.5" />
        {t("auth.signIn")}
      </Link>
    );
  }

  async function logout() {
    await apiSend("/api/auth/logout", "POST");
    setData(null);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink-200 bg-white px-2.5 text-sm font-medium text-ink-700 hover:border-ink-300"
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink-900 text-xs font-semibold text-white">
          {me.name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-[10ch] truncate sm:inline">
          {me.name.split(" ")[0]}
        </span>
      </button>
      {open && (
        <div className="absolute end-0 mt-2 w-60 animate-pop rounded-xl border border-ink-200 bg-white p-1 shadow-lift z-50">
          <div className="px-3 py-2 text-xs text-ink-500">
            {t("account.signedInAs")}
            <div className="truncate font-medium text-ink-900">{me.email}</div>
          </div>
          <MenuLink href="/account" icon="User">{t("nav.account")}</MenuLink>
          {me.role === "admin" && (
            <MenuLink href="/admin" icon="LayoutDashboard">
              {t("nav.admin")}
            </MenuLink>
          )}
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
          >
            <Icon name="LogOut" size={16} />
            {t("auth.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: "User" | "LayoutDashboard";
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
    >
      <Icon name={icon} size={16} />
      {children}
    </Link>
  );
}
