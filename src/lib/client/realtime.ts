"use client";

// Single shared EventSource so every hook reuses the same connection.
// Components subscribe by (channel, listener) and we fan out on message.

import { useEffect } from "react";

type Channel =
  | "products"
  | "categories"
  | "orders"
  | "invoices"
  | "users"
  | "settings";

interface Listener {
  channels: Channel[];
  cb: () => void;
}

interface Runtime {
  es: EventSource | null;
  listeners: Set<Listener>;
}

const g = globalThis as unknown as { __novaRT?: Runtime };

function runtime(): Runtime {
  if (!g.__novaRT) g.__novaRT = { es: null, listeners: new Set() };
  return g.__novaRT;
}

function ensureConnected() {
  const rt = runtime();
  if (rt.es) return;
  if (typeof window === "undefined") return;
  const es = new EventSource("/api/events");
  rt.es = es;
  es.onmessage = (e) => {
    try {
      const parsed = JSON.parse(e.data) as { channel: Channel };
      for (const l of rt.listeners) {
        if (l.channels.includes(parsed.channel)) l.cb();
      }
    } catch {
      /* ignore */
    }
  };
  es.onerror = () => {
    // Let the browser auto-reconnect; but if it's permanently closed, drop
    // the handle so the next subscription retries.
    if (es.readyState === EventSource.CLOSED) {
      rt.es = null;
    }
  };
}

/**
 * Call `cb` whenever any of the given channels emit a change.
 * The listener cleans itself up on unmount.
 */
export function useRealtime(channels: Channel[], cb: () => void) {
  useEffect(() => {
    ensureConnected();
    const rt = runtime();
    const listener: Listener = { channels, cb };
    rt.listeners.add(listener);
    return () => {
      rt.listeners.delete(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels.join("|")]);
}
