const SEMVER_PATTERN =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export interface ParsedSemver {
  version: string;
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
  build: string | null;
}

export function parseSemver(version: string): ParsedSemver | null {
  const match = String(version).trim().match(SEMVER_PATTERN);
  if (!match) return null;

  return {
    version: String(version).trim(),
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || null,
    build: match[5] || null,
  };
}

export function versionSortKey(parsed: ParsedSemver): number {
  return parsed.major * 1_000_000 + parsed.minor * 1_000 + parsed.patch;
}

export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) return 0;
  return versionSortKey(left) - versionSortKey(right);
}

export function isNewerVersion(latest: string, current: string): boolean {
  return compareSemver(latest, current) > 0;
}
