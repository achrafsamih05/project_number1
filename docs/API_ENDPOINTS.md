# API Endpoints

All endpoints are Next.js App Router route handlers under `src/app/api/*`. Responses are JSON `{ data }` on success or `{ error }` on failure. The middleware at `src/middleware.ts` enforces admin-only access for `/admin/*`, `/api/users/*` and `/api/analytics/*`; per-method checks inside `/api/settings`, `/api/invoices` and `/api/orders/:id` cover finer-grained rules.

Base URL in development: `http://localhost:3000`

## Auth

### `POST /api/auth/register`
Body:
```json
{
  "email": "alex@example.com",
  "password": "min8chars",
  "name": "Alex",
  "phone": "+1 ...",
  "address": "Street",
  "city": "Paris",
  "postalCode": "75001",
  "country": "FR"
}
```
Creates a customer, sets an HTTP-only session cookie, returns the public user.

### `POST /api/auth/login`
Body: `{ email, password, intent?: "customer" | "admin" }`. If `intent=admin` and the account is not an admin, returns **403**.

### `POST /api/auth/logout`
Clears the session cookie.

### `GET /api/auth/me`
Returns the current user (or `null` if not signed in).

### `PATCH /api/auth/me`
Updates own profile. Accepts: `name`, `phone`, `address`, `city`, `postalCode`, `country`. Powers the "shipping profile" in `/account`.

## Products

### `GET /api/products`
Public. Query: `category=slug`, `q=text`.

### `POST /api/products` · admin
### `GET /api/products/:id` · public
### `PATCH /api/products/:id` · admin
### `DELETE /api/products/:id` · admin

Each admin mutation emits a realtime `products` event so storefront and other admins update immediately.

## Categories

### `GET /api/categories` · public

## Orders

### `GET /api/orders`
Admin sees all orders; logged-in customers see only their own; guests see `[]`.

### `POST /api/orders`
Two modes:
- **Guest / form-based:** body = `{ customer: {name,email,phone,address}, items: [{productId,quantity}] }`.
- **One-click for logged-in users:** body = `{ useProfile: true, items: [...] }` — the server fills shipping from the saved profile (requires `address` + `phone`). Returns 400 if profile incomplete, 401 if not signed in.

Side effects:
- Decrements `products.stock` for each line.
- Creates a matching `invoices` row with status `unpaid`.
- Emits `orders.created`, `invoices.created` and N × `products.updated`.

### `GET /api/orders/:id`
Admin or owner only (403 otherwise).

### `PATCH /api/orders/:id` · admin
Body: `{ status: "pending"|"processing"|"shipped"|"delivered"|"cancelled" }`.

## Invoices

### `GET /api/invoices` · admin
### `GET /api/invoices/:id` · admin
### `PATCH /api/invoices/:id` · admin (toggle paid/unpaid)

## Settings

### `GET /api/settings` · public
Returns `{ storeName, currency, taxRate, lowStockThreshold }`. The storefront reads this on every page so a change propagates immediately.

### `PATCH /api/settings` · admin
Any subset of the fields above. Emits `settings.updated`.

## Users (admin)

### `GET /api/users`
Returns all users without their `passwordHash`.

### `PATCH /api/users/:id`
Ban/unban (`{ banned: true|false }`) or change role (`{ role: "admin"|"customer" }`). Admins can't demote themselves.

### `DELETE /api/users/:id`
Deletes an account. Can't delete yourself.

## Analytics (admin)

### `GET /api/analytics`
Computes real numbers from the DB (no placeholders):

```json
{
  "data": {
    "revenue": 535.7,                 // sum of paid invoices only
    "outstanding": 988.9,             // unpaid + overdue invoices
    "orders": 2,
    "products": 12,
    "totalUsers": 1,                  // non-admin accounts
    "activeUsers": 1,                 // with an order or seen in last 30 days
    "orderStatus": { "pending": 0, "processing": 0, "shipped": 1, "delivered": 1, "cancelled": 0 },
    "unpaid": 1,
    "topProducts": [
      { "productId": "p-001", "name": "...", "qty": 1, "revenue": 189 }
    ],
    "lowStock": [
      { "id": "p-009", "name": "...", "stock": 7, "sku": "..." }
    ],
    "series": [ { "date": "2026-05-01", "revenue": 0, "orders": 0 }, ... ],
    "currency": "USD"
  }
}
```

## Realtime

### `GET /api/events` · Server-Sent Events
Streams `data: {"channel":"products|categories|orders|invoices|users|settings","action":"created|updated|deleted","id":"...","at":123}`. A heartbeat `: ping` line is sent every 25s so proxies keep the connection open.

Client hooks (`useProducts`, `useCategories`, `useSettings`, `useOrders`, `useInvoices`, `useUsers`, `useMe`) subscribe to the relevant channels and silently re-fetch — so the whole UI is live without a page reload.

## Error shape

```json
{ "error": "Unauthorized" }
```

Common codes: `200` OK · `201` Created · `400` Bad request · `401` Unauthorized · `403` Forbidden · `404` Not found · `409` Conflict (duplicate email).
