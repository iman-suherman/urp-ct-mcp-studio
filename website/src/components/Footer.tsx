import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-slate-200/80 bg-white/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} Suherman. Built for commercetools Commerce MCP.</p>
        <div className="flex flex-wrap gap-4">
          <Link href="#download" className="hover:text-brand-purple">
            Download
          </Link>
          <a
            href="https://github.com/iman-suherman/urp-ct-mcp-studio"
            target="_blank"
            rel="noreferrer"
            className="hover:text-brand-purple"
          >
            GitHub
          </a>
          <a
            href="https://ct-mcp-registry.suherman.net/health"
            target="_blank"
            rel="noreferrer"
            className="hover:text-brand-purple"
          >
            Registry API
          </a>
        </div>
      </div>
    </footer>
  );
}
