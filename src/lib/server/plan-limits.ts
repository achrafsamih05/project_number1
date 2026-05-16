import "server-only";
import type { SubscriptionPlan } from "./tenant";

// ---------------------------------------------------------------------------
// Plan Limits & Feature Gating for Multi-Tenant SaaS.
//
// Each subscription tier has defined resource limits and feature flags.
// API routes and UI components use these to enforce billing guardrails.
// ---------------------------------------------------------------------------

export type Feature =
  | "products"
  | "ai_descriptions"
  | "predictive_inventory"
  | "whatsapp_integration"
  | "custom_domain"
  | "analytics_advanced";

/** Resource limits per plan. -1 = unlimited. */
interface PlanLimits {
  maxProducts: number;
  features: Set<Feature>;
}

const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    maxProducts: 10,
    features: new Set(["products", "whatsapp_integration"]),
  },
  starter: {
    maxProducts: 50,
    features: new Set(["products", "whatsapp_integration", "analytics_advanced"]),
  },
  pro: {
    maxProducts: -1, // unlimited
    features: new Set([
      "products",
      "ai_descriptions",
      "predictive_inventory",
      "whatsapp_integration",
      "analytics_advanced",
    ]),
  },
  enterprise: {
    maxProducts: -1, // unlimited
    features: new Set([
      "products",
      "ai_descriptions",
      "predictive_inventory",
      "whatsapp_integration",
      "analytics_advanced",
      "custom_domain",
    ]),
  },
};

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: SubscriptionPlan;
}

/**
 * Check if a specific feature is available for the given plan.
 */
export function isFeatureEnabled(plan: SubscriptionPlan, feature: Feature): boolean {
  return PLAN_LIMITS[plan].features.has(feature);
}

/**
 * Get the maximum number of products allowed for a plan.
 * Returns -1 for unlimited.
 */
export function getMaxProducts(plan: SubscriptionPlan): number {
  return PLAN_LIMITS[plan].maxProducts;
}

/**
 * Check if a tenant can use a feature or resource.
 * Returns { allowed: true } or { allowed: false, reason, upgradeRequired }.
 */
export function checkTenantLimits(
  plan: SubscriptionPlan,
  feature: Feature,
  context?: { currentProductCount?: number }
): LimitCheckResult {
  const limits = PLAN_LIMITS[plan];

  // Feature gate check
  if (!limits.features.has(feature)) {
    const minPlan = getMinPlanForFeature(feature);
    return {
      allowed: false,
      reason: `This feature requires the ${minPlan} plan or higher.`,
      upgradeRequired: minPlan,
    };
  }

  // Resource limit checks
  if (feature === "products" && context?.currentProductCount !== undefined) {
    if (limits.maxProducts !== -1 && context.currentProductCount >= limits.maxProducts) {
      return {
        allowed: false,
        reason: `You have reached the maximum of ${limits.maxProducts} products on the ${plan} plan.`,
        upgradeRequired: plan === "free" ? "starter" : "pro",
      };
    }
  }

  return { allowed: true };
}

/**
 * Get the minimum plan required for a feature.
 */
export function getMinPlanForFeature(feature: Feature): SubscriptionPlan {
  const plans: SubscriptionPlan[] = ["free", "starter", "pro", "enterprise"];
  for (const plan of plans) {
    if (PLAN_LIMITS[plan].features.has(feature)) return plan;
  }
  return "enterprise";
}

/**
 * Get all plan details for display in pricing UI.
 */
export function getPlanDetails(): Array<{
  plan: SubscriptionPlan;
  maxProducts: number;
  features: Feature[];
}> {
  return (Object.entries(PLAN_LIMITS) as [SubscriptionPlan, PlanLimits][]).map(
    ([plan, limits]) => ({
      plan,
      maxProducts: limits.maxProducts,
      features: Array.from(limits.features),
    })
  );
}
