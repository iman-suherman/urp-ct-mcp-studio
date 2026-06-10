import Image from "next/image";
import { BRAND_NAME } from "@/lib/brand";

const highlights = [
  {
    title: "Install",
    description: `Add ${BRAND_NAME} instantly via VSIX.`,
    icon: "🧩",
    tint: "bg-brand-purple/10 text-brand-purple",
  },
  {
    title: "Connect",
    description: "Securely connect to your commercetools projects.",
    icon: "🛡️",
    tint: "bg-brand-teal/10 text-brand-teal",
  },
  {
    title: "Accelerate",
    description: "Explore tools, run commands, and supercharge your workflows.",
    icon: "⚡",
    tint: "bg-brand-yellow/10 text-amber-600",
  },
];

export function ExtendWithEase() {
  return (
    <section id="extend" className="mx-auto max-w-7xl px-6 py-20">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-purple">
            Extend with Ease
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">
            Install VSIX packages and connect Commerce MCP to your commercetools projects in minutes.
          </h2>

          <ul className="mt-10 space-y-6">
            {highlights.map((item) => (
              <li key={item.title} className="flex gap-4">
                <div
                  className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${item.tint}`}
                >
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand-purple/20 via-brand-teal/10 to-transparent blur-2xl" />
          <div className="card relative overflow-hidden p-3 shadow-card">
            <Image
              src="/extend-with-ease.png"
              alt={`${BRAND_NAME} Tools Explorer with commercetools connection dialog`}
              width={1200}
              height={900}
              className="h-auto w-full rounded-xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
