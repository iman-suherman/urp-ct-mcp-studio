import Image from "next/image";
import Link from "next/link";

const nav = [
  { href: "#home", label: "Home" },
  { href: "#download", label: "Download" },
  { href: "#versions", label: "Versions" },
  { href: "#features", label: "Features" },
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
          <Image src="/logo.png" alt="CT MCP" width={40} height={40} priority />
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-slate-900">CT MCP</span>
            <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-xs font-medium text-brand-purple">
              Plugins
            </span>
          </div>
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
              <a key={item.href} href={item.href} className="transition hover:text-brand-purple">
                {item.label}
              </a>
            )
          )}
        </nav>

        <a href="#download" className="btn-primary hidden sm:inline-flex">
          Get Started
        </a>
      </div>
    </header>
  );
}
