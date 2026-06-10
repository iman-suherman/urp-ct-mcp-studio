import Link from "next/link";
import { LocalReleaseDate } from "@/components/LocalReleaseDate";
import {
  fetchLatestVersion,
  publishedAtToIso,
  toPublicDownloadUrl,
} from "@/lib/registry";

const steps = [
  {
    title: "Download the VSIX",
    description:
      "Get the latest Commerce MCP Studio package, or pick a specific version from the release history page.",
    detail: "Save the `.vsix` file somewhere easy to find, such as your Downloads folder.",
  },
  {
    title: "Open VS Code",
    description: "Launch Visual Studio Code 1.90 or later on your computer.",
    detail: "Node.js should be installed and available on your PATH so the MCP server can run locally.",
  },
  {
    title: "Open the Extensions view",
    description: "In VS Code, open Extensions from the Activity Bar or use the keyboard shortcut.",
    detail: "macOS: ⌘⇧X · Windows / Linux: Ctrl+Shift+X",
  },
  {
    title: "Install from VSIX",
    description:
      "Click the ⋯ menu at the top of the Extensions panel, then choose Install from VSIX…",
    detail: "Select the `.vsix` file you downloaded in step 1.",
  },
  {
    title: "Open Commerce MCP",
    description:
      "After installation, click the Commerce MCP icon in the Activity Bar to open the extension panel.",
    detail: "If prompted, reload VS Code to finish activating the extension.",
  },
  {
    title: "Connect your project",
    description:
      "Use the connect flow in the extension to add your commercetools project credentials.",
    detail:
      "Credentials are stored in VS Code Secret Storage and are never written to disk.",
  },
];

export async function InstallGuide() {
  const latest = await fetchLatestVersion();
  const downloadUrl = latest
    ? toPublicDownloadUrl(latest)
    : "https://storage.googleapis.com/personal-suherman-ct-mcp-studio/extensions/latest.vsix";
  const versionLabel = latest?.version ?? "0.1.0";
  const releasedAtIso = publishedAtToIso(latest?.publishedAt);

  return (
    <article className="mx-auto max-w-3xl px-6 py-10 lg:py-14">
      <Link href="/" className="text-sm font-medium text-brand-purple hover:underline">
        ← Back to home
      </Link>

      <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-brand-purple">
        Installation guide
      </p>
      <h1 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">
        Install Commerce MCP Studio in VS Code
      </h1>
      <p className="mt-4 text-base leading-7 text-slate-600">
        Follow these steps to download the VSIX, install the extension, and connect your
        commercetools project.
      </p>

      <div className="mt-8 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-4">
          <a href={downloadUrl} className="btn-primary">
            Download v{versionLabel}
          </a>
          <Link href="/#versions" className="btn-secondary">
            Browse all versions
          </Link>
        </div>
        {releasedAtIso && (
          <LocalReleaseDate iso={releasedAtIso} className="text-sm text-slate-500" />
        )}
      </div>

      <ol className="mt-10 space-y-5">
        {steps.map((step, index) => (
          <li key={step.title} className="card p-6">
            <div className="flex gap-4">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-purple/10 text-sm font-bold text-brand-purple">
                {index + 1}
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                <p className="mt-2 text-sm text-slate-500">{step.detail}</p>
                {index === 0 && (
                  <a href={downloadUrl} className="mt-4 inline-flex text-sm font-semibold text-brand-purple hover:underline">
                    Download v{versionLabel} →
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="card mt-8 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Need help?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          See the{" "}
          <a
            href="https://docs.commercetools.com/dev-tooling/mcp/commerce-mcp"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-purple hover:underline"
          >
            Commerce MCP documentation
          </a>{" "}
          or open an issue on{" "}
          <a
            href="https://github.com/iman-suherman/urp-ct-mcp-studio"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-purple hover:underline"
          >
            GitHub
          </a>
          .
        </p>
      </div>
    </article>
  );
}
