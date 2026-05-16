import { Suspense } from "react";
import { StoreShell } from "@/components/storefront/StoreShell";
import { SearchBar } from "@/components/storefront/SearchBar";
import { CategoryChips } from "@/components/storefront/CategoryChips";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { Hero } from "@/components/storefront/Hero";
import { CartButton } from "@/components/storefront/CartButton";

export default function HomePage() {
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
