import { NextRequest } from "next/server";
import { createProduct, listProducts, nextProductId } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { emit } from "@/lib/server/bus";
import { handle, httpError } from "@/lib/server/http";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/products?category=slug&q=text — public.
export const GET = (req: NextRequest) =>
  handle(async () => {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const q = searchParams.get("q")?.toLowerCase().trim() ?? "";

    let list = await listProducts();
    if (category && category !== "all") {
      list = list.filter(
        (p) =>
          p.categoryId === `c-${category}` || p.categoryId === category
      );
    }
    if (q) {
      list = list.filter((p) =>
        [p.name.en, p.name.ar, p.name.fr, p.description.en, p.sku]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    return list;
  });

// POST /api/products — admin only.
export const POST = (req: NextRequest) =>
  handle(async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") httpError(401, "Unauthorized");

    const body = (await req.json()) as Partial<Product>;
    if (!body.name || body.price == null || !body.categoryId) {
      httpError(400, "name, price, and categoryId are required");
    }
    const id = await nextProductId();
    // Normalise image input: accept either `images: string[]` (new multi-
    // image path), `image: string` (legacy single-URL callers), or neither
    // (fall back to a placeholder).
    const imagesIn = Array.isArray(body.images)
      ? body.images.filter(
          (u): u is string => typeof u === "string" && u.trim().length > 0
        )
      : [];
    const coverIn =
      typeof body.image === "string" && body.image.trim().length > 0
        ? body.image.trim()
        : undefined;
    const gallery =
      imagesIn.length > 0
        ? imagesIn
        : coverIn
        ? [coverIn]
        : ["https://picsum.photos/seed/nova/800/800"];

    const product: Product = {
      id,
      sku: body.sku ?? `NVA-${Date.now()}`,
      name: body.name as Product["name"],
      description:
        body.description ??
        ({ en: "", ar: "", fr: "" } as Product["description"]),
      price: Number(body.price),
      // Cost-of-goods price. Coerce to a finite non-negative number; missing
      // / NaN inputs default to 0 so the row still validates against the
      // numeric(12,2) NOT NULL DEFAULT 0 column. The admin "Expenses &
      // Profits" view reads this back to compute stock margin.
      purchasePrice: Math.max(0, Number(body.purchasePrice ?? 0) || 0),
      categoryId: body.categoryId!,
      stock: Number(body.stock ?? 0),
      images: gallery,
      image: gallery[0],
      rating: Number(body.rating ?? 4.5),
      createdAt: new Date().toISOString(),
    };
    await createProduct(product);
    emit({ channel: "products", action: "created", id: product.id });
    return product;
  });
