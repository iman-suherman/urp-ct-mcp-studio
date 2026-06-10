import Image from "next/image";
import { BRAND_NAME } from "@/lib/brand";

const highlights = [
  {
    title: "Browse Tools Dynamically",
    description: "Discover all available MCP tools from your connected server.",
    icon: "🧩",
    tint: "bg-brand-purple/10 text-brand-purple",
  },
  {
    title: "Run in Playground",
    description: "Fill parameters, execute calls, and get structured responses.",
    icon: "⌨️",
    tint: "bg-brand-teal/10 text-brand-teal",
  },
  {
    title: "Use in VS Code Chat",
    description: "Generate prompts and copy directly to your chat.",
    icon: "💬",
    tint: "bg-brand-yellow/10 text-amber-600",
  },
  {
    title: "Sync Natively",
    description: "One click to sync MCP server to VS Code Chat configuration.",
    icon: "🔄",
    tint: "bg-brand-purple/10 text-brand-purple",
  },
];

const syncSteps = [
  {
    title: "Connect",
    description: `Connect your commercetools project with ${BRAND_NAME}.`,
  },
  {
    title: "Sync",
    description: `${BRAND_NAME} adds the server to your Chat config.`,
  },
  {
    title: "Chat Ready",
    description: "Start using MCP tools directly in Chat.",
  },
];

const footerHighlights = [
  { title: "Faster Workflows", description: "Run calls and build prompts quickly.", icon: "🚀" },
  { title: "Less Context Switching", description: "Everything inside your IDE.", icon: "⟨⟩" },
  { title: "Smarter Prompts", description: "Auto-generate prompts for any tool.", icon: "⚡" },
  { title: "Built for Developers", description: "Open, extensible, and community driven.", icon: "👥" },
];

export function DeveloperFriendly() {
  return (
    <section id="developer" className="mx-auto max-w-7xl px-6 py-20">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-purple">
            Developer Friendly
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">
            Browse tools dynamically, run MCP calls in a playground, and sync native VS Code Chat config.
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
          <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand-purple/20 via-brand-yellow/10 to-transparent blur-2xl" />
          <div className="card relative overflow-hidden p-3 shadow-card">
            <Image
              src="/developer-friendly.png"
              alt={`${BRAND_NAME} Tools Explorer playground with VS Code Chat sync workflow`}
              width={1200}
              height={900}
              className="h-auto w-full rounded-xl"
            />
          </div>
        </div>
      </div>

      <div className="mt-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-purple">
          Sync to VS Code Chat
        </p>
        <p className="mt-2 max-w-2xl text-slate-600">
          Automatically add and manage your MCP server in VS Code Chat configuration.
        </p>

        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {syncSteps.map((step, index) => (
            <li key={step.title} className="card p-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-purple/10 text-sm font-bold text-brand-purple">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {footerHighlights.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-brand-purple/10 bg-white/80 px-5 py-4 shadow-soft"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span aria-hidden>{item.icon}</span>
              {item.title}
            </p>
            <p className="mt-1 text-sm text-slate-600">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
