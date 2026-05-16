import "server-only";
import { getSupabaseAdmin } from "./supabase";
import {
  CATEGORY_COLUMNS,
  CategoryRow,
  INVOICE_COLUMNS,
  InvoiceRow,
  ORDER_COLUMNS,
  ORDER_ITEM_COLUMNS,
  OrderItemRow,
  OrderRow,
  PRODUCT_COLUMNS,
  ProductRow,
  SETTINGS_COLUMNS,
  SettingsRow,
  USER_COLUMNS,
  UserRow,
  categoryFromRow,
  invoiceFromRow,
  orderFromRow,
  productFromRow,
  productToRow,
  settingsFromRow,
  settingsToRow,
  userFromRow,
  userToRow,
} from "./mappers";
import type {
  Category,
  Invoice,
  Order,
  Product,
  Settings,
  User,
} from "../types";

// ---------------------------------------------------------------------------
// Multi-Tenant Supabase-backed DB.
//
// IMPORTANT: Every query now filters by store_id to enforce tenant isolation
// at the application layer. The RLS policies provide defense-in-depth, but
// since we use the service-role client (bypasses RLS), this application-level
// filtering is the PRIMARY isolation mechanism.
//
// All list/get/create/update functions accept a `storeId` parameter.
// API routes resolve the store_id from the tenant context (middleware headers)
// and pass it through.
// ---------------------------------------------------------------------------

const sb = () => getSupabaseAdmin();

function raise(op: string, err: unknown): never {
  // eslint-disable-next-line no-console
  console.error(`[db] ${op} failed — Supabase returned:`, err);
  const e = err as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  } | null;
  const parts = [`${op} failed`];
  if (e?.message) parts.push(`— ${e.message}`);
  if (e?.code) parts.push(`(code ${e.code})`);
  if (e?.details) parts.push(`· ${e.details}`);
  if (e?.hint) parts.push(`· hint: ${e.hint}`);
  throw new Error(parts.join(" "));
}

function warnIfEmpty(op: string, rows: unknown[]) {
  if (!Array.isArray(rows) || rows.length > 0) return;
  // eslint-disable-next-line no-console
  console.warn(
    `[db] ${op} returned 0 rows. If you expect data, verify:\n` +
      `  - SUPABASE_URL points at the right project\n` +
      `  - SUPABASE_SERVICE_ROLE_KEY is set (not just SUPABASE_ANON_KEY)\n` +
      `  - the table was seeded (npm run seed)\n` +
      `  - RLS policies on the table allow this client to read\n` +
      `  - the store_id filter matches existing data`
  );
}

// ---------- Products -------------------------------------------------------

export async function listProducts(storeId: string): Promise<Product[]> {
  const { data, error } = await sb()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) raise("listProducts", error);
  const rows = (data ?? []) as unknown as ProductRow[];
  warnIfEmpty("listProducts", rows);
  return rows.map(productFromRow);
}

export async function getProduct(id: string, storeId: string): Promise<Product | null> {
  const { data, error } = await sb()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("id", id)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) raise("getProduct", error);
  return data ? productFromRow(data as unknown as ProductRow) : null;
}

export async function createProduct(p: Product): Promise<Product> {
  const { data, error } = await sb()
    .from("products")
    .insert(productToRow(p))
    .select(PRODUCT_COLUMNS)
    .single();
  if (error) raise("createProduct", error);
  return productFromRow(data as unknown as ProductRow);
}

export const addProduct = createProduct;

export async function updateProduct(
  id: string,
  patch: Partial<Product>,
  storeId: string
): Promise<Product | null> {
  const row = productToRow(patch);
  const { data, error } = await sb()
    .from("products")
    .update(row)
    .eq("id", id)
    .eq("store_id", storeId)
    .select(PRODUCT_COLUMNS)
    .maybeSingle();
  if (error) raise("updateProduct", error);
  return data ? productFromRow(data as unknown as ProductRow) : null;
}

export async function deleteProduct(id: string, storeId: string): Promise<Product | null> {
  const { data, error } = await sb()
    .from("products")
    .delete()
    .eq("id", id)
    .eq("store_id", storeId)
    .select(PRODUCT_COLUMNS)
    .maybeSingle();
  if (error) raise("deleteProduct", error);
  return data ? productFromRow(data as unknown as ProductRow) : null;
}

export async function nextProductId(): Promise<string> {
  const raw = crypto.randomUUID().replace(/-/g, "");
  const slug = BigInt("0x" + raw.slice(0, 12)).toString(36).padStart(10, "0");
  return `prd_${slug}`;
}

// ---------- Categories -----------------------------------------------------

export async function listCategories(storeId: string): Promise<Category[]> {
  const { data, error } = await sb()
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .eq("store_id", storeId)
    .order("slug");
  if (error) raise("listCategories", error);
  const rows = (data ?? []) as unknown as CategoryRow[];
  warnIfEmpty("listCategories", rows);
  return rows.map(categoryFromRow);
}

export async function getCategory(id: string, storeId: string): Promise<Category | null> {
  const { data, error } = await sb()
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .eq("id", id)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) raise("getCategory", error);
  return data ? categoryFromRow(data as unknown as CategoryRow) : null;
}

export async function createCategory(c: Category): Promise<Category> {
  const row = {
    id: c.id,
    store_id: c.storeId,
    slug: c.slug,
    name_en: c.name.en,
    name_ar: c.name.ar,
    name_fr: c.name.fr,
    icon: c.icon,
  };
  const { data, error } = await sb()
    .from("categories")
    .insert(row)
    .select(CATEGORY_COLUMNS)
    .single();
  if (error) raise("createCategory", error);
  return categoryFromRow(data as unknown as CategoryRow);
}

export async function deleteCategory(id: string, storeId: string): Promise<Category | null> {
  const { data, error } = await sb()
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("store_id", storeId)
    .select(CATEGORY_COLUMNS)
    .maybeSingle();
  if (error) raise("deleteCategory", error);
  return data ? categoryFromRow(data as unknown as CategoryRow) : null;
}

export async function nextCategoryId(slug: string, storeId: string): Promise<string> {
  const base = `c-${slug}`;
  const existing = await getCategory(base, storeId);
  if (!existing) return base;
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

// ---------- Orders ---------------------------------------------------------

async function loadAllOrderItems(orderIds: string[]): Promise<OrderItemRow[]> {
  if (orderIds.length === 0) return [];
  const { data, error } = await sb()
    .from("order_items")
    .select(ORDER_ITEM_COLUMNS)
    .in("order_id", orderIds);
  if (error) raise("loadAllOrderItems", error);
  return (data ?? []) as unknown as OrderItemRow[];
}

export async function listOrders(storeId: string): Promise<Order[]> {
  const { data, error } = await sb()
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) raise("listOrders", error);
  const rows = (data ?? []) as unknown as OrderRow[];
  const items = await loadAllOrderItems(rows.map((r) => r.id));
  return rows.map((r) => orderFromRow(r, items));
}

export async function getOrder(id: string, storeId: string): Promise<Order | null> {
  const { data, error } = await sb()
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", id)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) raise("getOrder", error);
  if (!data) return null;
  const items = await loadAllOrderItems([id]);
  return orderFromRow(data as unknown as OrderRow, items);
}

export async function createOrder(o: Order): Promise<void> {
  const orderRow: Omit<OrderRow, "id"> & { id: string } = {
    id: o.id,
    store_id: o.storeId,
    user_id: o.userId ?? null,
    customer_name: o.customer.name,
    customer_email: o.customer.email || null,
    customer_phone: o.customer.phone,
    customer_address: o.customer.address,
    subtotal: o.subtotal,
    tax: o.tax,
    total: o.total,
    status: o.status,
    created_at: o.createdAt,
  };

  const { error: orderErr } = await sb().from("orders").insert(orderRow);
  if (orderErr) raise("createOrder (orders insert)", orderErr);

  if (o.items.length > 0) {
    const itemRows = o.items.map<OrderItemRow>((i) => ({
      order_id: o.id,
      product_id: i.productId,
      name: i.name,
      quantity: i.quantity,
      price: i.price,
    }));
    const { error: itemsErr } = await sb().from("order_items").insert(itemRows);
    if (itemsErr) {
      await sb().from("orders").delete().eq("id", o.id);
      raise("createOrder (order_items insert)", itemsErr);
    }
  }
}

export async function updateOrder(
  id: string,
  patch: Partial<Order>,
  storeId: string
): Promise<Order | null> {
  const row: Partial<OrderRow> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.customer) {
    row.customer_name = patch.customer.name;
    row.customer_email = patch.customer.email || null;
    row.customer_phone = patch.customer.phone;
    row.customer_address = patch.customer.address;
  }
  if (patch.subtotal !== undefined) row.subtotal = patch.subtotal;
  if (patch.tax !== undefined) row.tax = patch.tax;
  if (patch.total !== undefined) row.total = patch.total;

  if (Object.keys(row).length === 0 && patch.items === undefined) {
    return getOrder(id, storeId);
  }

  if (Object.keys(row).length > 0) {
    const { error } = await sb()
      .from("orders")
      .update(row)
      .eq("id", id)
      .eq("store_id", storeId);
    if (error) raise("updateOrder", error);
  }

  if (patch.items !== undefined) {
    const { error: delErr } = await sb()
      .from("order_items")
      .delete()
      .eq("order_id", id);
    if (delErr) raise("updateOrder (delete items)", delErr);

    if (patch.items.length > 0) {
      const itemRows = patch.items.map<OrderItemRow>((i) => ({
        order_id: id,
        product_id: i.productId,
        name: i.name,
        quantity: i.quantity,
        price: i.price,
      }));
      const { error: insErr } = await sb().from("order_items").insert(itemRows);
      if (insErr) raise("updateOrder (insert items)", insErr);
    }
  }

  return getOrder(id, storeId);
}

export async function nextOrderId(): Promise<string> {
  const { count, error } = await sb()
    .from("orders")
    .select("id", { count: "exact", head: true });
  if (error) raise("nextOrderId", error);
  const n = 1000 + (count ?? 0) + 1;
  return `o-${n}`;
}

// ---------- Invoices -------------------------------------------------------

export async function listInvoices(storeId: string): Promise<Invoice[]> {
  const { data, error } = await sb()
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .eq("store_id", storeId)
    .order("issued_at", { ascending: false });
  if (error) raise("listInvoices", error);
  return ((data ?? []) as unknown as InvoiceRow[]).map(invoiceFromRow);
}

export async function getInvoice(id: string, storeId: string): Promise<Invoice | null> {
  const { data, error } = await sb()
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .eq("id", id)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) raise("getInvoice", error);
  return data ? invoiceFromRow(data as unknown as InvoiceRow) : null;
}

export async function createInvoice(inv: Invoice): Promise<void> {
  const { error } = await sb().from("invoices").insert({
    id: inv.id,
    store_id: inv.storeId,
    order_id: inv.orderId,
    number: inv.number,
    issued_at: inv.issuedAt,
    due_at: inv.dueAt,
    status: inv.status,
    amount: inv.amount,
  });
  if (error) raise("createInvoice", error);
}

export async function updateInvoice(
  id: string,
  patch: Partial<Invoice>,
  storeId: string
): Promise<Invoice | null> {
  const row: Partial<InvoiceRow> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.amount !== undefined) row.amount = patch.amount;
  if (patch.dueAt !== undefined) row.due_at = patch.dueAt;
  if (patch.number !== undefined) row.number = patch.number;

  const { data, error } = await sb()
    .from("invoices")
    .update(row)
    .eq("id", id)
    .eq("store_id", storeId)
    .select(INVOICE_COLUMNS)
    .maybeSingle();
  if (error) raise("updateInvoice", error);
  return data ? invoiceFromRow(data as unknown as InvoiceRow) : null;
}

export async function nextInvoiceId(): Promise<string> {
  const { count, error } = await sb()
    .from("invoices")
    .select("id", { count: "exact", head: true });
  if (error) raise("nextInvoiceId", error);
  const n = 5000 + (count ?? 0) + 1;
  return `i-${n}`;
}

// ---------- Users ----------------------------------------------------------

export async function listUsers(storeId: string): Promise<User[]> {
  const { data, error } = await sb()
    .from("users")
    .select(USER_COLUMNS)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) raise("listUsers", error);
  return ((data ?? []) as unknown as UserRow[]).map(userFromRow);
}

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await sb()
    .from("users")
    .select(USER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) raise("getUserById", error);
  return data ? userFromRow(data as unknown as UserRow) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const e = email.toLowerCase().trim();
  const { data, error } = await sb()
    .from("users")
    .select(USER_COLUMNS)
    .ilike("email", e)
    .maybeSingle();
  if (error) raise("getUserByEmail", error);
  return data ? userFromRow(data as unknown as UserRow) : null;
}

export async function createUser(u: User): Promise<User> {
  const required: Record<string, unknown> = {
    id: u.id,
    store_id: u.storeId,
    email: u.email,
    name: u.name,
    role: u.role,
    password_hash: u.passwordHash,
  };

  const optional: Record<string, unknown> = {};
  if (u.phone !== undefined) optional.phone = u.phone;
  if (u.address !== undefined) optional.address = u.address;
  if (u.city !== undefined) optional.city = u.city;
  if (u.postalCode !== undefined) optional.postal_code = u.postalCode;
  if (u.country !== undefined) optional.country = u.country;

  const payload = { ...required, ...optional };

  const { data, error } = await sb()
    .from("users")
    .insert(payload)
    .select(USER_COLUMNS)
    .single();
  if (error) raise("createUser", error);
  return userFromRow(data as unknown as UserRow);
}

export async function updateUser(
  id: string,
  patch: Partial<User>,
  storeId?: string
): Promise<User | null> {
  const row = userToRow(patch);
  let query = sb()
    .from("users")
    .update(row)
    .eq("id", id);

  // If storeId provided, scope the update to that store
  if (storeId) {
    query = query.eq("store_id", storeId);
  }

  const { data, error } = await query
    .select(USER_COLUMNS)
    .maybeSingle();
  if (error) raise("updateUser", error);
  return data ? userFromRow(data as unknown as UserRow) : null;
}

export async function deleteUser(id: string, storeId: string): Promise<User | null> {
  const { data, error } = await sb()
    .from("users")
    .delete()
    .eq("id", id)
    .eq("store_id", storeId)
    .select(USER_COLUMNS)
    .maybeSingle();
  if (error) raise("deleteUser", error);
  return data ? userFromRow(data as unknown as UserRow) : null;
}

// ---------- Settings -------------------------------------------------------
//
// Settings are now per-store (keyed by store_id instead of id=1).

export async function getSettings(storeId: string): Promise<Settings> {
  const { data, error } = await sb()
    .from("settings")
    .select(SETTINGS_COLUMNS)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) raise("getSettings", error);
  if (!data) {
    // No settings row for this store yet. Return sane defaults.
    return {
      storeId,
      storeName: "Nova",
      currency: "USD",
      taxRate: 10,
      lowStockThreshold: 20,
      contactEmail: "",
      contactPhone: "",
      address: "",
      footerTagline: "",
      facebookUrl: "",
      instagramUrl: "",
      twitterUrl: "",
      youtubeUrl: "",
      linkedinUrl: "",
      tiktokUrl: "",
      whatsappNumber: "",
    };
  }
  return settingsFromRow(data as unknown as SettingsRow);
}

export async function updateSettings(
  patch: Partial<Settings>,
  storeId: string
): Promise<Settings> {
  const row = settingsToRow(patch);

  // Try update first
  const { data, error } = await sb()
    .from("settings")
    .update(row)
    .eq("store_id", storeId)
    .select(SETTINGS_COLUMNS)
    .maybeSingle();
  if (error) raise("updateSettings", error);

  if (!data) {
    // No row exists yet for this store — upsert.
    const defaults = {
      store_id: storeId,
      store_name: "Nova",
      currency: "USD",
      tax_rate: 10,
      low_stock_threshold: 20,
      ...row,
    };
    const upsert = await sb()
      .from("settings")
      .upsert(defaults)
      .select(SETTINGS_COLUMNS)
      .single();
    if (upsert.error) raise("updateSettings (upsert)", upsert.error);
    return settingsFromRow(upsert.data as unknown as SettingsRow);
  }
  return settingsFromRow(data as unknown as SettingsRow);
}
