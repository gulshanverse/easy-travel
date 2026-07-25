/** IPCF — governance policies. */
export interface IntegrationPolicies {
  readonly requireAuthentication: boolean;
  readonly allowAnonymousConnectors: boolean;
  readonly enforceRateLimits: boolean;
  readonly enforceCircuitBreaker: boolean;
  readonly enforceSandboxIsolation: boolean;
  readonly enforceCapabilityValidation: boolean;
  readonly enforceVersionCompatibility: boolean;
  readonly denyOnPolicyViolation: boolean;
}
export const DEFAULT_INTEGRATION_POLICIES: IntegrationPolicies = Object.freeze({
  requireAuthentication: true,
  allowAnonymousConnectors: true,
  enforceRateLimits: true,
  enforceCircuitBreaker: true,
  enforceSandboxIsolation: true,
  enforceCapabilityValidation: true,
  enforceVersionCompatibility: true,
  denyOnPolicyViolation: true,
});
export function mergeIntegrationPolicies(p?: Partial<IntegrationPolicies>): IntegrationPolicies {
  return Object.freeze({ ...DEFAULT_INTEGRATION_POLICIES, ...(p ?? {}) });
}
