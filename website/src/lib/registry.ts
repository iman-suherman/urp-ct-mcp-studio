export const PLUGIN_ID =
  process.env.NEXT_PUBLIC_PLUGIN_ID?.trim() || "ct-mcp-studio";

export const REGISTRY_API_URL =
  process.env.NEXT_PUBLIC_REGISTRY_API_URL?.trim() ||
  "https://ct-mcp-registry.suherman.net";

export const DOWNLOAD_BASE_URL =
  process.env.NEXT_PUBLIC_DOWNLOAD_BASE_URL?.trim() ||
  "https://ct-mcp-download.suherman.net/downloads";

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
  summary?: string;
  releaseNotes?: ReleaseNotes;
  releaseNotesMarkdown?: string;
  downloadUrl?: string;
  publicDownloadUrl?: string;
  gcs?: {
    bucket?: string;
    objectPath?: string;
    vsixFileName?: string;
  };
  sizeBytes?: number;
  gitCommit?: string;
  publishedAt?: { _seconds?: number; seconds?: number } | string;
};

export type VersionsResponse = {
  pluginId: string;
  count: number;
  versions: PluginVersion[];
};

function vsixFileName(version: PluginVersion): string {
  if (version.gcs?.vsixFileName) return version.gcs.vsixFileName;
  if (version.gcs?.objectPath) {
    const parts = version.gcs.objectPath.split("/");
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  if (version.publicDownloadUrl) {
    try {
      const parts = new URL(version.publicDownloadUrl).pathname.split("/");
      const last = parts[parts.length - 1];
      if (last?.endsWith(".vsix")) return last;
    } catch {
      /* ignore */
    }
  }
  return `${PLUGIN_ID}-${version.version}.vsix`;
}

export function toPublicDownloadUrl(version: PluginVersion): string {
  const base = DOWNLOAD_BASE_URL.replace(/\/$/, "");
  return `${base}/${vsixFileName(version)}`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const RELEASE_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};

export function formatDate(value?: PluginVersion["publishedAt"]): string {
  if (!value) return "—";
  let date: Date;
  if (typeof value === "string") {
    date = new Date(value);
  } else {
    const seconds = value._seconds ?? value.seconds;
    if (!seconds) return "—";
    date = new Date(seconds * 1000);
  }
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-GB", RELEASE_DATE_FORMAT);
}

export function publishedAtToIso(value?: PluginVersion["publishedAt"]): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const seconds = value._seconds ?? value.seconds;
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${REGISTRY_API_URL}${path}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchLatestVersion(): Promise<PluginVersion | null> {
  return fetchJson<PluginVersion>(`/api/v1/plugins/${PLUGIN_ID}/versions/latest`);
}

export async function fetchAllVersions(): Promise<PluginVersion[]> {
  const data = await fetchJson<VersionsResponse>(
    `/api/v1/plugins/${PLUGIN_ID}/versions`
  );
  return data?.versions ?? [];
}

export function flattenReleaseNotes(notes?: ReleaseNotes): string[] {
  if (!notes) return [];
  return [
    ...(notes.breaking ?? []).map((item) => `Breaking: ${item}`),
    ...(notes.introduced ?? []).map((item) => `Introduced: ${item}`),
    ...(notes.changed ?? []).map((item) => `Changed: ${item}`),
    ...(notes.updated ?? []).map((item) => `Updated: ${item}`),
    ...(notes.fixed ?? []).map((item) => `Fixed: ${item}`),
    ...(notes.removed ?? []).map((item) => `Removed: ${item}`),
  ];
}
