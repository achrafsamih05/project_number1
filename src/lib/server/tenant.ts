import "server-only";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "./supabase";

// ---------------------------------------------------------------------------
// Tenant resolution utilities for the multi-tenant Commerce OS platform.
//
// The middleware injects tenant context into request headers:
//   - x-tenant-slug:    subdomain-based slug (e.g., "nova-shop")
//   - x-tenant-domain:  custom domain (e.g., "myshop.com")
//   - x-is-platform-root: "true" if on the marketing homepage
//
// Server components and API routes call these helpers to determine which
// store they're operating on.
// ---------------------------------------------------------------------------

export type SubscriptionPlan = "free" | "starter" | "pro" | "enterprise";
export type PlanStatus = "active" | "past_due" | "canceled" | "trialing";

export interface Store {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  customDomain: string | null;
  logoUrl: string | null;
  status: "active" | "suspended" | "onboarding";
  plan: SubscriptionPlan;
  planStatus: PlanStatus;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoreRow {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  logo_url: string | null;
  status: string;
  plan: string;
  plan_status: string;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

const STORE_COLUMNS =
  "id, owner_id, name, slug, custom_domain, logo_url, status, plan, plan_status, trial_ends_at, created_at, updated_at";

function storeFromRow(row: StoreRow): Store {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    customDomain: row.custom_domain,
    logoUrl: row.logo_url,
    status: row.status as Store["status"],
    plan: row.plan as Store["plan"],
    planStatus: (row.plan_status ?? "active") as Store["planStatus"],
    trialEndsAt: row.trial_ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// In-memory cache for store lookups (per request lifetime in serverless,
// persists across hot reloads in dev). TTL = 60s to avoid stale data.
// ---------------------------------------------------------------------------

const storeCache = new Map<string, { store: Store; ts: number }>();
const CACHE_TTL_MS = 60_000;

function getCached(key: string): Store | null {
  const entry = storeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    storeCache.delete(key);
    return null;
  }
  return entry.store;
}

function setCache(key: string, store: Store): void {
  storeCache.set(key, { store, ts: Date.now() });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract tenant identification from the current request headers.
 * Returns the slug, custom domain, or null if on the platform root.
 */
export function getTenantFromHeaders(): {
  slug: string | null;
  customDomain: string | null;
  isPlatformRoot: boolean;
} {
  const h = headers();
  return {
    slug: h.get("x-tenant-slug") ?? null,
    customDomain: h.get("x-tenant-domain") ?? null,
    isPlatformRoot: h.get("x-is-platform-root") === "true",
  };
}

/**
 * Look up a store by its slug. Returns null if not found or inactive.
 */
export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const cacheKey = `slug:${slug}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await getSupabaseAdmin()
    .from("stores")
    .select(STORE_COLUMNS)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;
  const store = storeFromRow(data as unknown as StoreRow);
  setCache(cacheKey, store);
  return store;
}

/**
 * Look up a store by its custom domain. Returns null if not found or inactive.
 */
export async function getStoreByDomain(domain: string): Promise<Store | null> {
  const cacheKey = `domain:${domain}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await getSupabaseAdmin()
    .from("stores")
    .select(STORE_COLUMNS)
    .eq("custom_domain", domain)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;
  const store = storeFromRow(data as unknown as StoreRow);
  setCache(cacheKey, store);
  return store;
}

/**
 * Look up a store by its UUID.
 */
export async function getStoreById(id: string): Promise<Store | null> {
  const cacheKey = `id:${id}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { data, error } = await getSupabaseAdmin()
    .from("stores")
    .select(STORE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const store = storeFromRow(data as unknown as StoreRow);
  setCache(cacheKey, store);
  return store;
}

/**
 * Resolve the current tenant from request headers.
 *
 * This is the main entry point for API routes and server components.
 * It reads the headers injected by middleware and resolves to a Store object.
 *
 * Returns null if:
 *   - We're on the platform root (marketing site)
 *   - The slug/domain doesn't match any active store
 *
 * Throws if store resolution fails in a way that indicates a bug.
 */
export async function resolveCurrentTenant(): Promise<Store | null> {
  const { slug, customDomain, isPlatformRoot } = getTenantFromHeaders();

  // Platform root → no tenant context (marketing pages, onboarding)
  if (isPlatformRoot) return null;

  // Subdomain-based resolution
  if (slug) {
    return getStoreBySlug(slug);
  }

  // Custom domain resolution — requires enterprise plan
  if (customDomain) {
    const store = await getStoreByDomain(customDomain);
    // If the store exists but isn't on enterprise, custom domain won't resolve
    if (store && store.plan !== "enterprise" && store.plan !== "pro") {
      return null; // Falls back to "store not found" for non-enterprise stores
    }
    return store;
  }

  // No tenant identifiers present (shouldn't happen if middleware ran)
  return null;
}

/**
 * Resolve the current tenant, throwing 404 if not found.
 * Use this in API routes that REQUIRE a valid tenant context.
 */
export async function requireTenant(): Promise<Store> {
  const store = await resolveCurrentTenant();
  if (!store) {
    const err = new Error("Store not found") as Error & { status?: number };
    err.status = 404;
    throw err;
  }
  return store;
}

/**
 * Get the store_id for the current request. Convenience wrapper that
 * returns just the UUID string. Throws 404 if no tenant is resolved.
 */
export async function requireStoreId(): Promise<string> {
  const store = await requireTenant();
  return store.id;
}
