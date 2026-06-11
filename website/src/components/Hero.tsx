"use client";

import Image from "next/image";
import Link from "next/link";
import { LocalReleaseDate } from "@/components/LocalReleaseDate";
import { BRAND_NAME } from "@/lib/brand";
import { useLatestVersion } from "@/hooks/useRegistry";
import {
  flattenReleaseNotes,
  formatBytes,
  publishedAtToIso,
  DOWNLOAD_BASE_URL,
  toPublicDownloadUrl,
} from "@/lib/registry";

const FALLBACK_DOWNLOAD_URL = `${DOWNLOAD_BASE_URL.replace(/\/$/, "")}/latest.vsix`;

export function Hero() {
  const { data: latest, loading } = useLatestVersion();
  const downloadUrl = latest ? toPublicDownloadUrl(latest) : FALLBACK_DOWNLOAD_URL;
  const versionLabel = latest?.version;
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
                {loading || !versionLabel ? "Download latest VSIX" : `Download v${versionLabel}`}
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

        <div className="relative overflow-hidden">
          <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-brand-purple/20 via-brand-teal/10 to-transparent blur-2xl md:-inset-6" />
          <div className="card relative overflow-hidden p-3 shadow-card">
            <Image
              src="/hero.png"
              alt={`${BRAND_NAME} — connect, explore, execute, and automate Commerce MCP tools in VS Code`}
              width={1024}
              height={682}
              priority
              className="h-auto w-full rounded-xl"
            />
          </div>
        </div>
      </div>

      {loading && (
        <aside
          aria-label="Latest release"
          aria-busy="true"
          className="mt-8 border-t border-slate-200/50 pt-8"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-purple/80">
            Latest release
          </p>
          <div className="mt-3 h-5 w-3/4 max-w-md animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-1/2 max-w-xs animate-pulse rounded bg-slate-100" />
        </aside>
      )}

      {!loading && latest && (
        <aside aria-label="Latest release" className="mt-8 border-t border-slate-200/50 pt-8">
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
    </section>
  );
}
