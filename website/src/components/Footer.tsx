import Link from "next/link";

const GITHUB_REPO = "https://github.com/iman-suherman/urp-ct-mcp-studio";
const COMMERCE_MCP_DOCS =
  "https://docs.commercetools.com/dev-tooling/mcp/commerce-mcp";

export function Footer() {
  return (
    <footer className="border-t border-slate-200/80 bg-white/70">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        <p className="max-w-5xl text-sm leading-6 text-slate-500">
          This site and its plugins are independent open-source projects for use with{" "}
          <a
            href={COMMERCE_MCP_DOCS}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-purple hover:underline"
          >
            commercetools Commerce MCP
          </a>
          . They are not affiliated with, endorsed by, or operated by commercetools GmbH.
          commercetools, Commerce MCP, and related marks are trademarks of commercetools GmbH.
          Source code is available on{" "}
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
          <p>
            © {new Date().getFullYear()} Suherman. Unofficial tooling for commercetools Commerce
            MCP; commercetools® is a trademark of commercetools GmbH.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/install" className="hover:text-brand-purple">
              Install guide
            </Link>
            <Link href="/versions" className="hover:text-brand-purple">
              Versions
            </Link>
            <Link href="/versions" className="hover:text-brand-purple">
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
