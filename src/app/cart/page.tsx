"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { StoreShell } from "@/components/storefront/StoreShell";
import { useCart } from "@/lib/store/cart";

/**
 * The cart is presented as a non-blocking side drawer, so this route simply
 * opens the drawer and sends the user back home. Keeping the URL accessible
 * means we can deep-link to "view cart" without disrupting the product grid.
 */
export default function CartPage() {
  const router = useRouter();
  const open = useCart((s) => s.open);
  useEffect(() => {
    open();
    router.replace("/");
  }, [open, router]);
  return <StoreShell>{null}</StoreShell>;
}
