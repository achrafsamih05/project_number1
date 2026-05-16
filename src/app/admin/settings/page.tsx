"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/ui/Icon";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n";
import { apiSend } from "@/lib/client/api";
import { useMe, useSettings } from "@/lib/client/hooks";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";
import type { Locale, Settings } from "@/lib/types";

const CURRENCIES = ["USD", "EUR", "GBP", "MAD", "AED", "SAR", "JPY"];

export default function AdminSettings() {
  const { t, locale, setLocale } = useI18n();
  const settings = useSettings();
  const { data: me } = useMe();
  const [form, setForm] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialise local form state from server-loaded settings.
  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  if (!form) {
    return (
      <AdminShell>
        <div className="py-16 text-center text-ink-400">Loading…</div>
      </AdminShell>
    );
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      await apiSend("/api/settings", "PATCH", form);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  // Tiny typed field-setter keeps the individual input bindings tidy.
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("admin.settings")}
          </h1>
          <p className="text-sm text-ink-500">
            Global site configuration. Changes here update the storefront
            instantly — including the footer contact info and social links.
          </p>
        </header>

        {me && (
          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
            <h2 className="mb-4 text-base font-semibold">Profile</h2>
            <div className="flex items-center gap-4">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-ink-900 text-2xl font-semibold text-white">
                {me.name.charAt(0).toUpperCase()}
              </span>
              <div>
                <div className="font-medium">{me.name}</div>
                <div className="text-sm text-ink-500">{me.email}</div>
                <div className="mt-1 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                  {me.role}
                </div>
              </div>
            </div>
          </section>
        )}

        <form onSubmit={save} className="space-y-6">
          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
            <h2 className="mb-4 text-base font-semibold">Store</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Store name">
                <input
                  value={form.storeName}
                  onChange={(e) => set("storeName", e.target.value)}
                  className={inputCls}
                  maxLength={64}
                  required
                />
              </Field>
              <Field label="Currency">
                <select
                  value={form.currency}
                  onChange={(e) => set("currency", e.target.value)}
                  className={inputCls}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tax rate (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={form.taxRate}
                  onChange={(e) => set("taxRate", Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <Field label="Low-stock threshold">
                <input
                  type="number"
                  min={0}
                  value={form.lowStockThreshold}
                  onChange={(e) =>
                    set("lowStockThreshold", Number(e.target.value))
                  }
                  className={inputCls}
                />
              </Field>
            </div>
          </section>

          {/* ----- Contact info (shows in the storefront footer) ----- */}
          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
            <header className="mb-4">
              <h2 className="text-base font-semibold">Contact & Footer</h2>
              <p className="mt-0.5 text-xs text-ink-500">
                These details appear in the storefront footer on every page.
                Leave a field empty to hide it.
              </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Contact email">
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => set("contactEmail", e.target.value)}
                  className={inputCls}
                  placeholder="hello@example.com"
                  maxLength={128}
                />
              </Field>
              <Field label="Contact phone">
                <input
                  type="tel"
                  value={form.contactPhone}
                  onChange={(e) => set("contactPhone", e.target.value)}
                  className={inputCls}
                  placeholder="+1 555 0100"
                  maxLength={32}
                />
              </Field>
              <Field label="Business address" className="md:col-span-2">
                <input
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  className={inputCls}
                  placeholder="123 Commerce Way, New York, NY"
                  maxLength={200}
                />
              </Field>
              <Field label="Footer tagline" className="md:col-span-2">
                <input
                  value={form.footerTagline}
                  onChange={(e) => set("footerTagline", e.target.value)}
                  className={inputCls}
                  placeholder="A short tagline that appears under your store name"
                  maxLength={200}
                />
              </Field>
            </div>
          </section>

          {/* ----- Social media links ----- */}
          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
            <header className="mb-4">
              <h2 className="text-base font-semibold">Social media</h2>
              <p className="mt-0.5 text-xs text-ink-500">
                Paste the full URL. Only populated networks render a footer
                icon; empty fields are hidden.
              </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Facebook">
                <input
                  type="url"
                  value={form.facebookUrl}
                  onChange={(e) => set("facebookUrl", e.target.value)}
                  className={inputCls}
                  placeholder="https://facebook.com/your-store"
                />
              </Field>
              <Field label="Instagram">
                <input
                  type="url"
                  value={form.instagramUrl}
                  onChange={(e) => set("instagramUrl", e.target.value)}
                  className={inputCls}
                  placeholder="https://instagram.com/your-store"
                />
              </Field>
              <Field label="Twitter / X">
                <input
                  type="url"
                  value={form.twitterUrl}
                  onChange={(e) => set("twitterUrl", e.target.value)}
                  className={inputCls}
                  placeholder="https://twitter.com/your-store"
                />
              </Field>
              <Field label="YouTube">
                <input
                  type="url"
                  value={form.youtubeUrl}
                  onChange={(e) => set("youtubeUrl", e.target.value)}
                  className={inputCls}
                  placeholder="https://youtube.com/@your-store"
                />
              </Field>
              <Field label="LinkedIn">
                <input
                  type="url"
                  value={form.linkedinUrl}
                  onChange={(e) => set("linkedinUrl", e.target.value)}
                  className={inputCls}
                  placeholder="https://linkedin.com/company/your-store"
                />
              </Field>
              <Field label="TikTok">
                <input
                  type="url"
                  value={form.tiktokUrl}
                  onChange={(e) => set("tiktokUrl", e.target.value)}
                  className={inputCls}
                  placeholder="https://tiktok.com/@your-store"
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
            <h2 className="mb-4 text-base font-semibold">Interface language</h2>
            <div className="grid grid-cols-3 gap-2">
              {LOCALES.map((l) => (
                <button
                  type="button"
                  key={l}
                  onClick={() => setLocale(l as Locale)}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-medium transition",
                    l === locale
                      ? "border-ink-900 bg-ink-900 text-white"
                      : "border-ink-200 bg-white text-ink-700 hover:border-ink-300"
                  )}
                >
                  {LOCALE_LABELS[l as Locale]}
                </button>
              ))}
            </div>
          </section>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            {saved && (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
                <Icon name="CheckCircle2" size={14} />
                Saved — live on the storefront
              </span>
            )}
            <button
              type="submit"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink-900 px-5 text-sm font-medium text-white hover:bg-ink-800"
            >
              <Icon name="Save" size={16} />
              Save changes
            </button>
          </div>
        </form>
      </div>
    </AdminShell>
  );
}

const inputCls =
  "h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm focus:border-ink-900 focus:outline-none";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-ink-600">{label}</span>
      {children}
    </label>
  );
}
