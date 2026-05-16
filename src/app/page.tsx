import { Suspense } from "react";
import { headers } from "next/headers";
import { StoreShell } from "@/components/storefront/StoreShell";
import { SearchBar } from "@/components/storefront/SearchBar";
import { CategoryChips } from "@/components/storefront/CategoryChips";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { Hero } from "@/components/storefront/Hero";
import { CartButton } from "@/components/storefront/CartButton";
import { LandingPage } from "@/components/marketing/LandingPage";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const h = headers();
  const isPlatformRoot = h.get("x-is-platform-root") === "true";

  // If we're on the platform root domain (no tenant detected), show the
  // marketing landing page instead of the storefront.
  if (isPlatformRoot) {
    return <LandingPage />;
  }

  return (
    <StoreShell>
      <div className="flex flex-col gap-8">
        <Hero />
        <Suspense fallback={null}>
          <SearchBar />
        </Suspense>
        <Suspense fallback={null}>
          <CategoryChips />
        </Suspense>
        <Suspense fallback={null}>
          <ProductGrid />
        </Suspense>
      </div>
      {/* Floating cart icon — always accessible, no reloads */}
      <CartButton floating />
    </StoreShell>
  );
}
