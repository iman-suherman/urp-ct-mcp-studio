"use client";

import Link from "next/link";
import { useLatestVersion } from "@/hooks/useRegistry";
import { DOWNLOAD_BASE_URL, toPublicDownloadUrl } from "@/lib/registry";

const FALLBACK_DOWNLOAD_URL = `${DOWNLOAD_BASE_URL.replace(/\/$/, "")}/latest.vsix`;

export function CtaBanner() {
  const { data: latest } = useLatestVersion();
  const downloadUrl = latest ? toPublicDownloadUrl(latest) : FALLBACK_DOWNLOAD_URL;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 sm:pb-8">
      <div className="rounded-2xl bg-gradient-to-r from-brand-purple to-brand-violet px-5 py-6 text-white shadow-card sm:rounded-[2rem] sm:px-8 sm:py-8 md:px-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold sm:text-2xl md:text-3xl">
              Ready to supercharge your Commerce MCP experience?
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-indigo-100 md:text-base">
              Download Commerce MCP Studio, connect your commercetools project, and explore MCP
              tools from a single VS Code extension.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
            <a href={downloadUrl} className="btn-cta-primary">
              {latest ? `Download v${latest.version}` : "Download latest VSIX"}
            </a>
            <Link href="/versions" className="btn-cta-secondary">
              Browse versions
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
