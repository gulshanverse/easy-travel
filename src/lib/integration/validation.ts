/** IPCF — validation helpers. */
import { IntegrationValidationError } from "./errors";
import type {
  Connector, ConnectorDefinition, ConnectorManifest, ConnectorPolicy,
  ConnectorRequest,
} from "./types";

export function assertNonEmpty(s: string | undefined, field: string): string {
  if (typeof s !== "string" || s.trim().length === 0) {
    throw new IntegrationValidationError(`${field} must be a non-empty string`);
  }
  return s;
}
export function assertSemver(v: string, field = "version"): void {
  if (!/^\d+\.\d+\.\d+$/.test(v)) {
    throw new IntegrationValidationError(`${field} must be semver x.y.z (got: ${v})`);
  }
}
export function assertUniqueIds(ids: readonly string[], field: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new IntegrationValidationError(`${field} contains duplicate id: ${id}`);
    seen.add(id);
  }
}
export function validateManifest(m: ConnectorManifest): void {
  assertNonEmpty(m.id, "manifest.id");
  assertNonEmpty(m.name, "manifest.name");
  assertSemver(m.version, "manifest.version");
  assertSemver(m.contract.version, "manifest.contract.version");
  assertUniqueIds(m.capabilities.map(c => c.id), "manifest.capabilities");
  for (const c of m.capabilities) {
    assertNonEmpty(c.id, "capability.id");
    assertNonEmpty(c.name, "capability.name");
    assertSemver(c.version, "capability.version");
  }
  assertUniqueIds(m.dependencies.map(d => d.connectorId), "manifest.dependencies");
}
export function validatePolicy(p: ConnectorPolicy): void {
  if (p.rateLimit.perMinute <= 0) throw new IntegrationValidationError("policy.rateLimit.perMinute must be > 0");
  if (p.retry.maxAttempts < 1) throw new IntegrationValidationError("policy.retry.maxAttempts must be >= 1");
  if (p.retry.baseDelayMs < 0) throw new IntegrationValidationError("policy.retry.baseDelayMs must be >= 0");
  if (p.retry.maxDelayMs < p.retry.baseDelayMs) throw new IntegrationValidationError("policy.retry.maxDelayMs must be >= baseDelayMs");
  if (p.circuit.failureThreshold < 1) throw new IntegrationValidationError("policy.circuit.failureThreshold must be >= 1");
  if (p.circuit.openCooldownMs < 0) throw new IntegrationValidationError("policy.circuit.openCooldownMs must be >= 0");
  if (p.concurrency < 1) throw new IntegrationValidationError("policy.concurrency must be >= 1");
  if (p.executionBudgetMs < 0) throw new IntegrationValidationError("policy.executionBudgetMs must be >= 0");
}
export function validateDefinition(d: ConnectorDefinition): void {
  validateManifest(d.manifest);
  validatePolicy(d.policy);
}
export function validateConnector(c: Connector): void {
  assertNonEmpty(c.id, "connector.id");
  validateDefinition(c.definition);
}
export function validateRequest(r: ConnectorRequest): void {
  assertNonEmpty(r.id, "request.id");
  assertNonEmpty(r.connectorId, "request.connectorId");
  assertNonEmpty(r.capabilityId, "request.capabilityId");
  assertNonEmpty(r.correlationId, "request.correlationId");
}
