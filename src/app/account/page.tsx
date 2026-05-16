"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StoreShell } from "@/components/storefront/StoreShell";
import { Icon } from "@/components/ui/Icon";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n";
import { apiSend } from "@/lib/client/api";
import { useMe } from "@/lib/client/hooks";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";
import type { Locale, PublicUser } from "@/lib/types";

export default function AccountPage() {
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const { data: me, loading, setData } = useMe();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading && !me) router.replace("/login?next=/account");
  }, [loading, me, router]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const patch = {
      name: f.get("name"),
      phone: f.get("phone"),
      address: f.get("address"),
      city: f.get("city"),
      postalCode: f.get("postalCode"),
      country: f.get("country"),
    };
    const updated = await apiSend<PublicUser>("/api/auth/me", "PATCH", patch);
    setData(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  if (!me) {
    return (
      <StoreShell>
        <div className="mx-auto max-w-xl py-16 text-center text-ink-500">
          Loading…
        </div>
      </StoreShell>
    );
  }

  return (
    <StoreShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-ink-900 text-2xl font-semibold text-white">
            {me.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("account.title")}
            </h1>
            <p className="text-sm text-ink-500">
              {t("account.signedInAs")}{" "}
              <span className="font-medium text-ink-700">{me.email}</span>
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="Truck" size={16} className="text-ink-500" />
            <h2 className="text-base font-semibold">{t("account.shipping")}</h2>
          </div>
          <form onSubmit={save} className="space-y-3">
            <F label={t("register.fullName")} name="name" defaultValue={me.name} required />
            <F label={t("register.phone")} name="phone" defaultValue={me.phone} />
            <F label={t("register.address")} name="address" defaultValue={me.address} />
            <div className="grid gap-3 sm:grid-cols-3">
              <F label={t("register.city")} name="city" defaultValue={me.city} />
              <F label={t("register.postalCode")} name="postalCode" defaultValue={me.postalCode} />
              <F label={t("register.country")} name="country" defaultValue={me.country} />
            </div>
            <div className="flex items-center justify-end gap-2">
              {saved && (
                <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
                  <Icon name="CheckCircle2" size={14} />
                  {t("account.saved")}
                </span>
              )}
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink-900 px-4 text-sm font-medium text-white hover:bg-ink-800"
              >
                <Icon name="Save" size={14} />
                {t("account.save")}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <Icon name="Settings" size={16} className="text-ink-500" />
            <h2 className="text-base font-semibold">{t("account.prefs")}</h2>
          </div>
          <label className="text-sm text-ink-600">{t("account.language")}</label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {LOCALES.map((l) => (
              <button
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
      </div>
    </StoreShell>
  );
}

function F({
  label,
  ...rest
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-700">{label}</span>
      <input
        {...rest}
        className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm focus:border-ink-900 focus:outline-none"
      />
    </label>
  );
}
