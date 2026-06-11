import Image from "next/image";
import Link from "next/link";
import { LocalReleaseDate } from "@/components/LocalReleaseDate";
import { BRAND_NAME } from "@/lib/brand";
import {
  fetchLatestVersion,
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
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <a
                href={downloadUrl}
                className="btn-primary w-full px-5 py-3 text-sm sm:w-auto sm:px-7 sm:py-3.5 sm:text-base"
              >
                Download v{versionLabel}
              </a>
              <Link
                href="/versions"
                className="btn-secondary w-full px-5 py-3 text-sm sm:w-auto sm:px-7 sm:py-3.5 sm:text-base"
              >
                View release history
              </Link>
              <Link
                href="/install"
                className="btn-secondary w-full px-5 py-3 text-sm sm:w-auto sm:px-7 sm:py-3.5 sm:text-base"
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

        <div id="extend" className="relative overflow-hidden">
          <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-brand-purple/20 via-brand-teal/10 to-transparent blur-2xl md:-inset-6" />
          <div className="card relative overflow-hidden p-3 shadow-card">
            <Image
              src="/extend-with-ease.png"
              alt={`${BRAND_NAME} — install VSIX packages, connect Commerce MCP, and explore tools from VS Code`}
              width={1024}
              height={682}
              className="h-auto w-full rounded-xl"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
