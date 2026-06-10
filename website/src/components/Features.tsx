const features = [
  {
    title: "Developer Friendly",
    description: "Browse tools dynamically, run MCP calls in a playground, and sync native VS Code Chat config.",
    icon: "⚡",
    tint: "bg-brand-yellow/10 text-amber-600",
  },
  {
    title: "Version History",
    description: "Every release is tracked in Firestore with semver notes and downloadable artifacts in GCS.",
    icon: "📦",
    tint: "bg-brand-blue/10 text-brand-blue",
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-20">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-purple">
          Why CT MCP Plugins?
        </p>
        <h2 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">
          Build more. Do more. Ship faster.
        </h2>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {features.map((feature) => (
          <article key={feature.title} className="card p-6">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl text-xl ${feature.tint}`}>
              {feature.icon}
            </div>
            <h3 className="mt-5 text-lg font-semibold text-slate-900">{feature.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
