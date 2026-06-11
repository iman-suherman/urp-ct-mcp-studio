import Link from "next/link";
import { LocalReleaseDate } from "@/components/LocalReleaseDate";
import {
  fetchLatestVersion,
  flattenReleaseNotes,
  formatBytes,
  publishedAtToIso,
  DOWNLOAD_BASE_URL,
  toPublicDownloadUrl,
} from "@/lib/registry";

export async function Hero() {
  const latest = await fetchLatestVersion();
  const downloadUrl = latest
    ? toPublicDownloadUrl(latest)
    : `${DOWNLOAD_BASE_URL.replace(/\/$/, "")}/latest.vsix`;
  const versionLabel = latest?.version ?? "0.1.0";
  const releasedAtIso = publishedAtToIso(latest?.publishedAt);
  const highlights = flattenReleaseNotes(latest?.releaseNotes).slice(0, 3);

  return (
    <section id="home" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:py-20">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-10">
        <div>
          <span className="inline-flex rounded-full bg-brand-purple/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-purple sm:px-4 sm:py-1.5 sm:text-sm">
            Commerce MCP extension for VS Code
          </span>
          <h1 className="mt-4 max-w-4xl text-balance text-3xl font-bold leading-[1.15] tracking-tight text-slate-900 sm:mt-6 sm:text-4xl md:text-5xl lg:text-[3.25rem] xl:text-6xl">
            Connect, explore, and run{" "}
            <span className="gradient-text">MCP tools from your editor.</span>
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:mt-6 sm:text-lg sm:leading-8 md:text-xl md:leading-9">
            Download the VSIX, connect your commercetools project, and browse Commerce MCP tools
            without leaving VS Code.
          </p>

          <div id="download" className="mt-6 flex flex-col gap-3 sm:mt-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-center sm:gap-2 lg:gap-3">
              <a
                href={downloadUrl}
                className="btn-primary w-full shrink-0 whitespace-nowrap px-5 py-3 text-sm sm:w-auto sm:px-6 sm:py-3 lg:px-5"
              >
                Download v{versionLabel}
              </a>
              <Link
                href="/versions"
                className="btn-secondary w-full shrink-0 whitespace-nowrap px-5 py-3 text-sm sm:w-auto sm:px-6 sm:py-3 lg:px-5"
              >
                View release history
              </Link>
              <Link
                href="/install"
                className="btn-secondary w-full shrink-0 whitespace-nowrap px-5 py-3 text-sm sm:w-auto sm:px-6 sm:py-3 lg:px-5"
              >
                Install in VS Code
              </Link>
            </div>
            {releasedAtIso && (
              <LocalReleaseDate iso={releasedAtIso} className="text-base text-slate-500" />
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 sm:mt-8 sm:gap-x-8 sm:text-base">
            <span>VSIX downloads</span>
            <span>Local stdio transport</span>
            <span>commercetools compatible</span>
          </div>
        </div>

        {latest && (
          <aside
            aria-label="Latest release"
            className="border-t border-slate-200/50 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0 xl:pl-12"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-purple/80">
              Latest release
            </p>
            <p className="mt-3 text-base font-semibold leading-snug text-slate-800 sm:text-lg">
              {latest.summary ?? `Commerce MCP Studio ${versionLabel}`}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {formatBytes(latest.sizeBytes)} · VSIX for VS Code 1.90+
            </p>
            {highlights.length > 0 && (
              <ul className="mt-5 space-y-2.5 text-sm leading-relaxed text-slate-600">
                {highlights.map((note) => (
                  <li key={note} className="flex gap-2">
                    <span aria-hidden className="shrink-0 text-slate-400">
                      •
                    </span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}
