import "server-only";
import { EventEmitter } from "events";

// Single-process event bus used to fan out DB mutations to SSE subscribers.
// For multi-instance production, replace with Redis pub/sub, Postgres
// LISTEN/NOTIFY, or Supabase Realtime — keep the emit() surface identical.

export type ChannelName =
  | "products"
  | "categories"
  | "orders"
  | "invoices"
  | "users"
  | "settings";

export interface BusEvent {
  channel: ChannelName;
  action: "created" | "updated" | "deleted";
  id?: string;
  at: number;
}

// Stash on globalThis so Next.js dev hot-reloads don't spawn duplicates.
const globalForBus = globalThis as unknown as { __novaBus?: EventEmitter };
export const bus: EventEmitter =
  globalForBus.__novaBus ?? (globalForBus.__novaBus = new EventEmitter());

// EventEmitter defaults to 10 listeners — raise for SSE fan-out.
bus.setMaxListeners(0);

export function emit(event: Omit<BusEvent, "at">) {
  bus.emit("event", { ...event, at: Date.now() });
}
