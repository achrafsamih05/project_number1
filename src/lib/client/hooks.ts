"use client";

// Data hooks — fetch + SSE. Keep them simple so we don't pull in SWR/React Query.

import { useCallback, useEffect, useState } from "react";
import type {
  Category,
  Invoice,
  Order,
  Product,
  PublicUser,
  Settings,
} from "../types";
import { apiGet } from "./api";
import { useRealtime } from "./realtime";

// ---- products ----
export function useProducts() {
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const d = await apiGet<Product[]>("/api/products");
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);
  useRealtime(["products"], reload);

  return { data, loading, error, reload };
}

// ---- categories ----
export function useCategories() {
  const [data, setData] = useState<Category[]>([]);
  const reload = useCallback(async () => {
    try {
      setData(await apiGet<Category[]>("/api/categories"));
    } catch {
      /* noop */
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  useRealtime(["categories"], reload);
  return data;
}

// ---- settings ----
export function useSettings(): Settings | null {
  const [data, setData] = useState<Settings | null>(null);
  const reload = useCallback(async () => {
    try {
      setData(await apiGet<Settings>("/api/settings"));
    } catch {
      /* noop */
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  useRealtime(["settings"], reload);
  return data;
}

// ---- orders (admin) ----
export function useOrders() {
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      setData(await apiGet<Order[]>("/api/orders"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  useRealtime(["orders"], reload);
  return { data, loading, reload };
}

// ---- invoices (admin) ----
export function useInvoices() {
  const [data, setData] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      setData(await apiGet<Invoice[]>("/api/invoices"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  useRealtime(["invoices"], reload);
  return { data, loading, reload };
}

// ---- users (admin) ----
export function useUsers() {
  const [data, setData] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      setData(await apiGet<PublicUser[]>("/api/users"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  useRealtime(["users"], reload);
  return { data, loading, reload };
}

// ---- current user ("me") ----
//
// The /api/auth/me endpoint returns one of three shapes:
//   - PublicUser            → signed in and not banned
//   - null                  → no session
//   - { banned: true }      → cookie matched a banned user; cookie was just
//                             cleared on the server. The client should bounce
//                             the visitor to /restricted.
//
// We collapse the first two into the existing `data: PublicUser | null` so
// every page that already destructures `data` keeps working unchanged. The
// banned signal is surfaced as a separate `banned` flag — only BanGuard
// reads it, and it's strictly additive.
export function useMe() {
  const [data, setData] = useState<PublicUser | null>(null);
  const [banned, setBanned] = useState(false);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      const raw = await apiGet<PublicUser | { banned: true } | null>(
        "/api/auth/me"
      );
      if (raw && typeof raw === "object" && "banned" in raw && raw.banned) {
        setData(null);
        setBanned(true);
      } else {
        setData((raw as PublicUser | null) ?? null);
        setBanned(false);
      }
    } catch {
      setData(null);
      setBanned(false);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  useRealtime(["users"], reload);
  return { data, banned, loading, reload, setData };
}
