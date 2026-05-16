import type {
  Category,
  Invoice,
  LocalizedString,
  Order,
  OrderStatus,
  Product,
  Settings,
  User,
} from "../types";

// ---------------------------------------------------------------------------
// Supabase ↔ domain-type mappers.
//
// Supabase tables use snake_case, and the localized strings are three
// separate columns (name_en / name_ar / name_fr) — this matches the schema
// the user pasted in the audit brief and supabase/schema.sql.
//
// These mappers convert between that shape and the camelCase,
// LocalizedString shape the rest of the app uses.
//
// KEY INVARIANT: a mapper must never crash on a row that came back from
// Supabase. Missing locales, null images, legacy numeric strings — every
// case falls back to a sane, renderable default. This is the final line
// of defense before data hits the UI.
// ---------------------------------------------------------------------------

// ============================================================================
// Column-list constants.
//
// db.ts imports these and passes them to .select(...) so every query
// enumerates its columns explicitly. Result:
//   - If a column is missing from the DB, PostgREST raises 42703 with the
//     column name. No more "data in DB, empty UI, no errors" silent drift.
//   - The multilingual columns (name_en, name_ar, name_fr) are always
//     requested by name, satisfying the audit requirement that every SELECT
//     use the real schema names.
// ============================================================================

export const PRODUCT_COLUMNS =
  "id, sku, name_en, name_ar, name_fr, description_en, description_ar, description_fr, " +
  "price, purchase_price, category_id, stock, image, images, rating, created_at";

export const CATEGORY_COLUMNS =
  "id, slug, name_en, name_ar, name_fr, icon";

export const USER_COLUMNS =
  "id, email, name, role, phone, address, city, postal_code, country, " +
  "banned, password_hash, created_at, last_seen_at";

export const ORDER_COLUMNS =
  "id, user_id, customer_name, customer_email, customer_phone, customer_address, " +
  "subtotal, tax, total, status, created_at";

export const ORDER_ITEM_COLUMNS =
  "id, order_id, product_id, name, quantity, price";

export const INVOICE_COLUMNS =
  "id, order_id, number, issued_at, due_at, status, amount";

export const SETTINGS_COLUMNS =
  "id, store_name, currency, tax_rate, low_stock_threshold, " +
  "contact_email, contact_phone, address, footer_tagline, " +
  "facebook_url, instagram_url, twitter_url, youtube_url, linkedin_url, tiktok_url";

// ============================================================================
// Small utilities
// ============================================================================

/**
 * Coerce whatever Supabase hands us (string / number / null) into a finite
 * number. Supabase returns numeric columns as either a JS number or a string
 * depending on size; we normalise so downstream `.toFixed()` etc. never
 * crashes on a string, and a null/NaN becomes the fallback.
 */
function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Return the first non-empty string from the candidates, or "". */
function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return "";
}

/**
 * Build a LocalizedString safely.
 *
 * Why fallbacks matter: if `name_ar` is NULL in the DB (or the seed script
 * forgot it), the Arabic storefront renders an empty product name — a
 * silent UX bug. Instead we cascade:
 *   ar → fr → en → "Untitled"  (for Arabic)
 *   fr → en → ar → "Untitled"  (for French)
 *   en → fr → ar → "Untitled"  (for English)
 *
 * The optional `fallback` is used only when every locale is empty; the
 * caller passes something like "Untitled product" for names and "" for
 * descriptions.
 */
function pickLocalized(
  en: string | null | undefined,
  ar: string | null | undefined,
  fr: string | null | undefined,
  fallback = ""
): LocalizedString {
  const anyValue = firstNonEmpty(en, fr, ar) || fallback;
  return {
    en: firstNonEmpty(en, fr, ar, fallback),
    ar: firstNonEmpty(ar, en, fr, fallback),
    fr: firstNonEmpty(fr, en, ar, fallback),
    // ensure no field is ever the empty string if we had any source value
  };
  // `anyValue` is retained above purely for readability — the firstNonEmpty
  // chain is what builds the actual return shape.
  void anyValue;
}

// Placeholder image used only when `products.image` is NULL. Keeps Next's
// <Image> from throwing on an empty src and leaves an obvious visual marker
// for the admin that this row needs attention.
const PLACEHOLDER_IMAGE =
  "https://picsum.photos/seed/nova-missing/800/800";

// ============================================================================
// Product
// ============================================================================

export interface ProductRow {
  id: string;
  sku: string;
  name_en: string | null;
  name_ar: string | null;
  name_fr: string | null;
  description_en: string | null;
  description_ar: string | null;
  description_fr: string | null;
  price: number | string;
  /**
   * Cost price (what the store paid). Optional in the row type because old
   * schemas may not have this column yet — productFromRow falls back to 0.
   */
  purchase_price?: number | string | null;
  category_id: string;
  stock: number | string;
  image: string | null;
  /**
   * text[] column on Postgres. Supabase returns it as a JS array of strings,
   * or null when the column is missing / NULL. Older rows seeded before the
   * multi-image migration may not have this — the mapper falls back to the
   * single `image` column so the storefront keeps rendering.
   */
  images: string[] | null;
  rating: number | string | null;
  created_at: string;
}

/**
 * Normalise whatever Supabase returns for `images` into a clean string[].
 *
 * - If `images` is a valid non-empty array → dedupe + trim + drop empties.
 * - Otherwise fall back to `image` (legacy single-URL rows seeded before
 *   the multi-image migration).
 * - Otherwise return [PLACEHOLDER_IMAGE] so the UI always has something
 *   to render.
 *
 * Downstream code can therefore rely on `product.images[0]` always being a
 * usable URL.
 */
function normaliseImages(
  images: string[] | null | undefined,
  legacy: string | null | undefined
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (val: unknown) => {
    if (typeof val !== "string") return;
    const trimmed = val.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };

  if (Array.isArray(images)) {
    for (const v of images) push(v);
  }
  // Always fold the legacy `image` value into the list so rows that haven't
  // been migrated yet (images IS NULL) still render. If it's already the first
  // element of `images`, the `seen` set dedupes it.
  push(legacy);

  if (out.length === 0) out.push(PLACEHOLDER_IMAGE);
  return out;
}

export function productFromRow(r: ProductRow): Product {
  const images = normaliseImages(r.images, r.image);
  return {
    id: r.id,
    sku: r.sku,
    name: pickLocalized(r.name_en, r.name_ar, r.name_fr, "Untitled product"),
    description: pickLocalized(
      r.description_en,
      r.description_ar,
      r.description_fr,
      ""
    ),
    price: num(r.price),
    purchasePrice: num(r.purchase_price, 0),
    categoryId: r.category_id,
    stock: num(r.stock),
    images,
    // Cover image is always the first gallery entry. Keeps `product.image`
    // a single source of truth for small thumbnails, cart rows, etc.
    image: images[0],
    rating: Math.max(0, Math.min(5, num(r.rating, 0))),
    createdAt: r.created_at,
  };
}

export function productToRow(p: Partial<Product>): Partial<ProductRow> {
  const row: Partial<ProductRow> = {};
  if (p.id !== undefined) row.id = p.id;
  if (p.sku !== undefined) row.sku = p.sku;
  if (p.name) {
    // Fill blanks with the EN value before writing so we never persist a
    // NULL translation that would force future fallbacks.
    const fallback = firstNonEmpty(p.name.en, p.name.fr, p.name.ar);
    row.name_en = p.name.en || fallback;
    row.name_ar = p.name.ar || fallback;
    row.name_fr = p.name.fr || fallback;
  }
  if (p.description) {
    row.description_en = p.description.en ?? "";
    row.description_ar = p.description.ar ?? "";
    row.description_fr = p.description.fr ?? "";
  }
  if (p.price !== undefined) row.price = p.price;
  if (p.purchasePrice !== undefined) row.purchase_price = p.purchasePrice;
  if (p.categoryId !== undefined) row.category_id = p.categoryId;
  if (p.stock !== undefined) row.stock = p.stock;

  // Multi-image write path. Whenever the caller provides `images`, we write
  // BOTH the array and the legacy `image` column so the schema stays usable
  // for old code paths that still read `image`. If only `image` is given
  // (legacy callers), we mirror it into `images` so the row satisfies the
  // multi-image contract.
  if (p.images !== undefined) {
    const clean = (p.images ?? [])
      .map((u) => (typeof u === "string" ? u.trim() : ""))
      .filter((u) => u.length > 0);
    row.images = clean;
    if (row.image === undefined) {
      row.image = clean[0] ?? p.image ?? "";
    }
  }
  if (p.image !== undefined) {
    row.image = p.image;
    if (row.images === undefined) {
      row.images = p.image ? [p.image] : [];
    }
  }

  if (p.rating !== undefined) row.rating = p.rating;
  if (p.createdAt !== undefined) row.created_at = p.createdAt;
  return row;
}

// ============================================================================
// Category
// ============================================================================

export interface CategoryRow {
  id: string;
  slug: string;
  name_en: string | null;
  name_ar: string | null;
  name_fr: string | null;
  icon: string | null;
}

export function categoryFromRow(r: CategoryRow): Category {
  return {
    id: r.id,
    slug: r.slug,
    name: pickLocalized(r.name_en, r.name_ar, r.name_fr, r.slug),
    // If the icon column is NULL/empty, fall back to a generic grid glyph so
    // CategoryChips still renders instead of crashing on an unknown name.
    icon: firstNonEmpty(r.icon) || "LayoutGrid",
  };
}

// ============================================================================
// User
// ============================================================================

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "customer" | "admin";
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  banned: boolean;
  password_hash: string;
  created_at: string;
  last_seen_at: string | null;
}

export function userFromRow(r: UserRow): User {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    phone: r.phone ?? undefined,
    address: r.address ?? undefined,
    city: r.city ?? undefined,
    postalCode: r.postal_code ?? undefined,
    country: r.country ?? undefined,
    banned: !!r.banned,
    passwordHash: r.password_hash,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at ?? undefined,
  };
}

export function userToRow(u: Partial<User>): Partial<UserRow> {
  const row: Partial<UserRow> = {};
  if (u.id !== undefined) row.id = u.id;
  if (u.email !== undefined) row.email = u.email;
  if (u.name !== undefined) row.name = u.name;
  if (u.role !== undefined) row.role = u.role;
  if (u.phone !== undefined) row.phone = u.phone ?? null;
  if (u.address !== undefined) row.address = u.address ?? null;
  if (u.city !== undefined) row.city = u.city ?? null;
  if (u.postalCode !== undefined) row.postal_code = u.postalCode ?? null;
  if (u.country !== undefined) row.country = u.country ?? null;
  if (u.banned !== undefined) row.banned = u.banned;
  if (u.passwordHash !== undefined) row.password_hash = u.passwordHash;
  if (u.createdAt !== undefined) row.created_at = u.createdAt;
  if (u.lastSeenAt !== undefined) row.last_seen_at = u.lastSeenAt ?? null;
  return row;
}

// ============================================================================
// Order + order_items
// ============================================================================

export interface OrderRow {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  customer_address: string;
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  status: OrderStatus;
  created_at: string;
}

export interface OrderItemRow {
  id?: number;
  order_id: string;
  product_id: string;
  name: string;
  quantity: number | string;
  price: number | string;
}

export function orderFromRow(r: OrderRow, items: OrderItemRow[]): Order {
  return {
    id: r.id,
    userId: r.user_id ?? undefined,
    customer: {
      name: r.customer_name,
      email: r.customer_email ?? undefined,
      phone: r.customer_phone ?? "",
      address: r.customer_address,
    },
    items: items
      .filter((i) => i.order_id === r.id)
      .map((i) => ({
        productId: i.product_id,
        name: i.name,
        quantity: num(i.quantity),
        price: num(i.price),
      })),
    subtotal: num(r.subtotal),
    tax: num(r.tax),
    total: num(r.total),
    status: r.status,
    createdAt: r.created_at,
  };
}

// ============================================================================
// Invoice
// ============================================================================

export interface InvoiceRow {
  id: string;
  order_id: string;
  number: string;
  issued_at: string;
  due_at: string;
  status: Invoice["status"];
  amount: number | string;
}

export function invoiceFromRow(r: InvoiceRow): Invoice {
  return {
    id: r.id,
    orderId: r.order_id,
    number: r.number,
    issuedAt: r.issued_at,
    dueAt: r.due_at,
    status: r.status,
    amount: num(r.amount),
  };
}

// ============================================================================
// Settings
// ============================================================================

export interface SettingsRow {
  id: number;
  store_name: string;
  currency: string;
  tax_rate: number | string;
  low_stock_threshold: number | string;
  // Footer / contact fields — added by supabase/settings-footer-migration.sql.
  // Schema defaults every column to empty string, so these are never null
  // in a correctly migrated project. The `?` keeps the mapper resilient to
  // older DBs where the migration hasn't been run yet — it falls back to
  // "" instead of crashing on undefined.
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  footer_tagline?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  twitter_url?: string | null;
  youtube_url?: string | null;
  linkedin_url?: string | null;
  tiktok_url?: string | null;
}

export function settingsFromRow(r: SettingsRow): Settings {
  return {
    storeName: r.store_name,
    currency: r.currency,
    taxRate: num(r.tax_rate, 10),
    lowStockThreshold: num(r.low_stock_threshold, 20),
    contactEmail: r.contact_email ?? "",
    contactPhone: r.contact_phone ?? "",
    address: r.address ?? "",
    footerTagline: r.footer_tagline ?? "",
    facebookUrl: r.facebook_url ?? "",
    instagramUrl: r.instagram_url ?? "",
    twitterUrl: r.twitter_url ?? "",
    youtubeUrl: r.youtube_url ?? "",
    linkedinUrl: r.linkedin_url ?? "",
    tiktokUrl: r.tiktok_url ?? "",
  };
}

export function settingsToRow(s: Partial<Settings>): Partial<SettingsRow> {
  const row: Partial<SettingsRow> = {};
  if (s.storeName !== undefined) row.store_name = s.storeName;
  if (s.currency !== undefined) row.currency = s.currency;
  if (s.taxRate !== undefined) row.tax_rate = s.taxRate;
  if (s.lowStockThreshold !== undefined)
    row.low_stock_threshold = s.lowStockThreshold;
  if (s.contactEmail !== undefined) row.contact_email = s.contactEmail;
  if (s.contactPhone !== undefined) row.contact_phone = s.contactPhone;
  if (s.address !== undefined) row.address = s.address;
  if (s.footerTagline !== undefined) row.footer_tagline = s.footerTagline;
  if (s.facebookUrl !== undefined) row.facebook_url = s.facebookUrl;
  if (s.instagramUrl !== undefined) row.instagram_url = s.instagramUrl;
  if (s.twitterUrl !== undefined) row.twitter_url = s.twitterUrl;
  if (s.youtubeUrl !== undefined) row.youtube_url = s.youtubeUrl;
  if (s.linkedinUrl !== undefined) row.linkedin_url = s.linkedinUrl;
  if (s.tiktokUrl !== undefined) row.tiktok_url = s.tiktokUrl;
  return row;
}
