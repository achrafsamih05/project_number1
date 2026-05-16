"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentProps } from "react";
import { Icon, ICONS } from "../ui/Icon";
import { useCart } from "@/lib/store/cart";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";

/**
 * Mobile bottom navigation bar.
 *
 * Layout rules:
 *   - `fixed bottom-0 inset-x-0` so it stays docked regardless of scroll.
 *   - `grid grid-cols-4` gives the four tabs equal, non-collapsing width.
 *     Each tab's link fills its cell (`h-full w-full`) so the entire cell
 *     is tappable, matching iOS/Android tab-bar guidelines (44×44px min).
 *   - `pb-safe` (defined in globals.css) adds iOS home-indicator inset so
 *     the icons aren't crowded by the gesture bar on notched phones.
 *   - The cart-count badge is positioned against the ICON wrapper, not the
 *     whole link — that's what fixes the drift that made the badge appear
 *     to "overlap" the neighbouring tab.
 *   - Active color uses the brand primary (`text-brand-600`) with a
 *     subtle pill behind the icon for clearer affordance.
 */
type Tab = {
  key: string;
  label: string;
  icon: keyof typeof ICONS;
  href?: string;
  onClick?: () => void;
};

export function BottomNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const openCart = useCart((s) => s.open);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const read = () =>
      setCount(
        useCart.getState().items.reduce((n, i) => n + i.quantity, 0)
      );
    read();
    return useCart.subscribe(read);
  }, []);

  const tabs: Tab[] = [
    { key: "home", label: t("nav.home"), icon: "Home", href: "/" },
    {
      key: "categories",
      label: t("nav.categories"),
      icon: "LayoutGrid",
      href: "/categories",
    },
    { key: "cart", label: t("nav.cart"), icon: "ShoppingBag", onClick: openCart },
    { key: "account", label: t("nav.account"), icon: "User", href: "/account" },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white/90 pb-safe backdrop-blur md:hidden"
    >
      <ul className="grid w-full grid-cols-4">
        {tabs.map((tab) => {
          const isActive = Boolean(
            tab.href &&
              (tab.href === "/"
                ? pathname === "/"
                : pathname.startsWith(tab.href))
          );
          const showBadge = tab.key === "cart" && count > 0;

          // Shared visual: column of [icon-in-pill, label]. Using a fixed
          // height (h-16) + justify-center keeps icon + label centered as a
          // group no matter how long the translated label is.
          const inner = (
            <>
              <span
                className={cn(
                  "relative grid h-8 w-12 place-items-center rounded-full transition-colors",
                  isActive && "bg-brand-50"
                )}
              >
                <Icon name={tab.icon} size={22} strokeWidth={isActive ? 2.25 : 2} />
                {showBadge && (
                  <span
                    className="absolute -end-1 -top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold leading-none text-white"
                    aria-label={`${count} items in cart`}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              <span className="mt-0.5 text-[11px] font-medium leading-tight">
                {tab.label}
              </span>
            </>
          );

          const linkClass = cn(
            "flex h-16 w-full flex-col items-center justify-center text-center",
            "transition-colors",
            isActive
              ? "text-brand-600"
              : "text-ink-500 hover:text-ink-700 active:text-ink-900"
          );

          return (
            <li key={tab.key} className="flex">
              {tab.href ? (
                <Link
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={linkClass}
                  onClick={tab.onClick}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={tab.onClick}
                  className={linkClass}
                  aria-label={tab.label}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Prevents accidental prop drift if the component above is ever split.
// (No-op at runtime; kept for type discoverability.)
export type BottomNavProps = ComponentProps<typeof BottomNav>;
