"use client";

import { useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Icon } from "@/components/ui/Icon";
import { useMe, useUsers } from "@/lib/client/hooks";
import { apiSend } from "@/lib/client/api";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";

export default function UsersPage() {
  const { t, locale } = useI18n();
  const { data: users, loading, reload } = useUsers();
  const { data: me } = useMe();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.email, u.city, u.country].join(" ").toLowerCase().includes(q)
    );
  }, [users, query]);

  async function toggleBan(id: string, banned: boolean) {
    setBusy(id);
    try {
      await apiSend(`/api/users/${id}`, "PATCH", { banned: !banned });
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Permanently delete this account?")) return;
    setBusy(id);
    try {
      await apiSend(`/api/users/${id}`, "DELETE");
      await reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("admin.users")}
            </h1>
            <p className="text-sm text-ink-500">
              View, ban, or remove registered accounts. Bans take effect on next
              request.
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-ink-400">
              <Icon name="Search" size={16} />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, country…"
              className="h-11 w-full rounded-xl border border-ink-200 bg-white ps-10 pe-4 text-sm focus:border-ink-900 focus:outline-none"
            />
          </div>
        </header>

        {/* Mobile-only swipe hint. The faded edge + horizontal scrollbar
            on the table already signal swipe affordance, but a short
            one-liner removes any doubt for first-time admins. */}
        <p
          className="flex items-center gap-2 text-xs text-ink-500 lg:hidden"
          aria-hidden="true"
        >
          <Icon name="ArrowRight" size={14} />
          Swipe the table sideways to see every column.
        </p>

        {/*
         * Swipeable user table.
         *
         * Structure:
         *   .swipe-table-wrap  — holds the faded-edge overlay (pure CSS,
         *                        hidden at lg+ where the table no longer
         *                        needs to scroll). It is an unclipped
         *                        positioning parent so the gradient stays
         *                        anchored to the viewport edge.
         *   .swipe-table       — actual overflow-x: auto container with a
         *                        styled 6px scrollbar.
         *   table.min-w-[900px]
         *                      — forces the table to keep its natural
         *                        column widths on narrow viewports so
         *                        NO column gets squeezed off the screen.
         */}
        <div className="rounded-2xl border border-ink-100 bg-white shadow-soft">
          <div className="swipe-table-wrap overflow-hidden rounded-2xl">
            <div className="swipe-table" role="region" aria-label="Users table">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-ink-50 text-ink-600">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium">Name</th>
                    <th className="px-4 py-3 text-start font-medium">Email</th>
                    <th className="px-4 py-3 text-start font-medium">Role</th>
                    <th className="px-4 py-3 text-start font-medium">Location</th>
                    <th className="px-4 py-3 text-start font-medium">Joined</th>
                    <th className="px-4 py-3 text-start font-medium">Status</th>
                    <th className="px-4 py-3 text-end font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {loading && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-ink-400"
                      >
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-ink-400"
                      >
                        No users match.
                      </td>
                    </tr>
                  )}
                  {filtered.map((u) => {
                    const isMe = me?.id === u.id;
                    return (
                      <tr key={u.id} className="hover:bg-ink-50/50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-ink-900 text-xs font-semibold text-white">
                              {u.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="font-medium">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-600 whitespace-nowrap">
                          {u.email}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                              u.role === "admin"
                                ? "bg-brand-50 text-brand-700"
                                : "bg-ink-100 text-ink-700"
                            )}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-600 whitespace-nowrap">
                          {[u.city, u.country].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-ink-600 whitespace-nowrap">
                          {formatDate(u.createdAt, locale)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {u.banned ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                              <Icon name="Ban" size={12} /> banned
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              <Icon name="CheckCircle2" size={12} /> active
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-end whitespace-nowrap">
                          <div className="inline-flex gap-1">
                            <button
                              disabled={isMe || busy === u.id}
                              onClick={() => toggleBan(u.id, u.banned)}
                              className={cn(
                                "grid h-8 w-8 place-items-center rounded-lg text-ink-600 disabled:opacity-40",
                                u.banned
                                  ? "hover:bg-emerald-50 hover:text-emerald-600"
                                  : "hover:bg-amber-50 hover:text-amber-600"
                              )}
                              title={u.banned ? "Unban" : "Ban"}
                            >
                              <Icon
                                name={u.banned ? "CheckCircle2" : "Ban"}
                                size={16}
                              />
                            </button>
                            <button
                              disabled={isMe || busy === u.id}
                              onClick={() => remove(u.id)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-ink-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                              title="Delete"
                            >
                              <Icon name="Trash2" size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
