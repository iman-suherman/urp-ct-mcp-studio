import {
  fetchAllVersions,
  flattenReleaseNotes,
  formatBytes,
  formatDate,
  toPublicDownloadUrl,
} from "@/lib/registry";

export async function VersionHistory() {
  const versions = await fetchAllVersions();

  return (
    <section id="versions" className="mx-auto max-w-7xl px-6 py-20">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-purple">
          All releases
        </p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">Download any version</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Browse past releases, read what changed, and grab the build you need.
        </p>
      </div>

      {versions.length === 0 ? (
        <div className="card mt-8 p-8 text-center text-slate-600">
          No releases are available yet. Check back soon for the first download.
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {versions.map((version, index) => {
            const notes = flattenReleaseNotes(version.releaseNotes).slice(0, 4);
            return (
              <article key={version.version} className="card p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold text-slate-900">v{version.version}</h3>
                      {index === 0 && (
                        <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-xs font-semibold text-brand-purple">
                          Latest
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {version.summary ?? "CT MCP Plugins release"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Released {formatDate(version.publishedAt)} · {formatBytes(version.sizeBytes)}
                    </p>
                    {notes.length > 0 && (
                      <ul className="mt-4 space-y-1 text-sm text-slate-600">
                        {notes.map((note) => (
                          <li key={note}>• {note}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <a href={toPublicDownloadUrl(version)} className="btn-primary shrink-0">
                    Download
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
