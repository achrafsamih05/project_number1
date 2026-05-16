"use client";

// ---------------------------------------------------------------------------
// Toaster — renders the toast queue from useToastStore.
//
// Mount it ONCE near the top of the storefront tree (StoreShell) so any
// page or store can fire a toast without worrying about mount order.
//
// Behaviour:
//   - Stacks toasts bottom-right on desktop, bottom-center on mobile so the
//     thumb-zone isn't crowded.
//   - Each toast auto-dismisses after its `duration`. Hovering pauses the
//     timer (pointer-enter clears, pointer-leave restarts) so the user can
//     actually read longer messages.
//   - Click anywhere on the toast to dismiss it manually. Also exposes a
//     small "X" for keyboard users.
//   - Respects RTL by using `start`/`end` Tailwind utilities — the toast
//     rail flips automatically for Arabic.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import { Icon } from "./Icon";
import { useToastStore, type Toast, type ToastTone } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

const TONE_STYLES: Record<ToastTone, { bg: string; ring: string; icon: string; defaultIcon: string }> = {
  success: {
    bg: "bg-emerald-50 text-emerald-900",
    ring: "ring-emerald-200",
    icon: "text-emerald-600",
    defaultIcon: "CheckCircle2",
  },
  error: {
    bg: "bg-red-50 text-red-900",
    ring: "ring-red-200",
    icon: "text-red-600",
    defaultIcon: "AlertCircle",
  },
  info: {
    bg: "bg-white text-ink-900",
    ring: "ring-ink-200",
    icon: "text-ink-700",
    defaultIcon: "ShoppingBag",
  },
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div
      // Bottom-center on mobile, bottom-end on >=sm so the rail tucks into
      // the trailing edge alongside the corner of the viewport. pointer-
      // events-none on the rail itself + pointer-events-auto per toast
      // means clicks/taps outside a toast still hit the underlying UI.
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-3 sm:bottom-6 sm:items-end sm:px-6"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const tone = TONE_STYLES[toast.tone];
  // We keep the timer in a ref so pause-on-hover can clear it cleanly.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function arm() {
    if (toast.duration <= 0) return;
    timerRef.current = setTimeout(() => dismiss(toast.id), toast.duration);
  }
  function disarm() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    arm();
    return disarm;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  return (
    <div
      role="status"
      onClick={() => dismiss(toast.id)}
      onPointerEnter={disarm}
      onPointerLeave={arm}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-lift ring-1 transition",
        "animate-fade-in",
        tone.bg,
        tone.ring
      )}
    >
      <span className={cn("grid h-8 w-8 flex-none place-items-center", tone.icon)}>
        <Icon name={toast.icon ?? tone.defaultIcon} size={18} />
      </span>
      <span className="min-w-0 flex-1 break-words">{toast.message}</span>
      <button
        type="button"
        onClick={(e) => {
          // Stop the parent click from also firing — they're equivalent
          // here, but keeping them independent makes keyboard testing
          // unambiguous.
          e.stopPropagation();
          dismiss(toast.id);
        }}
        aria-label="Dismiss"
        className="grid h-7 w-7 flex-none place-items-center rounded-full opacity-70 hover:bg-black/5 hover:opacity-100"
      >
        <Icon name="X" size={14} />
      </button>
    </div>
  );
}
