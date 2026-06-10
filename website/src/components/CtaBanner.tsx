import Link from "next/link";
import { fetchLatestVersion, toPublicDownloadUrl } from "@/lib/registry";

export async function CtaBanner() {
  const latest = await fetchLatestVersion();
  const downloadUrl = latest
    ? toPublicDownloadUrl(latest)
    : "https://storage.googleapis.com/personal-suherman-ct-mcp-studio/extensions/latest.vsix";

  return (
    <section className="mx-auto max-w-7xl px-6 pb-20">
      <div className="rounded-[2rem] bg-gradient-to-r from-brand-purple to-brand-violet px-8 py-10 text-white shadow-card md:px-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">
              Ready to supercharge your Commerce MCP experience?
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-indigo-100 md:text-base">
              Download Commerce MCP Studio, connect your commercetools project, and explore MCP
              tools from a single VS Code extension.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
            <a href={downloadUrl} className="btn-cta-primary">
              Download latest VSIX
            </a>
            <Link href="#versions" className="btn-cta-secondary">
              Browse versions
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
