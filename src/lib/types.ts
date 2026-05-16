// Shared domain types for the Nova e-commerce app.

export type Locale = "en" | "ar" | "fr";

export type LocalizedString = Record<Locale, string>;

export interface Category {
  id: string;
  slug: string;
  name: LocalizedString;
  icon: string; // lucide icon name
}

export interface Product {
  id: string;
  sku: string;
  name: LocalizedString;
  description: LocalizedString;
  /**
   * Sale price — the amount the customer pays. Always >= 0.
   */
  price: number;
  /**
   * Cost-of-goods price — what the store paid to acquire one unit. Used by
   * the admin "Expenses & Profits" view to compute capital tied in stock and
   * projected profit (`(price - purchasePrice) * stock`).
   *
   * Defaults to 0 when the schema migration hasn't been run yet, so the
   * profit view simply shows zero margin instead of crashing.
   */
  purchasePrice: number;
  categoryId: string;
  stock: number;
  /**
   * Full list of product image URLs (gallery). Always present — mappers
   * normalize legacy single-URL rows into a one-element array so consumers
   * never have to branch on "old" vs "new" shape.
   */
  images: string[];
  /**
   * Convenience cover image. Always equals `images[0]` when images are
   * present; kept as a separate field so legacy callers (thumbnails,
   * small listings, third-party integrations) don't need to touch the
   * array.
   */
  image: string;
  rating: number;
  createdAt: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface ShippingAddress {
  name: string;
  /** Optional — guests can place orders without an email. Auth users get
   *  their profile email auto-filled as readonly. */
  email?: string;
  /** Primary mandatory identifier for all orders (guest and auth). */
  phone: string;
  address: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

export interface Order {
  id: string;
  userId?: string;
  customer: ShippingAddress;
  items: {
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
}

export interface Invoice {
  id: string;
  orderId: string;
  number: string;
  issuedAt: string;
  dueAt: string;
  status: "paid" | "unpaid" | "overdue";
  amount: number;
}

export type UserRole = "customer" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  banned: boolean;
  passwordHash: string;
  createdAt: string;
  lastSeenAt?: string;
}

// Exposed to clients — never includes passwordHash.
export type PublicUser = Omit<User, "passwordHash">;

export interface Settings {
  storeName: string;
  currency: string; // ISO 4217
  taxRate: number; // percent, e.g. 10
  lowStockThreshold: number;

  // -- Contact + marketing fields that power the storefront <Footer />.
  // All optional on the server (default ''), never null. Empty string means
  // "hide this item in the footer" — the component treats any blank value
  // as absent rather than rendering a dead link.
  contactEmail: string;
  contactPhone: string;
  address: string;
  footerTagline: string;

  // Social media URLs. Stored as full absolute URLs so the footer can drop
  // them straight into an <a href>. Blank = not shown.
  facebookUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  youtubeUrl: string;
  linkedinUrl: string;
  tiktokUrl: string;
}
