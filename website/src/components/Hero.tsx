import Link from "next/link";
import { LocalReleaseDate } from "@/components/LocalReleaseDate";
import {
  fetchLatestVersion,
  flattenReleaseNotes,
  formatBytes,
  publishedAtToIso,
  toPublicDownloadUrl,
} from "@/lib/registry";

export async function Hero() {
  const latest = await fetchLatestVersion();
  const downloadUrl = latest
    ? toPublicDownloadUrl(latest)
    : "https://storage.googleapis.com/personal-suherman-ct-mcp-studio/extensions/latest.vsix";
  const versionLabel = latest?.version ?? "0.1.0";
  const releasedAtIso = publishedAtToIso(latest?.publishedAt);
  const highlights = flattenReleaseNotes(latest?.releaseNotes).slice(0, 3);

  return (
    <section id="home" className="mx-auto max-w-7xl px-6 py-10 lg:py-14">
      <span className="inline-flex rounded-full bg-brand-purple/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-purple">
        Commerce MCP extension for VS Code
      </span>
      <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl">
        Connect, explore, and run{" "}
        <span className="gradient-text">MCP tools from your editor.</span>
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-7 text-slate-600">
        Download the VSIX, connect your commercetools project, and browse Commerce MCP tools
        without leaving VS Code.
      </p>

      <div id="download" className="mt-6 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-4">
          <a href={downloadUrl} className="btn-primary">
            Download v{versionLabel}
          </a>
          <Link href="#versions" className="btn-secondary">
            View release history
          </Link>
          <Link href="/install" className="btn-secondary">
            Install in VS Code
          </Link>
        </div>
        {releasedAtIso && (
          <LocalReleaseDate iso={releasedAtIso} className="text-sm text-slate-500" />
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
        <span>VSIX downloads</span>
        <span>Local stdio transport</span>
        <span>commercetools compatible</span>
      </div>

      {latest && (
        <div className="card mt-6 max-w-2xl p-5">
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
    </section>
  );
}
