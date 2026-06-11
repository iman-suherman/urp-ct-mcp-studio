import type { Metadata } from "next";
import Link from "next/link";
import { VersionHistory } from "@/components/VersionHistory";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Version History · ${BRAND_NAME}`,
  description:
    "Browse every Commerce MCP Studio release, read release notes, and download any VSIX version.",
};

export default function VersionsPage() {
  return (
    <>
      <div className="mx-auto max-w-7xl px-6 pt-10 lg:pt-14">
        <Link href="/" className="text-sm font-medium text-brand-purple hover:underline">
          ← Back to home
        </Link>
      </div>
      <VersionHistory />
    </>
  );
}
