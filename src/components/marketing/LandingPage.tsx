"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

// ---------------------------------------------------------------------------
// Nova Commerce OS — Marketing Landing Page
//
// Rendered on the platform root domain (e.g., commerce-os.com) when no
// tenant subdomain/custom domain is detected. This is a high-converting,
// modern dark/light hybrid page showcasing Nova's features.
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: "Store" as const,
    title: "Multi-Tenant Stores",
    titleAr: "متاجر متعددة المستأجرين",
    desc: "Each merchant gets their own isolated store with subdomain routing, custom domains, and dedicated admin panel.",
  },
  {
    icon: "Phone" as const,
    title: "Phone-First Checkout",
    titleAr: "دفع بالهاتف أولاً",
    desc: "Optimized for emerging markets — guests order with just a phone number. No email required.",
  },
  {
    icon: "MessageCircle" as const,
    title: "WhatsApp Commerce",
    titleAr: "تجارة واتساب",
    desc: "Click-to-order via WhatsApp with pre-filled messages. Post-checkout confirmation flow built in.",
  },
  {
    icon: "Brain" as const,
    title: "AI Product Descriptions",
    titleAr: "أوصاف المنتجات بالذكاء الاصطناعي",
    desc: "Generate SEO-optimized product descriptions in 3 languages with one click. Powered by Gemini.",
  },
  {
    icon: "TrendingUp" as const,
    title: "Predictive Inventory",
    titleAr: "ذكاء المخزون التنبؤي",
    desc: "Know exactly when products will run out based on 14-day sales velocity. Smart restock alerts.",
  },
  {
    icon: "BarChart3" as const,
    title: "Micro-ERP Dashboard",
    titleAr: "لوحة تحكم ERP مصغرة",
    desc: "Capital tied, projected profits, average margins — all scoped per-store in real time.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ─── Hero Section ─── */}
      <header className="relative overflow-hidden bg-ink-950 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-transparent to-emerald-600/10" />
        <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-base font-bold text-ink-900">
              N
            </span>
            <span className="text-lg font-semibold tracking-tight">Nova</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login/admin"
              className="text-sm text-white/70 hover:text-white transition"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex h-9 items-center rounded-lg bg-white px-4 text-sm font-medium text-ink-900 hover:bg-white/90 transition"
            >
              Create Store
            </Link>
          </div>
        </nav>

        <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-16 text-center sm:pt-24 sm:pb-28">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
            <Icon name="Sparkles" size={14} />
            AI-Powered Commerce OS for Emerging Markets
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Launch your store in{" "}
            <span className="bg-gradient-to-r from-brand-400 to-emerald-400 bg-clip-text text-transparent">
              minutes
            </span>
            , not months
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
            Nova is the complete multi-tenant commerce platform built for
            phone-first markets. WhatsApp checkout, AI descriptions, predictive
            inventory — everything a modern merchant needs.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-ink-900 shadow-lg hover:bg-white/90 transition"
            >
              <Icon name="Rocket" size={18} />
              Create Your Store — Free
            </Link>
            <a
              href="#features"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 px-6 text-sm font-medium text-white hover:bg-white/10 transition"
            >
              See Features
              <Icon name="ArrowDown" size={16} />
            </a>
          </div>
        </div>
      </header>

      {/* ─── Features Grid ─── */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            Everything you need to sell online
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-ink-500">
            From AI-powered product content to predictive stock management,
            Nova handles the complexity so you can focus on growing.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-ink-100 bg-white p-6 shadow-soft transition hover:border-ink-200 hover:shadow-lg"
            >
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-ink-900 text-white shadow-soft">
                <Icon name={f.icon} size={20} />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-ink-900">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="bg-ink-950 text-white">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center sm:py-28">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to launch your store?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/70">
            Join merchants across emerging markets who trust Nova to power their
            e-commerce. Free tier available — no credit card required.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-500 px-6 text-sm font-semibold text-white shadow-lg hover:bg-brand-600 transition"
            >
              <Icon name="Store" size={18} />
              Create Your Store
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-ink-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8 text-center text-xs text-ink-500">
          © {new Date().getFullYear()} Nova Commerce OS. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
