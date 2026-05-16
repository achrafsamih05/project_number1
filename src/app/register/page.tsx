"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Icon } from "@/components/ui/Icon";
import { apiSend } from "@/lib/client/api";
import { useI18n } from "@/lib/useI18n";
import type { PublicUser } from "@/lib/types";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    setSubmitting(true);
    try {
      await apiSend<PublicUser>("/api/auth/register", "POST", {
        email: f.get("email"),
        password: f.get("password"),
        name: f.get("name"),
        phone: f.get("phone"),
        address: f.get("address"),
        city: f.get("city"),
        postalCode: f.get("postalCode"),
        country: f.get("country"),
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={t("register.title")}
      subtitle={t("register.subtitle")}
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className="font-medium text-ink-900 underline-offset-4 hover:underline">
            {t("auth.signIn")}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <Text label={t("register.fullName")} name="name" required />
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label={t("auth.email")} name="email" type="email" required />
          <Text label={t("auth.password")} name="password" type="password" required minLength={8} />
        </div>
        <Text label={t("register.phone")} name="phone" type="tel" />
        <Text label={t("register.address")} name="address" required />
        <div className="grid gap-3 sm:grid-cols-3">
          <Text label={t("register.city")} name="city" />
          <Text label={t("register.postalCode")} name="postalCode" />
          <Text label={t("register.country")} name="country" />
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-ink-900 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-60"
        >
          <Icon name="LogIn" size={16} className="me-2" />
          {submitting ? "…" : t("auth.register")}
        </button>
      </form>
    </AuthLayout>
  );
}

function Text({
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
