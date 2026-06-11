"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BRAND_NAME } from "@/lib/brand";

const nav = [
  { href: "/", label: "Home" },
  { href: "/install", label: "Install" },
  { href: "/versions", label: "Download" },
  { href: "/versions", label: "Versions" },
  { href: "/#extend", label: "Features" },
  {
    href: "https://docs.commercetools.com/dev-tooling/mcp/commerce-mcp",
    label: "Documentation",
    external: true,
  },
  {
    href: "https://github.com/iman-suherman/urp-ct-mcp-studio",
    label: "GitHub",
    external: true,
  },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Image
            src="/ct-mcp-logo.png"
            alt={BRAND_NAME}
            width={96}
            height={64}
            priority
            className="h-10 w-auto shrink-0 sm:h-14"
          />
          <span className="hidden truncate text-sm font-bold leading-snug tracking-tight text-slate-900 min-[420px]:block sm:max-w-xs sm:text-base lg:max-w-md lg:text-lg">
            {BRAND_NAME}
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex lg:gap-8">
          {nav.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-brand-purple"
              >
                {item.label}
              </a>
            ) : (
              <Link key={item.href} href={item.href} className="transition hover:text-brand-purple">
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link href="/install" className="btn-primary hidden md:inline-flex">
            Get Started
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-brand-purple/30 hover:text-brand-purple md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                <path
                  fill="currentColor"
                  d="M6.225 4.811a1 1 0 0 1 1.414 0L12 10.586l4.425-4.775a1 1 0 1 1 1.414 1.414L13.414 12l4.425 4.775a1 1 0 0 1-1.414 1.414L12 13.414l-4.425 4.775a1 1 0 0 1-1.414-1.414L10.586 12 6.225 7.225a1 1 0 0 1 0-1.414Z"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                <path
                  fill="currentColor"
                  d="M4 6a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          className="border-t border-slate-200/80 bg-white px-4 py-4 shadow-soft md:hidden"
        >
          <ul className="space-y-1">
            {nav.map((item) => (
              <li key={item.href}>
                {item.external ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-brand-purple/5 hover:text-brand-purple"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-brand-purple/5 hover:text-brand-purple"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <Link
            href="/install"
            className="btn-primary mt-4 w-full"
            onClick={() => setMenuOpen(false)}
          >
            Get Started
          </Link>
        </nav>
      )}
    </header>
  );
}
