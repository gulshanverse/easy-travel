/**
 * PromptRegistry — register, activate, deprecate, rollback, lookup, audit.
 * Uses PromptVersionManager for semver enforcement.
 */
import { RegistryError, VersionConflictError } from "./errors";
import { PromptVersionManager, compareSemver } from "./versioning";
import type {
  PromptFragment,
  PromptId,
  PromptRegistryEntry,
  PromptVersion,
  OutputSchema,
} from "./types";

export interface RegistrationInput {
  promptId: PromptId;
  version: PromptVersion;
  fragments: PromptFragment[];
  outputSchema?: OutputSchema;
  changelog?: string;
  minRuntime?: string;
}

export interface AuditRecord {
  timestamp: number;
  action:
    | "register"
    | "activate"
    | "deprecate"
    | "rollback"
    | "retire"
    | "supersede";
  promptId: PromptId;
  version: PromptVersion;
  detail?: string;
}

export class PromptRegistry {
  private readonly entries = new Map<string, PromptRegistryEntry>();
  private readonly active = new Map<PromptId, PromptVersion>();
  private readonly audit: AuditRecord[] = [];
  private readonly versions = new PromptVersionManager();

  private key(id: PromptId, v: PromptVersion): string {
    return `${id}@${v}`;
  }

  register(input: RegistrationInput): PromptRegistryEntry {
    if (!input.promptId) throw new RegistryError("promptId required");
    if (!input.fragments?.length) throw new RegistryError("fragments required");
    const k = this.key(input.promptId, input.version);
    if (this.entries.has(k)) {
      throw new VersionConflictError(`Already registered: ${k}`);
    }
    const entry: PromptRegistryEntry = {
      promptId: input.promptId,
      version: input.version,
      status: "draft",
      fragments: input.fragments,
      outputSchema: input.outputSchema,
      minRuntime: input.minRuntime,
      changelog: input.changelog,
      createdAt: Date.now(),
    };
    this.entries.set(k, entry);
    this.audit.push({ timestamp: Date.now(), action: "register", promptId: input.promptId, version: input.version });
    return entry;
  }

  activate(promptId: PromptId, version: PromptVersion): PromptRegistryEntry {
    const entry = this.mustGet(promptId, version);
    const currentActive = this.active.get(promptId);
    if (currentActive && currentActive !== version) {
      this.versions.assertCompatible(currentActive, version);
      const prev = this.mustGet(promptId, currentActive);
      prev.status = "deprecated";
      prev.deprecatedAt = Date.now();
      prev.supersededBy = version;
      this.audit.push({ timestamp: Date.now(), action: "supersede", promptId, version: currentActive, detail: `by ${version}` });
    }
    entry.status = "active";
    entry.activatedAt = Date.now();
    this.active.set(promptId, version);
    this.audit.push({ timestamp: Date.now(), action: "activate", promptId, version });
    return entry;
  }

  deprecate(promptId: PromptId, version: PromptVersion): void {
    const entry = this.mustGet(promptId, version);
    entry.status = "deprecated";
    entry.deprecatedAt = Date.now();
    this.audit.push({ timestamp: Date.now(), action: "deprecate", promptId, version });
  }

  retire(promptId: PromptId, version: PromptVersion): void {
    const entry = this.mustGet(promptId, version);
    entry.status = "retired";
    if (this.active.get(promptId) === version) this.active.delete(promptId);
    this.audit.push({ timestamp: Date.now(), action: "retire", promptId, version });
  }

  rollback(promptId: PromptId, toVersion: PromptVersion): PromptRegistryEntry {
    const target = this.mustGet(promptId, toVersion);
    if (target.status === "retired") {
      throw new RegistryError(`Cannot rollback to retired version: ${toVersion}`);
    }
    const current = this.active.get(promptId);
    if (current) {
      const prev = this.mustGet(promptId, current);
      prev.status = "deprecated";
      prev.deprecatedAt = Date.now();
      prev.supersededBy = toVersion;
    }
    target.status = "active";
    target.activatedAt = Date.now();
    this.active.set(promptId, toVersion);
    this.audit.push({ timestamp: Date.now(), action: "rollback", promptId, version: toVersion });
    return target;
  }

  get(promptId: PromptId, version?: PromptVersion): PromptRegistryEntry | undefined {
    const v = version ?? this.active.get(promptId);
    if (!v) return undefined;
    return this.entries.get(this.key(promptId, v));
  }

  resolve(promptId: PromptId, version?: PromptVersion): PromptRegistryEntry {
    const entry = this.get(promptId, version);
    if (!entry) {
      throw new RegistryError(`Prompt not found: ${promptId}${version ? `@${version}` : ""}`);
    }
    if (entry.status === "retired") {
      throw new RegistryError(`Prompt retired: ${promptId}@${entry.version}`);
    }
    return entry;
  }

  activeVersion(promptId: PromptId): PromptVersion | undefined {
    return this.active.get(promptId);
  }

  history(promptId: PromptId): PromptRegistryEntry[] {
    return [...this.entries.values()]
      .filter((e) => e.promptId === promptId)
      .sort((a, b) => compareSemver(a.version, b.version));
  }

  auditTrail(promptId?: PromptId): AuditRecord[] {
    return promptId ? this.audit.filter((a) => a.promptId === promptId) : [...this.audit];
  }

  size(): number { return this.entries.size; }

  private mustGet(promptId: PromptId, version: PromptVersion): PromptRegistryEntry {
    const e = this.entries.get(this.key(promptId, version));
    if (!e) throw new RegistryError(`Unknown prompt: ${promptId}@${version}`);
    return e;
  }
}
