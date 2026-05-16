"use client";

import { ReactNode } from "react";
import { Toolbar } from "./Toolbar";
import { BottomNav } from "./BottomNav";
import { CartDrawer } from "./CartDrawer";
import { Footer } from "./Footer";
import { BanGuard } from "./BanGuard";
import { Toaster } from "../ui/Toaster";
import { useI18n } from "@/lib/useI18n";

/**
 * StoreShell wraps every storefront page. It ensures:
 *   - the toolbar/bottom nav are always present
 *   - the cart drawer is mounted at the top of the tree (no reloads)
 *   - the <html> lang/dir attributes follow the active locale
 *   - the Footer is rendered once below the page content. The Footer reads
 *     its data from `useSettings()` and auto-updates via the settings SSE
 *     channel, so every page picks up admin edits instantly.
 *   - <BanGuard /> watches /api/auth/me's `banned` sentinel and bounces
 *     compromised sessions to /restricted. Renders no UI on its own.
 *   - <Toaster /> renders the global toast queue. Mounted here (rather than
 *     in the root layout) because the root layout is a Server Component and
 *     the toast store is client-only.
 *
 * Layout:
 *   flex column → main content grows, footer sits at the bottom even on
 *   short pages; mobile keeps its `pb-24` so BottomNav doesn't overlap.
 */
export function StoreShell({ children }: { children: ReactNode }) {
  // Calling useI18n triggers the effect that syncs <html dir/lang>.
  useI18n();
  return (
    <div className="flex min-h-dvh flex-col pb-24 md:pb-0">
      <Toolbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
      <Footer />
      <BottomNav />
      <CartDrawer />
      <BanGuard />
      <Toaster />
    </div>
  );
}
