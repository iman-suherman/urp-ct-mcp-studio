export const PLUGIN_ID =
  process.env.NEXT_PUBLIC_PLUGIN_ID?.trim() || "ct-mcp-studio";

export const REGISTRY_API_URL =
  process.env.NEXT_PUBLIC_REGISTRY_API_URL?.trim() ||
  "https://ct-mcp-registry.suherman.net";

export const DOWNLOAD_BASE_URL =
  process.env.NEXT_PUBLIC_DOWNLOAD_BASE_URL?.trim() ||
  "https://storage.googleapis.com/personal-suherman-ct-mcp-studio/extensions";

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

export function toPublicDownloadUrl(version: PluginVersion): string {
  if (version.publicDownloadUrl) return version.publicDownloadUrl;
  if (version.gcs?.bucket && version.gcs?.objectPath) {
    return `https://storage.googleapis.com/${version.gcs.bucket}/${version.gcs.objectPath}`;
  }
  const fileName =
    version.gcs?.vsixFileName || `${PLUGIN_ID}-${version.version}.vsix`;
  return `${DOWNLOAD_BASE_URL}/${fileName}`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value?: PluginVersion["publishedAt"]): string {
  if (!value) return "—";
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
  }
  const seconds = value._seconds ?? value.seconds;
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleDateString();
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
