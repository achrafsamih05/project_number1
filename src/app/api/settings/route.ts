import { NextRequest } from "next/server";
import { getSettings, updateSettings } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { emit } from "@/lib/server/bus";
import { handle, httpError } from "@/lib/server/http";
import { requireStoreId } from "@/lib/server/tenant";
import type { Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/settings — PUBLIC (tenant-scoped).
export const GET = () =>
  handle(async () => {
    const storeId = await requireStoreId();
    return getSettings(storeId);
  });

const MAX_SHORT = 128;
const MAX_URL = 512;
const MAX_LONG = 512;

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max);
}

function url(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, MAX_URL);
  if (trimmed === "") return "";
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    new URL(withScheme);
    return withScheme;
  } catch {
    return undefined;
  }
}

// PATCH /api/settings — admin only (tenant-scoped).
export const PATCH = (req: NextRequest) =>
  handle(async () => {
    const storeId = await requireStoreId();
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") httpError(401, "Unauthorized");

    const body = (await req.json().catch(() => ({}))) as Partial<Settings>;
    const patch: Partial<Settings> = {};

    if (typeof body.storeName === "string" && body.storeName.trim()) {
      patch.storeName = body.storeName.trim().slice(0, 64);
    }
    if (typeof body.currency === "string" && body.currency.trim()) {
      patch.currency = body.currency.trim().toUpperCase().slice(0, 8);
    }
    if (
      typeof body.taxRate === "number" &&
      body.taxRate >= 0 &&
      body.taxRate <= 100
    ) {
      patch.taxRate = body.taxRate;
    }
    if (
      typeof body.lowStockThreshold === "number" &&
      body.lowStockThreshold >= 0 &&
      body.lowStockThreshold <= 10_000
    ) {
      patch.lowStockThreshold = body.lowStockThreshold;
    }

    const email = str(body.contactEmail, MAX_SHORT);
    if (email !== undefined) patch.contactEmail = email;
    const phone = str(body.contactPhone, MAX_SHORT);
    if (phone !== undefined) patch.contactPhone = phone;
    const address = str(body.address, MAX_LONG);
    if (address !== undefined) patch.address = address;
    const tagline = str(body.footerTagline, MAX_LONG);
    if (tagline !== undefined) patch.footerTagline = tagline;

    const fb = url(body.facebookUrl);
    if (fb !== undefined) patch.facebookUrl = fb;
    const ig = url(body.instagramUrl);
    if (ig !== undefined) patch.instagramUrl = ig;
    const tw = url(body.twitterUrl);
    if (tw !== undefined) patch.twitterUrl = tw;
    const yt = url(body.youtubeUrl);
    if (yt !== undefined) patch.youtubeUrl = yt;
    const ln = url(body.linkedinUrl);
    if (ln !== undefined) patch.linkedinUrl = ln;
    const tk = url(body.tiktokUrl);
    if (tk !== undefined) patch.tiktokUrl = tk;

    const updated = await updateSettings(patch, storeId);
    emit({ channel: "settings", action: "updated" });
    return updated;
  });

export const POST = PATCH;
