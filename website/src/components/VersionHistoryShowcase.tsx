import Image from "next/image";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export function VersionHistoryShowcase() {
  return (
    <section id="version-history" className="mx-auto max-w-7xl px-6 py-12">
      <div className="relative">
        <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand-blue/20 via-brand-teal/10 to-transparent blur-2xl" />
        <div className="card relative overflow-hidden p-3 shadow-card">
          <Image
            src="/version-history.png"
            alt={`${BRAND_NAME} version history with release notes and downloadable VSIX packages`}
            width={1024}
            height={682}
            className="h-auto w-full rounded-xl"
          />
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <Link href="/versions" className="btn-primary">
          Browse all releases
        </Link>
      </div>
    </section>
  );
}
