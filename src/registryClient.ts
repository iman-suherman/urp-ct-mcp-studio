export type ReleaseNotes = {
  introduced?: string[];
  changed?: string[];
  updated?: string[];
  fixed?: string[];
  removed?: string[];
  breaking?: string[];
};

export type PluginVersion = {
  pluginId: string;
  displayName?: string;
  publisher?: string;
  version: string;
  channel?: string;
  summary?: string;
  releaseNotes?: ReleaseNotes;
  releaseNotesMarkdown?: string;
  downloadUrl?: string;
  publicDownloadUrl?: string;
  publicLatestDownloadUrl?: string;
  mandatory?: boolean;
  sizeBytes?: number;
  publishedAt?: { _seconds?: number; seconds?: number } | string;
};

export type LatestRelease = {
  pluginId?: string;
  version: string;
  name: string;
  releaseDate: string | null;
  downloadUrl: string;
  releaseNotesUrl: string;
  mandatory: boolean;
  channel: string;
  summary?: string | null;
  releaseNotes?: string[];
  releaseNotesMarkdown?: string | null;
  releaseNotesStructured?: ReleaseNotes | null;
  sizeBytes?: number | null;
};

export type VersionsResponse = {
  pluginId: string;
  count: number;
  versions: PluginVersion[];
};

function buildUrl(base: string, path: string, params?: Record<string, string>): URL {
  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

export class RegistryClient {
  constructor(
    private readonly registryApiUrl: string,
    private readonly pluginId: string
  ) {}

  async fetchLatestRelease(channel: string): Promise<LatestRelease | null> {
    const url = buildUrl(this.registryApiUrl, "/api/releases/latest", {
      pluginId: this.pluginId,
      channel,
    });
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Registry API ${response.status}: ${response.statusText}`);
    }
    return (await response.json()) as LatestRelease;
  }

  async fetchVersions(): Promise<PluginVersion[]> {
    const url = buildUrl(
      this.registryApiUrl,
      `/api/v1/plugins/${encodeURIComponent(this.pluginId)}/versions`
    );
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Registry API ${response.status}: ${response.statusText}`);
    }
    const payload = (await response.json()) as VersionsResponse;
    return payload.versions ?? [];
  }

  async fetchVersion(version: string): Promise<PluginVersion | null> {
    const url = buildUrl(
      this.registryApiUrl,
      `/api/v1/plugins/${encodeURIComponent(this.pluginId)}/versions/${encodeURIComponent(version)}`
    );
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Registry API ${response.status}: ${response.statusText}`);
    }
    return (await response.json()) as PluginVersion;
  }
}

export function flattenReleaseNotes(notes?: ReleaseNotes): string[] {
  if (!notes) return [];
  return [
    ...(notes.breaking ?? []).map((item) => `Breaking: ${item}`),
    ...(notes.introduced ?? []).map((item) => item),
    ...(notes.changed ?? []).map((item) => item),
    ...(notes.updated ?? []).map((item) => item),
    ...(notes.fixed ?? []).map((item) => item),
    ...(notes.removed ?? []).map((item) => item),
  ];
}

export function formatPublishedDate(
  value?: PluginVersion["publishedAt"]
): string {
  if (!value) return "—";
  let date: Date;
  if (typeof value === "string") {
    date = new Date(value);
  } else {
    const seconds = value._seconds ?? value.seconds;
    if (!seconds) return "—";
    date = new Date(seconds * 1000);
  }
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
