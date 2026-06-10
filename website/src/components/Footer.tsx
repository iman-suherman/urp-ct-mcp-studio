import Link from "next/link";

const GITHUB_REPO = "https://github.com/iman-suherman/urp-ct-mcp-studio";

export function Footer() {
  return (
    <footer className="border-t border-slate-200/80 bg-white/70">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <p className="max-w-3xl text-sm leading-6 text-slate-500">
          This site and its plugins are independent open-source projects. They are not affiliated
          with, endorsed by, or operated by commercetools as a business. Source code is available
          on{" "}
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-purple hover:underline"
          >
            GitHub
          </a>
          .
        </p>

        <div className="mt-4 flex flex-col gap-4 border-t border-slate-200/80 pt-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Suherman. Built for commercetools Commerce MCP.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/install" className="hover:text-brand-purple">
              Install guide
            </Link>
            <Link href="/#download" className="hover:text-brand-purple">
              Download
            </Link>
            <a href={GITHUB_REPO} target="_blank" rel="noreferrer" className="hover:text-brand-purple">
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
      </div>
    </footer>
  );
}
