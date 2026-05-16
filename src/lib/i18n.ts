// Lightweight i18n: no external library, supports EN/AR/FR and RTL for AR.

import type { Locale } from "./types";

export const LOCALES: Locale[] = ["en", "ar", "fr"];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
  fr: "Français",
};

export const RTL_LOCALES: Locale[] = ["ar"];

export function dir(locale: Locale): "rtl" | "ltr" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

type Dict = Record<string, Record<Locale, string>>;

export const messages: Dict = {
  // Toolbar / nav
  "nav.home": { en: "Home", ar: "الرئيسية", fr: "Accueil" },
  "nav.categories": { en: "Categories", ar: "الفئات", fr: "Catégories" },
  "nav.cart": { en: "Cart", ar: "السلة", fr: "Panier" },
  "nav.account": { en: "Account", ar: "الحساب", fr: "Compte" },
  "nav.admin": { en: "Admin", ar: "الإدارة", fr: "Admin" },

  // Storefront
  "brand.name": { en: "BOM➜X", ar: "BOM➜X", fr: "BOM➜X" },
  "hero.title": {
    en: "Thoughtfully curated. Delivered fast.",
    ar: "مختارة بعناية. تصل بسرعة.",
    fr: "Soigneusement sélectionné. Livré vite.",
  },
  "hero.subtitle": {
    en: "Explore a wide range of plumbing supplies, hardware, and professional tools.",
    ar: "استكشف تشكيلة واسعة من لوازم السباكة، الأجهزة، والعدد المهنية.",
    fr: "Explorez une large gamme de fournitures de plomberie, quincaillerie et outils pro.",
  },
  "search.placeholder": {
    en: "Search products, brands, categories…",
    ar: "ابحث عن المنتجات والعلامات والفئات…",
    fr: "Rechercher produits, marques, catégories…",
  },
  "search.submit": { en: "Search", ar: "بحث", fr: "Chercher" },
  "categories.title": { en: "Shop by category", ar: "تسوق حسب الفئة", fr: "Acheter par catégorie" },
  "categories.all": { en: "All", ar: "الكل", fr: "Tout" },
  "products.title": { en: "Featured products", ar: "منتجات مميزة", fr: "Produits en vedette" },
  "products.empty": {
    en: "No products match your search.",
    ar: "لا توجد منتجات مطابقة لبحثك.",
    fr: "Aucun produit ne correspond à votre recherche.",
  },
  "product.add": { en: "Add to cart", ar: "أضف إلى السلة", fr: "Ajouter au panier" },
  "product.outOfStock": { en: "Out of stock", ar: "غير متوفر", fr: "Rupture de stock" },
  "product.inStock": { en: "In stock", ar: "متوفر", fr: "En stock" },
  "product.quickView": { en: "Quick view", ar: "عرض سريع", fr: "Aperçu rapide" },
  "product.quantity": { en: "Quantity", ar: "الكمية", fr: "Quantité" },
  "product.previousImage": { en: "Previous image", ar: "الصورة السابقة", fr: "Image précédente" },
  "product.nextImage": { en: "Next image", ar: "الصورة التالية", fr: "Image suivante" },
  "product.close": { en: "Close", ar: "إغلاق", fr: "Fermer" },

  // Cart
  "cart.title": { en: "Your cart", ar: "سلة التسوق", fr: "Votre panier" },
  "cart.empty": { en: "Your cart is empty.", ar: "سلتك فارغة.", fr: "Votre panier est vide." },
  "cart.empty.cta": { en: "Continue shopping", ar: "مواصلة التسوق", fr: "Continuer les achats" },
  "cart.subtotal": { en: "Subtotal", ar: "المجموع الفرعي", fr: "Sous-total" },
  "cart.tax": { en: "Tax (10%)", ar: "الضريبة (10%)", fr: "Taxe (10%)" },
  "cart.total": { en: "Total", ar: "الإجمالي", fr: "Total" },
  "cart.checkout": { en: "Checkout", ar: "إتمام الشراء", fr: "Commander" },
  "cart.clear": { en: "Clear cart", ar: "تفريغ السلة", fr: "Vider le panier" },
  "cart.remove": { en: "Remove", ar: "حذف", fr: "Retirer" },
  "cart.quantity": { en: "Qty", ar: "الكمية", fr: "Qté" },

  // Checkout
  "checkout.title": { en: "Checkout", ar: "إتمام الشراء", fr: "Paiement" },
  "checkout.name": { en: "Full name", ar: "الاسم الكامل", fr: "Nom complet" },
  "checkout.email": { en: "Email", ar: "البريد الإلكتروني", fr: "E-mail" },
  "checkout.phone": { en: "Phone", ar: "الهاتف", fr: "Téléphone" },
  "checkout.address": { en: "Shipping address", ar: "عنوان الشحن", fr: "Adresse de livraison" },
  "checkout.place": { en: "Place order", ar: "تأكيد الطلب", fr: "Passer la commande" },
  "checkout.or": { en: "— or enter shipping details below —", ar: "— أو أدخل تفاصيل الشحن أدناه —", fr: "— ou saisissez les détails ci-dessous —" },
  "checkout.oneClick.title": {
    en: "One-click order with your saved profile",
    ar: "اطلب بنقرة واحدة باستخدام ملفك المحفوظ",
    fr: "Commande en un clic avec votre profil enregistré",
  },
  "checkout.oneClick.cta": {
    en: "Confirm order",
    ar: "تأكيد الطلب",
    fr: "Confirmer",
  },
  "checkout.signInHint": {
    en: "Sign in for one-click checkout.",
    ar: "سجّل الدخول للدفع بنقرة واحدة.",
    fr: "Connectez-vous pour une commande en un clic.",
  },
  "checkout.success.title": { en: "Order placed", ar: "تم تأكيد الطلب", fr: "Commande confirmée" },
  "checkout.success.body": {
    en: "Thanks! You'll receive an invoice by email shortly.",
    ar: "شكرًا لك! ستتلقى الفاتورة عبر البريد الإلكتروني قريبًا.",
    fr: "Merci ! Vous recevrez une facture par e-mail sous peu.",
  },

  // Auth
  "auth.signIn": { en: "Sign in", ar: "تسجيل الدخول", fr: "Se connecter" },
  "auth.signOut": { en: "Sign out", ar: "تسجيل الخروج", fr: "Se déconnecter" },
  "auth.register": { en: "Create account", ar: "إنشاء حساب", fr: "Créer un compte" },
  "auth.password": { en: "Password", ar: "كلمة المرور", fr: "Mot de passe" },
  "auth.email": { en: "Email", ar: "البريد الإلكتروني", fr: "E-mail" },
  "auth.haveAccount": {
    en: "Already have an account?",
    ar: "هل لديك حساب بالفعل؟",
    fr: "Vous avez déjà un compte ?",
  },
  "auth.needAccount": {
    en: "Don't have an account yet?",
    ar: "ليس لديك حساب بعد؟",
    fr: "Pas encore de compte ?",
  },
  "auth.admin.title": { en: "Admin sign in", ar: "دخول المدير", fr: "Connexion admin" },
  "auth.admin.subtitle": {
    en: "This area is restricted. Only administrators can sign in.",
    ar: "هذه المنطقة محدودة. يمكن للمدراء فقط تسجيل الدخول.",
    fr: "Zone restreinte. Seuls les administrateurs peuvent se connecter.",
  },
  "auth.user.title": { en: "Welcome back", ar: "مرحبًا بعودتك", fr: "Bon retour" },
  "auth.user.subtitle": {
    en: "Sign in to manage your orders and check out in one click.",
    ar: "سجّل الدخول لإدارة طلباتك والشراء بنقرة واحدة.",
    fr: "Connectez-vous pour gérer vos commandes et payer en un clic.",
  },

  // Register
  "register.title": { en: "Create your account", ar: "أنشئ حسابك", fr: "Créez votre compte" },
  "register.subtitle": {
    en: "Save your shipping details once and check out in a single click.",
    ar: "احفظ تفاصيل الشحن مرة واحدة واشترِ بنقرة واحدة.",
    fr: "Enregistrez votre adresse une fois, et commandez en un clic.",
  },
  "register.fullName": { en: "Full name", ar: "الاسم الكامل", fr: "Nom complet" },
  "register.phone": { en: "Phone", ar: "الهاتف", fr: "Téléphone" },
  "register.address": { en: "Street address", ar: "عنوان الشارع", fr: "Adresse" },
  "register.city": { en: "City", ar: "المدينة", fr: "Ville" },
  "register.postalCode": { en: "Postal code", ar: "الرمز البريدي", fr: "Code postal" },
  "register.country": { en: "Country", ar: "البلد", fr: "Pays" },

  // Account
  "account.title": { en: "Your account", ar: "حسابك", fr: "Votre compte" },
  "account.prefs": { en: "Preferences", ar: "التفضيلات", fr: "Préférences" },
  "account.language": { en: "Language", ar: "اللغة", fr: "Langue" },
  "account.signedInAs": { en: "Signed in as", ar: "مسجل الدخول باسم", fr: "Connecté en tant que" },
  "account.shipping": { en: "Shipping profile", ar: "ملف الشحن", fr: "Profil de livraison" },
  "account.save": { en: "Save profile", ar: "حفظ الملف", fr: "Enregistrer" },
  "account.saved": { en: "Profile saved.", ar: "تم حفظ الملف.", fr: "Profil enregistré." },
  "account.orders": { en: "Recent orders", ar: "أحدث الطلبات", fr: "Commandes récentes" },

  // Admin
  "admin.title": { en: "Admin", ar: "الإدارة", fr: "Admin" },
  "admin.dashboard": { en: "Dashboard", ar: "لوحة التحكم", fr: "Tableau de bord" },
  "admin.inventory": { en: "Inventory", ar: "المخزون", fr: "Inventaire" },
  "admin.categories": { en: "Categories", ar: "التصنيفات", fr: "Catégories" },
  "admin.orders": { en: "Orders", ar: "الطلبات", fr: "Commandes" },
  "admin.invoices": { en: "Invoices", ar: "الفواتير", fr: "Factures" },
  "admin.users": { en: "Users", ar: "المستخدمون", fr: "Utilisateurs" },
  "admin.settings": { en: "Settings", ar: "الإعدادات", fr: "Paramètres" },
  "admin.expenses": { en: "Expenses & Profits", ar: "المصاريف والأرباح", fr: "Dépenses & profits" },

  // Footer
  "footer.contact": { en: "Contact", ar: "اتصل بنا", fr: "Contact" },
  "footer.follow": { en: "Follow us", ar: "تابعنا", fr: "Suivez-nous" },
  "footer.shop": { en: "Shop", ar: "المتجر", fr: "Boutique" },
  "footer.rights": {
    en: "All rights reserved.",
    ar: "جميع الحقوق محفوظة.",
    fr: "Tous droits réservés.",
  },
  "footer.call": { en: "Call", ar: "اتصل", fr: "Appeler" },
  "footer.email": { en: "Email", ar: "البريد", fr: "E-mail" },
  "footer.address": { en: "Address", ar: "العنوان", fr: "Adresse" },

  // Invoice print
  "invoice.title": { en: "Invoice", ar: "فاتورة", fr: "Facture" },
  "invoice.billTo": { en: "Bill to", ar: "فاتورة إلى", fr: "Facturé à" },
  "invoice.from": { en: "From", ar: "من", fr: "De" },
  "invoice.number": { en: "Invoice no.", ar: "رقم الفاتورة", fr: "Facture n°" },
  "invoice.issued": { en: "Issued", ar: "تاريخ الإصدار", fr: "Émise le" },
  "invoice.due": { en: "Due", ar: "تاريخ الاستحقاق", fr: "Échéance" },
  "invoice.status": { en: "Status", ar: "الحالة", fr: "Statut" },
  "invoice.item": { en: "Item", ar: "المنتج", fr: "Article" },
  "invoice.qty": { en: "Qty", ar: "الكمية", fr: "Qté" },
  "invoice.unitPrice": { en: "Unit price", ar: "السعر", fr: "Prix unitaire" },
  "invoice.lineTotal": { en: "Total", ar: "الإجمالي", fr: "Total" },
  "invoice.subtotal": { en: "Subtotal", ar: "المجموع الفرعي", fr: "Sous-total" },
  "invoice.tax": { en: "Tax", ar: "الضريبة", fr: "Taxe" },
  "invoice.total": { en: "Grand total", ar: "الإجمالي الكلي", fr: "Total" },
  "invoice.thankYou": {
    en: "Thank you for shopping with us.",
    ar: "شكراً لتسوقك معنا.",
    fr: "Merci pour votre achat.",
  },
  "invoice.print": { en: "Print invoice", ar: "طباعة الفاتورة", fr: "Imprimer" },
  "invoice.back": { en: "Back", ar: "رجوع", fr: "Retour" },
};

export function t(key: string, locale: Locale): string {
  const entry = messages[key];
  if (!entry) return key;
  return entry[locale] ?? entry.en ?? key;
}
