import Image from "next/image";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

const nav = [
  { href: "/", label: "Home" },
  { href: "/install", label: "Install" },
  { href: "/#download", label: "Download" },
  { href: "/#versions", label: "Versions" },
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
  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/ct-mcp-logo.png"
            alt={BRAND_NAME}
            width={72}
            height={48}
            priority
            className="h-10 w-auto"
          />
          <span className="max-w-[11rem] text-sm font-bold leading-snug tracking-tight text-slate-900 sm:max-w-xs sm:text-base lg:max-w-md lg:text-lg">
            {BRAND_NAME}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
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

        <Link href="/install" className="btn-primary hidden sm:inline-flex">
          Get Started
        </Link>
      </div>
    </header>
  );
}
