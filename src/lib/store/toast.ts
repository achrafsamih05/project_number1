"use client";

// ---------------------------------------------------------------------------
// Toast store — minimal, zero-deps, Zustand-backed.
//
// Why we built our own instead of pulling in `sonner`/`react-hot-toast`:
//   - The repo's policy is "no extra deps unless absolutely required"
//     (see package.json — only 8 runtime deps total). Toasts are simple
//     enough to roll in ~80 lines.
//   - The cart-add use case needs only success/info messages. We don't need
//     promise toasts, custom JSX, theming, etc.
//
// API surface stays close to sonner's so a future swap is mechanical:
//   toast.success("Saved")        → shows a green toast
//   toast.info("Tip")             → neutral toast
//   toast.error("Try again")      → red toast
//   toast.dismiss(id)             → manual dismiss
//
// Each toast auto-dismisses after `duration` ms (default 2500). Render is
// done by <Toaster /> — see src/components/ui/Toaster.tsx.
// ---------------------------------------------------------------------------

import { create } from "zustand";

export type ToastTone = "success" | "error" | "info";

export interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
  // Lucide icon name. Optional — Toaster picks a sensible default per tone.
  icon?: string;
  // Auto-dismiss delay in ms. Set to 0 to disable auto-dismiss.
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (
    message: string,
    opts?: { tone?: ToastTone; icon?: string; duration?: number }
  ) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

// We use a counter rather than crypto.randomUUID() so the ids stay short
// and human-readable in React keys / dev tools. Collisions are impossible
// inside one tab.
let counter = 0;
const nextId = () => `t_${++counter}`;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, opts) => {
    const id = nextId();
    const t: Toast = {
      id,
      message,
      tone: opts?.tone ?? "info",
      icon: opts?.icon,
      duration: opts?.duration ?? 2500,
    };
    set((s) => ({ toasts: [...s.toasts, t] }));
    return id;
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/**
 * Imperative facade with the sonner-shaped API. Lets non-React code (e.g.
 * the cart store) trigger toasts without having to thread the hook through.
 *
 * Calling these from a server component is a no-op (the underlying store
 * doesn't exist on the server) — guard with `typeof window !== "undefined"`
 * if a server caller ever needs to invoke a toast.
 */
export const toast = {
  success: (message: string, opts?: { icon?: string; duration?: number }) =>
    useToastStore.getState().push(message, { ...opts, tone: "success" }),
  error: (message: string, opts?: { icon?: string; duration?: number }) =>
    useToastStore.getState().push(message, { ...opts, tone: "error" }),
  info: (message: string, opts?: { icon?: string; duration?: number }) =>
    useToastStore.getState().push(message, { ...opts, tone: "info" }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};
