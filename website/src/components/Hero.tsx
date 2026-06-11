import Link from "next/link";
import { LocalReleaseDate } from "@/components/LocalReleaseDate";
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
    <section id="home" className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
      <span className="inline-flex rounded-full bg-brand-purple/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-brand-purple">
        Commerce MCP extension for VS Code
      </span>
      <h1 className="mt-6 max-w-4xl text-5xl font-bold leading-[1.1] tracking-tight text-slate-900 md:text-6xl lg:max-w-none lg:whitespace-nowrap lg:text-[3.25rem] xl:text-7xl">
        Connect, explore, and run{" "}
        <span className="gradient-text">MCP tools from your editor.</span>
      </h1>
      <p className="mt-6 max-w-3xl text-xl leading-8 text-slate-600 md:text-2xl md:leading-9">
        Download the VSIX, connect your commercetools project, and browse Commerce MCP tools
        without leaving VS Code.
      </p>

      <div id="download" className="mt-10 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <a href={downloadUrl} className="btn-primary px-7 py-4 text-base">
            Download v{versionLabel}
          </a>
          <Link href="/versions" className="btn-secondary px-7 py-4 text-base">
            View release history
          </Link>
          <Link href="/install" className="btn-secondary px-7 py-4 text-base">
            Install in VS Code
          </Link>
        </div>
        {releasedAtIso && (
          <LocalReleaseDate iso={releasedAtIso} className="text-base text-slate-500" />
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-base text-slate-500">
        <span>VSIX downloads</span>
        <span>Local stdio transport</span>
        <span>commercetools compatible</span>
      </div>
    </section>
  );
}
