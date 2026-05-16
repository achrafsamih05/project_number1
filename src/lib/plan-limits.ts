// ---------------------------------------------------------------------------
// Client-side plan limits utility — mirrors server/plan-limits.ts logic
// for UI display (upgrade banners, lock icons). No server-only import.
// ---------------------------------------------------------------------------

export type SubscriptionPlan = "free" | "starter" | "pro" | "enterprise";

export type Feature =
  | "products"
  | "ai_descriptions"
  | "predictive_inventory"
  | "whatsapp_integration"
  | "custom_domain"
  | "analytics_advanced";

const PLAN_FEATURES: Record<SubscriptionPlan, Set<Feature>> = {
  free: new Set(["products", "whatsapp_integration"]),
  starter: new Set(["products", "whatsapp_integration", "analytics_advanced"]),
  pro: new Set([
    "products",
    "ai_descriptions",
    "predictive_inventory",
    "whatsapp_integration",
    "analytics_advanced",
  ]),
  enterprise: new Set([
    "products",
    "ai_descriptions",
    "predictive_inventory",
    "whatsapp_integration",
    "analytics_advanced",
    "custom_domain",
  ]),
};

const PLAN_MAX_PRODUCTS: Record<SubscriptionPlan, number> = {
  free: 10,
  starter: 50,
  pro: -1,
  enterprise: -1,
};

export function isFeatureEnabled(plan: SubscriptionPlan, feature: Feature): boolean {
  return PLAN_FEATURES[plan]?.has(feature) ?? false;
}

export function getMaxProducts(plan: SubscriptionPlan): number {
  return PLAN_MAX_PRODUCTS[plan] ?? 10;
}

export function getMinPlanForFeature(feature: Feature): SubscriptionPlan {
  const plans: SubscriptionPlan[] = ["free", "starter", "pro", "enterprise"];
  for (const p of plans) {
    if (PLAN_FEATURES[p].has(feature)) return p;
  }
  return "enterprise";
}
