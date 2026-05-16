# Frontend Architecture

This is a quick map of the app layers and how data flows.

## Layer diagram

```
 ┌──────────────────────────────────────────────────────────────────┐
 │ Pages (src/app/*)                                                 │
 │   Storefront: /, /categories, /checkout, /account                 │
 │   Auth:       /login  /login/admin  /register                     │
 │   Admin:      /admin, /admin/{inventory, orders, invoices,        │
 │               users, settings}                                    │
 └────────────┬─────────────────────────────────┬───────────────────┘
              │                                 │
              ▼                                 ▼
       ┌──────────────┐                  ┌──────────────┐
       │ StoreShell   │                  │ AdminShell   │
       └──────┬───────┘                  └──────┬───────┘
              │                                 │
              ▼                                 ▼
 ┌──────────────────────────────────────────────────────────┐
 │ Client hooks (src/lib/client/hooks.ts)                    │
 │   useProducts, useCategories, useSettings,                │
 │   useOrders, useInvoices, useUsers, useMe                 │
 │        │                                                  │
 │        │  subscribes to                                   │
 │        ▼                                                  │
 │ SSE reader (src/lib/client/realtime.ts) ◄─── /api/events  │
 └──────────────┬───────────────────────────────────────────┘
                │  fetch/json
                ▼
          ┌──────────────┐
          │ API routes   │ (src/app/api/*)
          │  → emit()    │  bus.ts fires SSE
          │  → server DB │
          └──────────────┘
                │
                ▼
       ┌──────────────────┐
       │ src/lib/server/db │ (file-backed in dev, Supabase/Postgres in prod)
       └──────────────────┘

Edge middleware (src/middleware.ts) gates /admin/* and admin APIs
by verifying the nova_session HMAC cookie.
```

## State

| Store            | Scope     | Persistence      |
| ---------------- | --------- | ---------------- |
| `useCart`        | Cart + drawer  | `localStorage` |
| `useLocale`      | Active locale  | `localStorage` |
| `useMe`          | Current user   | HTTP cookie (server) + memory |
| `useSettings`    | Global config  | DB + SSE        |
| `useProducts`    | Catalog        | DB + SSE        |
| `useCategories`  | Filter list    | DB + SSE        |
| `useOrders`      | Admin table    | DB + SSE        |
| `useInvoices`    | Admin table    | DB + SSE        |
| `useUsers`       | Admin table    | DB + SSE        |

## Realtime

`src/lib/server/bus.ts` is a single `EventEmitter` stored on `globalThis` (hot-reload safe). Every mutating API route calls `emit({ channel, action, id })`. `src/app/api/events/route.ts` streams those events to any connected client as SSE. `src/lib/client/realtime.ts` opens one shared `EventSource` per tab and fans out to subscribed hooks.

To scale horizontally: replace the `EventEmitter` with Redis pub/sub or Postgres `LISTEN/NOTIFY` — the client contract is unchanged.

## Auth

- `src/lib/server/auth.ts` — password hashing (scrypt), session token signing (HMAC-SHA256 via Node `crypto`), `getCurrentUser()`, `setSessionCookie()`.
- `src/middleware.ts` — Edge runtime; re-implements the HMAC check with Web Crypto so it works without Node's `crypto`. Redirects unauthenticated/non-admin users to `/login/admin` for UI, or returns 401 for API.

## i18n & RTL

- Dictionary in `src/lib/i18n.ts` (one keyed map per message id).
- `useI18n()` returns `{ locale, dir, t, setLocale }` and syncs `<html dir/lang>` on mount.
- Layout uses logical utilities (`start-*`, `end-*`, `ps-*`, `pe-*`) so mirroring for Arabic is automatic.
