import { NextRequest } from "next/server";
import {
  createSessionToken,
  hashPassword,
  setSessionCookie,
  toPublicUser,
} from "@/lib/server/auth";
import { createUser, getUserByEmail } from "@/lib/server/db";
import { emit } from "@/lib/server/bus";
import { handle, httpError } from "@/lib/server/http";
import { requireStoreId } from "@/lib/server/tenant";
import type { User } from "@/lib/types";

// POST /api/auth/register — customers only (tenant-scoped).
export const POST = (req: NextRequest) =>
  handle(async () => {
    const storeId = await requireStoreId();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") httpError(400, "Invalid body");

    const {
      email,
      password,
      name,
      phone,
      address,
      city,
      postalCode,
      country,
    } = body as Record<string, string>;

    if (!email || !password || !name || !address) {
      httpError(400, "email, password, name and address are required");
    }
    if (password.length < 8) {
      httpError(400, "Password must be at least 8 characters");
    }

    const existing = await getUserByEmail(email);
    if (existing) httpError(409, "Email already registered");

    const draft: User = {
      id: `u-${Date.now().toString(36)}`,
      storeId,
      email: email.toLowerCase().trim(),
      name,
      role: "customer",
      phone,
      address,
      city,
      postalCode,
      country,
      banned: false,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };

    const created = await createUser(draft);
    emit({ channel: "users", action: "created", id: created.id });

    const token = createSessionToken(created);
    setSessionCookie(token);

    return toPublicUser(created);
  });
