import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nova — Modern Commerce",
  description:
    "Nova is a minimalist, multilingual e-commerce experience built with Next.js and Tailwind.",
  icons: [{ rel: "icon", url: "/favicon.svg" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className="min-h-dvh bg-ink-50 text-ink-900">{children}</body>
    </html>
  );
}
