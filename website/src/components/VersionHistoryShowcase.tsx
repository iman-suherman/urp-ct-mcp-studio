import Image from "next/image";
import Link from "next/link";

const highlights = [
  {
    title: "Track Every Release",
    description: "See every update in one place, from the latest release back to the first.",
    icon: "🕐",
    tint: "bg-brand-purple/10 text-brand-purple",
  },
  {
    title: "Clear Release Notes",
    description: "Simple summaries explain what's new and what's improved.",
    icon: "📄",
    tint: "bg-brand-teal/10 text-brand-teal",
  },
  {
    title: "Download with Confidence",
    description: "Pick the version that fits your workflow and download it anytime.",
    icon: "⬇️",
    tint: "bg-brand-yellow/10 text-amber-600",
  },
];

export function VersionHistoryShowcase() {
  return (
    <section id="version-history" className="mx-auto max-w-7xl px-6 py-20">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div className="relative lg:order-1">
          <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand-blue/20 via-brand-teal/10 to-transparent blur-2xl" />
          <div className="card relative overflow-hidden p-3 shadow-card">
            <Image
              src="/version-history.png"
              alt="CT MCP Plugins version history timeline with release notes and download options"
              width={1200}
              height={900}
              className="h-auto w-full rounded-xl"
            />
          </div>
        </div>

        <div className="lg:order-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-blue">
            Version History
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">
            Every release is tracked with clear version notes and downloadable packages.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            See how our tools are evolving. Look back at every update, read what changed, and
            download the version that works best for you.
          </p>

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

          <p className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-purple/10 px-4 py-2 text-sm font-medium text-brand-purple">
            <span aria-hidden>🛡️</span>
            Reliable releases. Transparent updates. Always in control.
          </p>

          <p className="mt-6 text-sm text-slate-600">
            Need an older version?{" "}
            <Link href="#versions" className="font-semibold text-brand-purple hover:underline">
              All previous releases are available for download.
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
