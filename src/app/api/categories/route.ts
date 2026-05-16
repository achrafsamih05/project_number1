import { NextRequest } from "next/server";
import {
  createCategory,
  listCategories,
  nextCategoryId,
} from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { emit } from "@/lib/server/bus";
import { handle, httpError } from "@/lib/server/http";
import type { Category, LocalizedString } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/categories — public.
export const GET = () => handle(() => listCategories());

// POST /api/categories — admin only.
// Body: { slug, name: { en, ar, fr }, icon }
export const POST = (req: NextRequest) =>
  handle(async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") httpError(401, "Unauthorized");

    const body = (await req.json()) as Partial<{
      slug: string;
      name: Partial<LocalizedString>;
      icon: string;
    }>;

    const slug = (body.slug ?? "").trim().toLowerCase();
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      httpError(400, "slug must be lowercase alphanumeric/dashes");
    }
    if (!body.name || !body.name.en) {
      httpError(400, "name.en is required");
    }

    const id = await nextCategoryId(slug);
    const category: Category = {
      id,
      slug,
      name: {
        en: body.name.en!,
        ar: body.name.ar || body.name.en!,
        fr: body.name.fr || body.name.en!,
      },
      icon: (body.icon || "LayoutGrid").trim() || "LayoutGrid",
    };
    const created = await createCategory(category);
    emit({ channel: "categories", action: "created", id: created.id });
    return created;
  });
