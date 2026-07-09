/**
 * Semantic version helpers and PromptVersionManager.
 * Strict semver (MAJOR.MINOR.PATCH) — no pre-release tags in stored versions.
 */
import { VersionConflictError } from "./errors";

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export function parseSemver(v: string): SemVer {
  const m = SEMVER_RE.exec(v);
  if (!m) throw new VersionConflictError(`Invalid semver: ${v}`);
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

export function formatSemver(v: SemVer): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

export function compareSemver(a: string, b: string): number {
  const A = parseSemver(a), B = parseSemver(b);
  return A.major - B.major || A.minor - B.minor || A.patch - B.patch;
}

export function bumpSemver(v: string, kind: "major" | "minor" | "patch"): string {
  const p = parseSemver(v);
  if (kind === "major") return formatSemver({ major: p.major + 1, minor: 0, patch: 0 });
  if (kind === "minor") return formatSemver({ major: p.major, minor: p.minor + 1, patch: 0 });
  return formatSemver({ major: p.major, minor: p.minor, patch: p.patch + 1 });
}

export function isCompatible(active: string, candidate: string): boolean {
  // Semver-compatible = same MAJOR, candidate >= active.
  const a = parseSemver(active), c = parseSemver(candidate);
  if (a.major !== c.major) return false;
  return compareSemver(candidate, active) >= 0;
}

export class PromptVersionManager {
  /** Suggest the next version given kind. */
  next(current: string, kind: "major" | "minor" | "patch"): string {
    return bumpSemver(current, kind);
  }

  /** Throws if candidate breaks compatibility. */
  assertCompatible(active: string, candidate: string): void {
    if (!isCompatible(active, candidate)) {
      throw new VersionConflictError(
        `Incompatible version bump: active=${active} candidate=${candidate}`,
      );
    }
  }

  /** Pick the highest active version from a list. */
  latest(versions: string[]): string | undefined {
    if (!versions.length) return undefined;
    return [...versions].sort(compareSemver).at(-1);
  }
}
