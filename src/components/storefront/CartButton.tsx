"use client";

import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { useCart } from "@/lib/store/cart";

export function CartButton({ floating = false }: { floating?: boolean }) {
  const open = useCart((s) => s.open);
  const [count, setCount] = useState(0);

  // Avoid hydration mismatch: read cart count after mount.
  useEffect(() => {
    const unsub = useCart.subscribe((s) =>
      setCount(s.items.reduce((n, i) => n + i.quantity, 0))
    );
    setCount(
      useCart.getState().items.reduce((n, i) => n + i.quantity, 0)
    );
    return () => unsub();
  }, []);

  if (floating) {
    // Hidden on mobile (md:grid): the BottomNav already exposes a Cart tab
    // in the correct tab-bar slot, so on phones the floating FAB was
    // redundant and caused the visual overlap people reported. On tablets
    // and up there is no bottom nav, so the FAB earns its keep.
    return (
      <button
        onClick={open}
        aria-label="Open cart"
        className="fixed end-4 bottom-6 z-40 hidden h-14 w-14 place-items-center rounded-full bg-ink-900 text-white shadow-lift transition hover:bg-ink-800 md:grid"
      >
        <Icon name="ShoppingBag" size={22} />
        {count > 0 && (
          <span className="absolute -top-1 -end-1 grid h-6 min-w-6 place-items-center rounded-full bg-brand-500 px-1 text-xs font-semibold text-white animate-pop">
            {count}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={open}
      aria-label="Open cart"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 hover:border-ink-300"
    >
      <Icon name="ShoppingBag" size={18} />
      {count > 0 && (
        <span className="absolute -top-1 -end-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      )}
    </button>
  );
}
