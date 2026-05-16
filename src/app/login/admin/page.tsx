"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Icon } from "@/components/ui/Icon";
import { apiSend } from "@/lib/client/api";
import { useI18n } from "@/lib/useI18n";
import type { PublicUser } from "@/lib/types";

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/admin";
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    setSubmitting(true);
    try {
      await apiSend<PublicUser>("/api/auth/login", "POST", {
        email: data.get("email"),
        password: data.get("password"),
        intent: "admin",
      });
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={t("auth.admin.title")}
      subtitle={t("auth.admin.subtitle")}
      accent="dark"
      footer={
        <>
          Not an admin?{" "}
          <Link href="/login" className="font-medium text-ink-900 underline-offset-4 hover:underline">
            Customer sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-3 py-1 text-xs font-medium text-white">
          <Icon name="ShieldCheck" size={14} />
          Restricted area
        </div>
        <Field icon="Mail" label={t("auth.email")} name="email" type="email" required />
        <Field icon="Lock" label={t("auth.password")} name="password" type="password" required />
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-ink-900 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-60"
        >
          <Icon name="ShieldCheck" size={16} className="me-2" />
          {submitting ? "…" : `${t("auth.signIn")} as admin`}
        </button>
      </form>
    </AuthLayout>
  );
}

function Field({
  icon,
  label,
  ...rest
}: {
  icon: "Mail" | "Lock";
  label: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-700">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-ink-400">
          <Icon name={icon} size={16} />
        </span>
        <input
          {...rest}
          className="h-12 w-full rounded-xl border border-ink-200 bg-white ps-10 pe-3 text-sm focus:border-ink-900 focus:outline-none"
        />
      </div>
    </label>
  );
}
