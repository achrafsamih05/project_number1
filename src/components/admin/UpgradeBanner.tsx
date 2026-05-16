"use client";

import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/useI18n";
import type { Feature, SubscriptionPlan } from "@/lib/plan-limits";
import { isFeatureEnabled, getMinPlanForFeature } from "@/lib/plan-limits";

// ---------------------------------------------------------------------------
// UpgradeBanner — shown when a feature is locked behind a higher plan.
// Used in the AI generator, predictive inventory, and custom domain sections.
// ---------------------------------------------------------------------------

interface UpgradeBannerProps {
  feature: Feature;
  currentPlan: SubscriptionPlan;
  /** If true, renders as a compact inline badge instead of a full banner */
  compact?: boolean;
}

export function UpgradeBanner({ feature, currentPlan, compact }: UpgradeBannerProps) {
  const { t } = useI18n();

  if (isFeatureEnabled(currentPlan, feature)) return null;

  const requiredPlan = getMinPlanForFeature(feature);
  const planLabel = t(`plan.${requiredPlan}`);

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <Icon name="Lock" size={12} />
        {planLabel}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-amber-100 text-amber-600">
        <Icon name="Lock" size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-900">
          {t("plan.featureLocked").replace("{plan}", planLabel)}
        </p>
        <p className="mt-0.5 text-xs text-ink-500">
          {t("plan.upgradeRequired").replace("{plan}", planLabel)}
        </p>
      </div>
      <button
        type="button"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-medium text-white hover:bg-amber-700 transition"
      >
        <Icon name="Zap" size={14} />
        {t("plan.upgrade")}
      </button>
    </div>
  );
}

/**
 * Wrapper that conditionally renders children or the upgrade banner.
 * Use this to gate entire sections of the admin UI.
 */
export function FeatureGate({
  feature,
  currentPlan,
  children,
  fallback,
}: {
  feature: Feature;
  currentPlan: SubscriptionPlan;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  if (isFeatureEnabled(currentPlan, feature)) {
    return <>{children}</>;
  }
  return (
    <>
      {fallback ?? <UpgradeBanner feature={feature} currentPlan={currentPlan} />}
    </>
  );
}
