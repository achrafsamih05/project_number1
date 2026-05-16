"use client";

// Typed fetch wrappers. Every endpoint returns `{ data }` or `{ error }`.

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  const json = await res.json().catch(() => ({ error: "Invalid JSON" }));
  if (!res.ok) throw new Error(json.error ?? `${res.status}`);
  return json.data as T;
}

export async function apiSend<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({ error: "Invalid JSON" }));
  if (!res.ok) throw new Error(json.error ?? `${res.status}`);
  return json.data as T;
}
