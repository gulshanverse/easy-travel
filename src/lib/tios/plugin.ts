/**
 * TIOS Plugin Architecture + Developer Experience (Milestone 5.3).
 * Thin wrappers over the contract system so capabilities behave like plugins:
 *   • Fluent contract builder
 *   • Base capability class for stateful plugins
 *   • Install/uninstall lifecycle helpers
 */
import type { ZodTypeAny } from "zod";
import { registerContract, transitionLifecycle, type CapabilityContract, type LifecycleState } from "./contracts";
import { registerCapability, setCapabilityHealth, unregisterCapability } from "./registry";
import { emitTIOSEvent, makeRequestId } from "./events";
import type { CapabilityId, DecisionContext, HealthStatus } from "./types";

// ---------- Fluent builder ----------
export class CapabilityContractBuilder<TIn = unknown, TOut = unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private partial: Partial<CapabilityContract<any, any>>;
  constructor(id: CapabilityId) {
    this.partial = { id, dependencies: [], requiredPermissions: [], supportedAgents: [], supportedProviders: [], priority: 50, featureFlags: [], lifecycle: "experimental" };
  }
  displayName(v: string) { this.partial.displayName = v; return this; }
  version(v: string) { this.partial.version = v; return this; }
  description(v: string) { this.partial.description = v; return this; }
  category(v: CapabilityContract["category"]) { this.partial.category = v; return this; }
  lifecycle(v: LifecycleState) { this.partial.lifecycle = v; return this; }
  input<S extends ZodTypeAny>(s: S) { this.partial.inputSchema = s; return this as unknown as CapabilityContractBuilder<import("zod").infer<S>, TOut>; }
  output<S extends ZodTypeAny>(s: S) { this.partial.outputSchema = s; return this as unknown as CapabilityContractBuilder<TIn, import("zod").infer<S>>; }
  dependsOn(...ids: CapabilityId[]) { this.partial.dependencies = [...(this.partial.dependencies ?? []), ...ids]; return this; }
  permissions(...p: string[]) { this.partial.requiredPermissions = [...(this.partial.requiredPermissions ?? []), ...p]; return this; }
  agents(...a: string[]) { this.partial.supportedAgents = [...(this.partial.supportedAgents ?? []), ...a]; return this; }
  providers(...p: string[]) { this.partial.supportedProviders = [...(this.partial.supportedProviders ?? []), ...p]; return this; }
  priority(n: number) { this.partial.priority = n; return this; }
  featureFlags(...f: string[]) { this.partial.featureFlags = [...(this.partial.featureFlags ?? []), ...f]; return this; }
  tags(...t: string[]) { this.partial.tags = [...(this.partial.tags ?? []), ...t]; return this; }
  requiredPolicies(...p: string[]) { this.partial.requiredPolicies = [...(this.partial.requiredPolicies ?? []), ...p]; return this; }
  requiredTools(...t: string[]) { this.partial.requiredTools = [...(this.partial.requiredTools ?? []), ...t]; return this; }
  failureModes(...m: string[]) { this.partial.failureModes = [...(this.partial.failureModes ?? []), ...m]; return this; }
  fallback(strategy: NonNullable<CapabilityContract["fallbackStrategy"]>) { this.partial.fallbackStrategy = strategy; return this; }
  retry(policy: NonNullable<CapabilityContract["retryStrategy"]>) { this.partial.retryStrategy = policy; return this; }
  sla(sla: NonNullable<CapabilityContract["sla"]>) { this.partial.sla = sla; return this; }
  latencyTarget(ms: number) { this.partial.latencyTargetMs = ms; return this; }
  costCategory(c: NonNullable<CapabilityContract["costCategory"]>) { this.partial.costCategory = c; return this; }
  securityClassification(c: NonNullable<CapabilityContract["securityClassification"]>) { this.partial.securityClassification = c; return this; }
  owner(module: string) { this.partial.ownerModule = module; return this; }
  docs(url: string) { this.partial.docsUrl = url; return this; }
  handler(h: (input: TIn, ctx: DecisionContext) => Promise<TOut>) { this.partial.handler = h as unknown as CapabilityContract["handler"]; return this; }

  build(): CapabilityContract<TIn, TOut> {
    const p = this.partial as CapabilityContract<TIn, TOut>;
    if (!p.id || !p.displayName || !p.version || !p.description || !p.category || !p.inputSchema || !p.outputSchema) {
      throw new Error(`Capability contract for "${p.id ?? "?"}" is missing required fields`);
    }
    return p;
  }
}

export function defineCapability(id: CapabilityId): CapabilityContractBuilder {
  return new CapabilityContractBuilder(id);
}

// ---------- Base plugin class ----------
export abstract class CapabilityPlugin<TIn = unknown, TOut = unknown> {
  abstract readonly contract: CapabilityContract<TIn, TOut>;
  abstract execute(input: TIn, ctx: DecisionContext): Promise<TOut>;

  install(): void {
    const contract = { ...this.contract, handler: (i: TIn, c: DecisionContext) => this.execute(i, c) };
    registerContract(contract);
    emitTIOSEvent({
      name: "CAPABILITY_REGISTERED",
      requestId: makeRequestId("plugin"),
      timestamp: Date.now(),
      capability: this.contract.id,
      data: { plugin: true, version: this.contract.version },
    });
  }

  uninstall(): void {
    unregisterCapability(this.contract.id);
  }

  setHealth(h: HealthStatus): void { setCapabilityHealth(this.contract.id, h); }

  deprecate(reason?: string): void { transitionLifecycle(this.contract.id, "deprecated", reason); }
}

// ---------- Discovery ----------
export function installPlugins(plugins: CapabilityPlugin[]): void {
  for (const p of plugins) p.install();
}

// ---------- Manifest helper for pure manifest capabilities ----------
export function installManifestCapability(
  manifest: Parameters<typeof registerCapability>[0],
  invoke?: Parameters<typeof registerCapability>[1],
): void {
  registerCapability(manifest, invoke);
}
