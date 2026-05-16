// ---------------------------------------------------------------------------
// WhatsApp URL generator utilities.
//
// Constructs wa.me links with pre-filled, URL-encoded messages. Handles
// Arabic, French, currency symbols, line breaks, and special characters
// safely via encodeURIComponent().
// ---------------------------------------------------------------------------

import type { Locale } from "./types";

/** Payload for a single-product "Order via WhatsApp" button. */
export interface WhatsAppProductPayload {
  productName: string;
  productUrl: string;
  price: string; // pre-formatted with currency
  locale: Locale;
  storeName: string;
}

/** Payload for post-checkout order confirmation via WhatsApp. */
export interface WhatsAppOrderPayload {
  orderId: string;
  total: string; // pre-formatted with currency
  items: { name: string; quantity: number; price: string }[];
  locale: Locale;
  storeName: string;
}

// ---------------------------------------------------------------------------
// Message templates per locale
// ---------------------------------------------------------------------------

const PRODUCT_TEMPLATES: Record<Locale, (p: WhatsAppProductPayload) => string> = {
  en: (p) =>
    `Hello 👋\n\nI would like to order this item from ${p.storeName}:\n\n` +
    `🛒 *${p.productName}*\n💰 Price: ${p.price}\n🔗 ${p.productUrl}\n\n` +
    `Please confirm availability and shipping details. Thank you!`,
  ar: (p) =>
    `مرحباً 👋\n\nأرغب في طلب هذا المنتج من ${p.storeName}:\n\n` +
    `🛒 *${p.productName}*\n💰 السعر: ${p.price}\n🔗 ${p.productUrl}\n\n` +
    `يرجى تأكيد التوفر وتفاصيل الشحن. شكراً!`,
  fr: (p) =>
    `Bonjour 👋\n\nJe souhaite commander cet article de ${p.storeName} :\n\n` +
    `🛒 *${p.productName}*\n💰 Prix : ${p.price}\n🔗 ${p.productUrl}\n\n` +
    `Merci de confirmer la disponibilité et les détails de livraison.`,
};

const ORDER_TEMPLATES: Record<Locale, (p: WhatsAppOrderPayload) => string> = {
  en: (p) => {
    const itemLines = p.items
      .map((i) => `  • ${i.name} ×${i.quantity} — ${i.price}`)
      .join("\n");
    return (
      `Hello 👋\n\nI just placed an order on *${p.storeName}* and want to confirm it for quick shipping.\n\n` +
      `📦 *Order:* ${p.orderId}\n💰 *Total:* ${p.total}\n\n` +
      `Items:\n${itemLines}\n\n` +
      `Please confirm my order. Thank you!`
    );
  },
  ar: (p) => {
    const itemLines = p.items
      .map((i) => `  • ${i.name} ×${i.quantity} — ${i.price}`)
      .join("\n");
    return (
      `مرحباً 👋\n\nلقد قمت للتو بطلب على *${p.storeName}* وأريد تأكيده للشحن السريع.\n\n` +
      `📦 *الطلب:* ${p.orderId}\n💰 *الإجمالي:* ${p.total}\n\n` +
      `المنتجات:\n${itemLines}\n\n` +
      `يرجى تأكيد طلبي. شكراً!`
    );
  },
  fr: (p) => {
    const itemLines = p.items
      .map((i) => `  • ${i.name} ×${i.quantity} — ${i.price}`)
      .join("\n");
    return (
      `Bonjour 👋\n\nJe viens de passer une commande sur *${p.storeName}* et je souhaite la confirmer pour une expédition rapide.\n\n` +
      `📦 *Commande :* ${p.orderId}\n💰 *Total :* ${p.total}\n\n` +
      `Articles :\n${itemLines}\n\n` +
      `Merci de confirmer ma commande.`
    );
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize a WhatsApp number by stripping spaces/dashes and ensuring no
 * leading "+" in the wa.me path (wa.me expects digits only after the slash).
 */
function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

/**
 * Build a WhatsApp click-to-chat URL for ordering a single product.
 */
export function buildProductWhatsAppUrl(
  whatsappNumber: string,
  payload: WhatsAppProductPayload
): string {
  const phone = normalizePhone(whatsappNumber);
  const message = PRODUCT_TEMPLATES[payload.locale](payload);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Build a WhatsApp click-to-chat URL for confirming a placed order.
 */
export function buildOrderWhatsAppUrl(
  whatsappNumber: string,
  payload: WhatsAppOrderPayload
): string {
  const phone = normalizePhone(whatsappNumber);
  const message = ORDER_TEMPLATES[payload.locale](payload);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
