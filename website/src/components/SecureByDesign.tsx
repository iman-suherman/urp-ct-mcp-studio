import Image from "next/image";
import { BRAND_NAME } from "@/lib/brand";

const highlights = [
  {
    title: "Credentials are secure",
    description: "Stored in VS Code Secret Storage and never written to disk.",
    icon: "🛡️",
    tint: "bg-brand-teal/10 text-brand-teal",
  },
  {
    title: "Everything runs locally",
    description: "MCP server runs on your machine using stdio transport.",
    icon: "💻",
    tint: "bg-brand-purple/10 text-brand-purple",
  },
  {
    title: "You stay in control",
    description: "Your keys, your project. Your environment.",
    icon: "🔒",
    tint: "bg-brand-purple/10 text-brand-purple",
  },
];

const securityChecks = [
  "No credentials on disk",
  "Local execution only",
  "Encrypted storage",
  "You are in control",
];

export function SecureByDesign() {
  return (
    <section id="security" className="mx-auto max-w-7xl px-6 py-12">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
        <div className="relative lg:order-1">
          <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand-teal/20 via-brand-purple/10 to-transparent blur-2xl" />
          <div className="card relative overflow-hidden p-3 shadow-card">
            <Image
              src="/secure-by-design.png"
              alt={`${BRAND_NAME} connection details with VS Code Secret Storage and local stdio architecture`}
              width={1200}
              height={900}
              className="h-auto w-full rounded-xl"
            />
          </div>
        </div>

        <div className="lg:order-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-teal">
            Secure by Design
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">
            Credentials stay in VS Code Secret Storage while MCP servers run locally over stdio.
          </h2>

          <ul className="mt-6 space-y-4">
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

          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-teal/10 px-4 py-2 text-sm font-medium text-brand-teal">
            <span aria-hidden>🛡️</span>
            Built with security and privacy in mind.
          </p>

          <div className="mt-6 rounded-2xl border border-brand-teal/20 bg-brand-teal/5 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-brand-teal">
              <span aria-hidden>🛡️</span>
              Security First
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {securityChecks.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-brand-teal" aria-hidden>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
