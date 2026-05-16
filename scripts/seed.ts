/*
 * One-shot seed script. Run it after applying supabase/schema.sql.
 *
 *   npm run seed
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY
 * if your inserts are allowed via RLS) in your .env.local. The service-role
 * key is recommended because it bypasses RLS.
 */
import "dotenv/config"; // tsx doesn't auto-load .env.local; fall back below

import { createClient } from "@supabase/supabase-js";
import { randomBytes, scryptSync } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

function loadEnvFile(path: string) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* no .env.local, that's fine */
  }
}
loadEnvFile(join(process.cwd(), ".env.local"));
loadEnvFile(join(process.cwd(), ".env"));

const url = process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error(
    "Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY). " +
      "Add them to .env.local and retry."
  );
  process.exit(1);
}
const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64).toString("hex");
  return `${salt}$${hash}`;
}

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=70`;

// Build a small gallery (cover + 2–3 alternate shots) from Unsplash ids.
// The first entry is the cover, which the DB trigger also mirrors into the
// legacy `image` column, so old readers keep working while the new Quick
// View modal can render the full gallery.
const gallery = (...ids: string[]) => ids.map(img);

const products = [
  { id: "p-001", sku: "NVA-EL-001", name_en: "Aura Wireless Headphones", name_ar: "سماعات أورا اللاسلكية",  name_fr: "Casque sans fil Aura",  description_en: "Studio-grade sound with adaptive noise cancellation and 40h battery.", description_ar: "صوت بمستوى الاستوديو مع إلغاء ضوضاء تكيفي وبطارية 40 ساعة.",  description_fr: "Son studio, réduction de bruit adaptative et 40 h d'autonomie.", price: 189,  category_id: "c-electronics", stock: 42,  image: img("photo-1518444065439-e933c06ce9cd"), images: gallery("photo-1518444065439-e933c06ce9cd", "photo-1505740420928-5e560c06d30e", "photo-1546435770-a3e426bf472b"), rating: 4.8 },
  { id: "p-002", sku: "NVA-PH-001", name_en: "Nova X1 Smartphone",       name_ar: "هاتف نوفا X1 الذكي",   name_fr: "Smartphone Nova X1",     description_en: "6.7\" OLED, triple camera, and a titanium frame built to last.",        description_ar: "شاشة OLED 6.7 بوصة، ثلاث كاميرات، وإطار تيتانيوم متين.",      description_fr: "OLED 6,7\", triple caméra, châssis en titane durable.",             price: 899,  category_id: "c-phones",     stock: 18,  image: img("photo-1511707171634-5f897ff02aa9"), images: gallery("photo-1511707171634-5f897ff02aa9", "photo-1512499617640-c74ae3a79d37", "photo-1598327105666-5b89351aff97"), rating: 4.7 },
  { id: "p-003", sku: "NVA-PL-001", name_en: "Copper Pipe Wrench",       name_ar: "مفتاح أنابيب نحاسي",   name_fr: "Clé à tube en cuivre",  description_en: "Forged steel jaws, ergonomic grip. Works on 1/2\" to 2\" pipes.",         description_ar: "فكوك فولاذية مطروقة ومقبض مريح. يناسب أنابيب 1/2 إلى 2 بوصة.",  description_fr: "Mâchoires en acier forgé, poignée ergonomique. Tubes 1/2\" à 2\".",   price: 34,   category_id: "c-plumbing",   stock: 120, image: img("photo-1581092921461-eab62e97a780"), images: gallery("photo-1581092921461-eab62e97a780", "photo-1572981779307-38b8cabb2407", "photo-1504148455328-c376907d081c"), rating: 4.5 },
  { id: "p-004", sku: "NVA-EL-002", name_en: "Lumen Smart Lamp",         name_ar: "مصباح لومن الذكي",     name_fr: "Lampe connectée Lumen",  description_en: "Millions of colors, voice control, and circadian rhythm presets.",       description_ar: "ملايين الألوان وتحكم صوتي وإعدادات الإيقاع اليومي.",           description_fr: "Des millions de couleurs, commande vocale et modes circadiens.",   price: 59,   category_id: "c-home",       stock: 77,  image: img("photo-1513506003901-1e6a229e2d15"), images: gallery("photo-1513506003901-1e6a229e2d15", "photo-1524438418049-ab2acc7b05b2", "photo-1519710164239-da123dc03ef4"), rating: 4.6 },
  { id: "p-005", sku: "NVA-FA-001", name_en: "Atelier Leather Jacket",   name_ar: "سترة أتيليه الجلدية",  name_fr: "Veste en cuir Atelier", description_en: "Hand-finished full-grain leather with a tailored modern cut.",           description_ar: "جلد طبيعي مصنوع يدويًا بقصة عصرية مخصصة.",                    description_fr: "Cuir pleine fleur fini main, coupe moderne.",                     price: 349,  category_id: "c-fashion",    stock: 22,  image: img("photo-1551028719-00167b16eac5"), images: gallery("photo-1551028719-00167b16eac5", "photo-1520975916090-3105956dac38", "photo-1551232864-3f0890e580d9"), rating: 4.9 },
  { id: "p-006", sku: "NVA-SP-001", name_en: "Pulse Running Shoes",      name_ar: "حذاء بولس للجري",      name_fr: "Chaussures de course Pulse", description_en: "Responsive foam, breathable mesh, 0-drop performance profile.",      description_ar: "رغوة متجاوبة وشبكة تهوية وملف أداء بدون فرق ارتفاع.",          description_fr: "Mousse réactive, mesh respirant, profil drop zéro.",              price: 129,  category_id: "c-sports",     stock: 64,  image: img("photo-1542291026-7eec264c27ff"), images: gallery("photo-1542291026-7eec264c27ff", "photo-1606107557195-0e29a4b5b4aa", "photo-1552346154-21d32810aba3"), rating: 4.4 },
  { id: "p-007", sku: "NVA-EL-003", name_en: "Orbit Smartwatch",         name_ar: "ساعة أوربت الذكية",    name_fr: "Montre connectée Orbit", description_en: "Health tracking, GPS, and a sapphire display ready for anything.",      description_ar: "متابعة الصحة وGPS وشاشة سافير جاهزة لكل شيء.",                 description_fr: "Suivi santé, GPS et écran saphir prêt à tout.",                   price: 249,  category_id: "c-electronics", stock: 31,  image: img("photo-1523275335684-37898b6baf30"), images: gallery("photo-1523275335684-37898b6baf30", "photo-1617043786394-f977fa12eddf", "photo-1579586337278-3befd40fd17a"), rating: 4.6 },
  { id: "p-008", sku: "NVA-PL-002", name_en: "Flow Kitchen Faucet",      name_ar: "حنفية مطبخ فلو",       name_fr: "Robinet de cuisine Flow", description_en: "Pull-down sprayer, brushed nickel finish, ceramic disc valve.",        description_ar: "رأس قابل للسحب، طلاء نيكل مصقول، وصمام قرص خزفي.",             description_fr: "Douchette extractible, finition nickel brossé, cartouche céramique.", price: 189, category_id: "c-plumbing", stock: 48,  image: img("photo-1584622650111-993a426fbf0a"), images: gallery("photo-1584622650111-993a426fbf0a", "photo-1556909114-f6e7ad7d3136", "photo-1556911220-e15b29be8c8f"), rating: 4.3 },
  { id: "p-009", sku: "NVA-HM-001", name_en: "Cloud Linen Sofa",         name_ar: "أريكة كلاود الكتانية", name_fr: "Canapé en lin Cloud",   description_en: "Deep-seat three-seater with a hardwood frame and washable covers.",      description_ar: "أريكة ثلاثية عميقة بإطار خشبي صلب وأغطية قابلة للغسل.",         description_fr: "Canapé 3 places assise profonde, structure bois massif, housses lavables.", price: 1299, category_id: "c-home",  stock: 7,   image: img("photo-1555041469-a586c61ea9bc"), images: gallery("photo-1555041469-a586c61ea9bc", "photo-1540574163026-643ea20ade25", "photo-1519710164239-da123dc03ef4"), rating: 4.8 },
  { id: "p-010", sku: "NVA-PH-002", name_en: "Nova Buds Pro",            name_ar: "سماعات نوفا بودز برو", name_fr: "Nova Buds Pro",        description_en: "Wireless earbuds with spatial audio and a pocketable charging case.",   description_ar: "سماعات لاسلكية بصوت مكاني وعلبة شحن مدمجة.",                    description_fr: "Écouteurs sans fil, audio spatial et boîtier de charge compact.", price: 149,  category_id: "c-phones",    stock: 96,  image: img("photo-1606220945770-b5b6c2c55bf1"), images: gallery("photo-1606220945770-b5b6c2c55bf1", "photo-1590658268037-6bf12165a8df", "photo-1572569511254-d8f925fe2cbb"), rating: 4.5 },
  { id: "p-011", sku: "NVA-FA-002", name_en: "Linen Summer Shirt",       name_ar: "قميص صيفي كتاني",      name_fr: "Chemise en lin d'été",  description_en: "Breathable linen blend with a relaxed, modern silhouette.",             description_ar: "مزيج كتاني يسمح بمرور الهواء بقصّة عصرية مريحة.",               description_fr: "Mélange de lin respirant, silhouette moderne et décontractée.",   price: 79,   category_id: "c-fashion",   stock: 58,  image: img("photo-1520975916090-3105956dac38"), images: gallery("photo-1520975916090-3105956dac38", "photo-1521572163474-6864f9cf17ab", "photo-1618354691373-d851c5c3a990"), rating: 4.2 },
  { id: "p-012", sku: "NVA-SP-002", name_en: "Forge Dumbbell Set",       name_ar: "طقم دمبل فورج",        name_fr: "Set d'haltères Forge", description_en: "Matte-black rubber hex dumbbells, 5 to 50 lbs, with a sleek rack.",     description_ar: "دمبلات سداسية مطاطية سوداء من 5 إلى 50 رطلاً مع حامل أنيق.",     description_fr: "Haltères hexagonaux noirs mats, 5 à 50 lb, avec rack élégant.",   price: 499,  category_id: "c-sports",    stock: 12,  image: img("photo-1517836357463-d25dfeac3438"), images: gallery("photo-1517836357463-d25dfeac3438", "photo-1534438327276-14e5300c3a48", "photo-1558611848-73f7eb4001a1"), rating: 4.7 },
];

const categories = [
  { id: "c-electronics", slug: "electronics", name_en: "Electronics", name_ar: "إلكترونيات", name_fr: "Électronique", icon: "Cpu" },
  { id: "c-phones",      slug: "phones",      name_en: "Phones",      name_ar: "هواتف",       name_fr: "Téléphones",  icon: "Smartphone" },
  { id: "c-plumbing",    slug: "plumbing",    name_en: "Plumbing",    name_ar: "سباكة",       name_fr: "Plomberie",   icon: "Wrench" },
  { id: "c-home",        slug: "home",        name_en: "Home",        name_ar: "المنزل",      name_fr: "Maison",      icon: "Sofa" },
  { id: "c-fashion",     slug: "fashion",     name_en: "Fashion",     name_ar: "أزياء",       name_fr: "Mode",        icon: "Shirt" },
  { id: "c-sports",      slug: "sports",      name_en: "Sports",      name_ar: "رياضة",       name_fr: "Sport",       icon: "Dumbbell" },
];

const users = [
  {
    id: "u-admin",
    email: "admin@nova.shop",
    name: "Nova Admin",
    role: "admin" as const,
    phone: "+1 555 0100",
    address: "1 Commerce Way",
    city: "New York",
    postal_code: "10001",
    country: "US",
    banned: false,
    password_hash: hashPassword("admin1234"),
  },
  {
    id: "u-demo",
    email: "demo@nova.shop",
    name: "Demo Customer",
    role: "customer" as const,
    phone: "+1 555 0200",
    address: "221B Baker St",
    city: "London",
    postal_code: "NW1 6XE",
    country: "UK",
    banned: false,
    password_hash: hashPassword("demo1234"),
  },
];

async function upsert(table: string, rows: unknown[], onConflict = "id") {
  if (rows.length === 0) return;
  const { error } = await sb.from(table).upsert(rows as never, { onConflict });
  if (error) {
    console.error(`  ✗ upsert ${table} failed:`, error.message);
    process.exit(1);
  }
  console.log(`  ✓ ${table}: ${rows.length} rows`);
}

async function main() {
  console.log(`Seeding ${url}…`);

  await upsert("categories", categories);
  await upsert("products", products);
  await upsert("users", users, "id");

  await upsert("settings", [
    {
      id: 1,
      store_name: "Nova",
      currency: "USD",
      tax_rate: 10,
      low_stock_threshold: 20,
    },
  ]);

  console.log("\nDone.\n");
  console.log("Seed accounts (rotate immediately):");
  console.log("  admin@nova.shop / admin1234");
  console.log("  demo@nova.shop  / demo1234");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
