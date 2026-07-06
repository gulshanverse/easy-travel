/**
 * TIOS Architecture Validation (Milestone 5.3).
 * Runtime + build-time checks that critical architectural rules hold.
 * Callers can call `assertArchitectureHealthy()` from bootstrap or CI to
 * fail loudly when the platform drifts.
 */
import { listContracts } from "./contracts";
import { analyzeDependencies } from "./dependency-graph";
import { snapshotMatrix } from "./provider-matrix";
import { snapshotFlags } from "./flags";
import { listPolicies } from "./policy";

export type ValidationSeverity = "info" | "warn" | "error";

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  target?: string;
  message: string;
}

export interface ValidationReport {
  ok: boolean;
  issues: ValidationIssue[];
  checkedAt: number;
  stats: {
    contracts: number;
    capabilities: number;
    providers: number;
    policies: number;
    flags: number;
  };
}

export function validateArchitecture(): ValidationReport {
  const issues: ValidationIssue[] = [];

  // 1. Contracts
  const contracts = listContracts();
  for (const r of contracts) {
    const c = r.contract;
    if (!c.version || !/^\d+\.\d+\.\d+/.test(c.version)) {
      issues.push({ code: "contract.version", severity: "error", target: c.id, message: "invalid semver" });
    }
    if (!c.displayName) {
      issues.push({ code: "contract.displayName", severity: "warn", target: c.id, message: "missing displayName" });
    }
    if (c.lifecycle === "deprecated" && !c.deprecation) {
      issues.push({ code: "contract.deprecation", severity: "warn", target: c.id, message: "deprecated without deprecation policy" });
    }
  }

  // 2. Dependency graph
  const depReport = analyzeDependencies();
  for (const i of depReport.issues) {
    issues.push({
      code: `dependency.${i.kind}`,
      severity: i.kind === "circular" ? "error" : "warn",
      target: i.capabilityId,
      message: i.details,
    });
  }

  // 3. Provider matrix
  const matrix = snapshotMatrix();
  const providerCapCount = new Set(matrix.map((m) => m.capability)).size;
  const capabilitiesWithoutProviders = contracts
    .filter((r) => r.contract.supportedProviders.length > 0)
    .filter((r) => !matrix.some((m) => m.capability === r.contract.id));
  for (const r of capabilitiesWithoutProviders) {
    issues.push({
      code: "matrix.missing-provider",
      severity: "warn",
      target: r.contract.id,
      message: "contract declares supportedProviders but no matrix entries",
    });
  }

  // 4. Feature flags referenced by contracts must exist
  const flags = snapshotFlags();
  for (const r of contracts) {
    for (const f of r.contract.featureFlags) {
      if (!(f in flags)) {
        issues.push({
          code: "flag.unknown", severity: "warn", target: r.contract.id,
          message: `references unknown feature flag "${f}"`,
        });
      }
    }
  }

  // 5. Policies referenced by contracts must exist
  const policies = listPolicies();
  const policyIds = new Set(policies.map((p) => p.id));
  for (const r of contracts) {
    for (const p of r.contract.requiredPolicies ?? []) {
      if (!policyIds.has(p)) {
        issues.push({
          code: "policy.unknown", severity: "error", target: r.contract.id,
          message: `references unknown policy "${p}"`,
        });
      }
    }
  }

  const errors = issues.filter((i) => i.severity === "error");
  return {
    ok: errors.length === 0,
    issues,
    checkedAt: Date.now(),
    stats: {
      contracts: contracts.length,
      capabilities: contracts.length,
      providers: providerCapCount,
      policies: policies.length,
      flags: Object.keys(flags).length,
    },
  };
}

export function assertArchitectureHealthy(): void {
  const report = validateArchitecture();
  if (report.ok) return;
  const summary = report.issues
    .filter((i) => i.severity === "error")
    .map((i) => `[${i.code}] ${i.target ?? "-"}: ${i.message}`)
    .join("\n");
  throw new Error(`TIOS architecture validation failed:\n${summary}`);
}
