import Image from "next/image";
import Link from "next/link";
import {
  fetchLatestVersion,
  flattenReleaseNotes,
  formatBytes,
  toPublicDownloadUrl,
} from "@/lib/registry";

export async function Hero() {
  const latest = await fetchLatestVersion();
  const downloadUrl = latest
    ? toPublicDownloadUrl(latest)
    : "https://storage.googleapis.com/personal-suherman-ct-mcp-studio/extensions/latest.vsix";
  const versionLabel = latest?.version ?? "0.1.0";
  const highlights = flattenReleaseNotes(latest?.releaseNotes).slice(0, 3);

  return (
    <section id="home" className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
      <div>
        <span className="inline-flex rounded-full bg-brand-purple/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-purple">
          The Home for Commerce MCP Extensions
        </span>
        <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl">
          Extend. Connect. <span className="gradient-text">Accelerate with CT MCP.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
          Discover, install, and manage extensions for Commerce MCP. Supercharge your AI agents
          and developer workflows with powerful plugins built for commercetools.
        </p>

        <div id="download" className="mt-8 flex flex-wrap gap-4">
          <a href={downloadUrl} className="btn-primary">
            Download v{versionLabel}
          </a>
          <Link href="#versions" className="btn-secondary">
            View release history
          </Link>
        </div>

        <div className="mt-8 grid gap-3 text-sm text-slate-500 sm:grid-cols-3">
          <span>Trusted by developers</span>
          <span>Security first</span>
          <span>Built for commercetools</span>
        </div>

        {latest && (
          <div className="card mt-8 p-5">
            <p className="text-sm font-semibold text-slate-900">Latest release</p>
            <p className="mt-1 text-sm text-slate-600">{latest.summary ?? `Commerce MCP Studio ${versionLabel}`}</p>
            <p className="mt-2 text-xs text-slate-500">
              {formatBytes(latest.sizeBytes)} · VSIX for VS Code 1.90+
            </p>
            {highlights.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {highlights.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand-purple/20 via-brand-blue/10 to-transparent blur-2xl" />
        <div className="card relative overflow-hidden p-3 shadow-card">
          <Image
            src="/logo-hero.png"
            alt="CT MCP landing preview"
            width={1200}
            height={900}
            className="h-auto w-full rounded-xl"
            priority
          />
        </div>
      </div>
    </section>
  );
}
