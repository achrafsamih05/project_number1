"use client";

import Link from "next/link";
import { Icon, ICONS } from "../ui/Icon";
import { useSettings } from "@/lib/client/hooks";
import { useI18n } from "@/lib/useI18n";
import type { Settings } from "@/lib/types";

// ---------------------------------------------------------------------------
// Storefront Footer
//
// Pulls every visible value live from `useSettings()`, which is backed by
// GET /api/settings + the shared SSE client (`useRealtime(["settings"])`).
// That means: as soon as an admin hits "Save" on /admin/settings, every
// open storefront tab re-fetches and the footer updates without a reload.
//
// Rendering rules:
//   - A section/link is OMITTED when its value is empty (the admin treats
//     blank fields as "hide me"). This keeps the footer tidy on projects
//     that haven't filled every field yet.
//   - Social links always use target="_blank" rel="noopener noreferrer"
//     for safety and SEO hygiene.
//   - The footer itself is `print:hidden` so it doesn't leak into the
//     dedicated invoice print view (that page has its own footer).
//   - `pb-20 md:pb-0` keeps the mobile BottomNav from covering the
//     copyright line on phones (the bottom nav is 64px tall + safe area).
// ---------------------------------------------------------------------------

interface SocialLink {
  href: string;
  icon: keyof typeof ICONS;
  label: string;
}

/**
 * Pick the subset of social links the admin has actually configured. Order
 * matches the order in the admin form so operators get a predictable
 * left-to-right layout.
 */
function socialLinks(s: Settings): SocialLink[] {
  const entries: Array<[string, keyof typeof ICONS, string]> = [
    [s.facebookUrl, "Facebook", "Facebook"],
    [s.instagramUrl, "Instagram", "Instagram"],
    [s.twitterUrl, "Twitter", "Twitter / X"],
    [s.youtubeUrl, "Youtube", "YouTube"],
    [s.linkedinUrl, "Linkedin", "LinkedIn"],
    // TikTok doesn't have a dedicated lucide icon; Music2 is the chosen
    // stand-in and matches the convention on most admin UIs.
    [s.tiktokUrl, "Music2", "TikTok"],
  ];
  return entries
    .filter(([href]) => href && href.trim().length > 0)
    .map(([href, icon, label]) => ({ href, icon, label }));
}

export function Footer() {
  const { t } = useI18n();
  const settings = useSettings();

  // While the first GET is in flight we render a minimal fallback so the
  // page layout doesn't shift when the data arrives.
  const s: Settings = settings ?? {
    storeName: "Nova",
    currency: "USD",
    taxRate: 10,
    lowStockThreshold: 20,
    contactEmail: "",
    contactPhone: "",
    address: "",
    footerTagline: "",
    facebookUrl: "",
    instagramUrl: "",
    twitterUrl: "",
    youtubeUrl: "",
    linkedinUrl: "",
    tiktokUrl: "",
  };

  const socials = socialLinks(s);
  const year = new Date().getFullYear();
  const hasContact = Boolean(s.contactEmail || s.contactPhone || s.address);

  return (
    <footer className="mt-16 border-t border-ink-100 bg-white pb-20 print:hidden md:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr] md:gap-12">
          {/* Column 1: brand + tagline */}
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-900 text-base font-bold text-white">
                {s.storeName.trim().charAt(0).toUpperCase() || "N"}
              </span>
              <span className="text-lg font-semibold tracking-tight">
                {s.storeName}
              </span>
            </Link>
            {s.footerTagline && (
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500">
                {s.footerTagline}
              </p>
            )}

            {socials.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {t("footer.follow")}
                </div>
                <ul className="flex flex-wrap gap-2">
                  {socials.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={link.label}
                        title={link.label}
                        className="grid h-10 w-10 place-items-center rounded-xl border border-ink-200 bg-white text-ink-600 transition hover:border-ink-900 hover:text-ink-900"
                      >
                        <Icon name={link.icon} size={18} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Column 2: site links */}
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
              {t("footer.shop")}
            </div>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-ink-700 hover:text-ink-900">
                  {t("nav.home")}
                </Link>
              </li>
              <li>
                <Link
                  href="/categories"
                  className="text-ink-700 hover:text-ink-900"
                >
                  {t("nav.categories")}
                </Link>
              </li>
              <li>
                <Link href="/cart" className="text-ink-700 hover:text-ink-900">
                  {t("nav.cart")}
                </Link>
              </li>
              <li>
                <Link href="/track" className="text-ink-700 hover:text-ink-900">
                  Track order
                </Link>
              </li>
              <li>
                <Link
                  href="/account"
                  className="text-ink-700 hover:text-ink-900"
                >
                  {t("nav.account")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: contact info (email / phone / address) */}
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
              {t("footer.contact")}
            </div>
            {hasContact ? (
              <ul className="space-y-3 text-sm text-ink-700">
                {s.contactEmail && (
                  <li>
                    <a
                      href={`mailto:${s.contactEmail}`}
                      className="inline-flex items-start gap-2 hover:text-ink-900"
                    >
                      <Icon
                        name="Mail"
                        size={16}
                        className="mt-0.5 flex-none text-ink-500"
                      />
                      <span className="break-all">{s.contactEmail}</span>
                    </a>
                  </li>
                )}
                {s.contactPhone && (
                  <li>
                    <a
                      href={`tel:${s.contactPhone.replace(/\s+/g, "")}`}
                      className="inline-flex items-start gap-2 hover:text-ink-900"
                    >
                      <Icon
                        name="Phone"
                        size={16}
                        className="mt-0.5 flex-none text-ink-500"
                      />
                      <span>{s.contactPhone}</span>
                    </a>
                  </li>
                )}
                {s.address && (
                  <li className="inline-flex items-start gap-2">
                    <Icon
                      name="MapPin"
                      size={16}
                      className="mt-0.5 flex-none text-ink-500"
                    />
                    <span>{s.address}</span>
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-ink-400">—</p>
            )}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-ink-100 pt-6 text-xs text-ink-500 sm:flex-row sm:items-center">
          <span>
            © {year} {s.storeName}. {t("footer.rights")}
          </span>
          <span className="opacity-70">{s.currency}</span>
        </div>
      </div>
    </footer>
  );
}
