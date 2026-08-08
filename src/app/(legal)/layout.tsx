import Link from "next/link";

import { siteConfig } from "@/lib/site-config";

const legalLinks = [
  {
    href: "/privacy",
    label: "Privacy Policy",
  },
  {
    href: "/terms",
    label: "Terms & Conditions",
  },
  {
    href: "/shipping-policy",
    label: "Shipping Policy",
  },
  {
    href: "/refund-policy",
    label: "Refund & Return Policy",
  },
  {
    href: "/data-deletion",
    label: "Data Deletion",
  },
  {
    href: "/contact",
    label: "Contact",
  },
];

export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-slate-950"
          >
            {siteConfig.name}
          </Link>

          <Link
            href="/"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Back to shop
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Legal & Support
              </p>

              <nav
                aria-label="Legal and support pages"
                className="flex flex-col gap-1"
              >
                {legalLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 lg:p-10">
              {children}
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-5">
            <div>
              <p className="font-semibold text-slate-950">
                {siteConfig.name}
              </p>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                {siteConfig.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-slate-600 transition hover:text-slate-950"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} {siteConfig.name}. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}