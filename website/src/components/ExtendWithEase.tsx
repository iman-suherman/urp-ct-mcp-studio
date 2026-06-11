import Image from "next/image";
import { BRAND_NAME } from "@/lib/brand";

export function ExtendWithEase() {
  return (
    <section id="extend" className="mx-auto max-w-7xl px-6 py-12">
      <div className="relative">
        <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand-purple/20 via-brand-teal/10 to-transparent blur-2xl" />
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
    </section>
  );
}
