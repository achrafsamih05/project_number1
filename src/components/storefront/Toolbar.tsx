"use client";

import Link from "next/link";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { CartButton } from "./CartButton";
import { UserMenu } from "./UserMenu";
import { useSettings } from "@/lib/client/hooks";

export function Toolbar() {
  const settings = useSettings();
  const storeName = settings?.storeName ?? "Nova";

  return (
    <header className="glass sticky top-0 z-30">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-900 text-white font-bold">
            {storeName.trim().charAt(0).toUpperCase() || "N"}
          </span>
          <span className="text-lg font-semibold tracking-tight">
            {storeName}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <CartButton />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
