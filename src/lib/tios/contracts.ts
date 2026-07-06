/**
 * TIOS — Capability Contract System (Milestone 5.2).
 * -----------------------------------------------------------------
 * Strongly typed contracts for every capability. Adds:
 *   • Zod-validated input/output schemas
 *   • Lifecycle state machine (experimental → beta → stable → deprecated)
 *   • Category taxonomy
 *   • Display metadata
 *   • Deprecation policy (replacedBy, sunsetAt, warnings)
 *   • Contract registry that layers on top of the CapabilityManifest registry
 *
 * Backward compatible: existing `registerCapability(manifest, invoke)` still
 * works. Contracts are additive — a contract auto-registers a manifest.
 */
import { z, type ZodTypeAny } from "zod";
import { emitTIOSEvent, makeRequestId } from "./events";
import { registerCapability } from "./registry";
import type {
  CapabilityId, CapabilityManifest, DecisionContext,
} from "./types";

// ---------- Taxonomy ----------
export type CapabilityCategory =
  | "planning" | "discovery" | "booking" | "logistics"
  | "assistance" | "safety" | "financial" | "communications"
  | "insights" | "infrastructure";

export type LifecycleState = "experimental" | "beta" | "stable" | "deprecated";

const LIFECYCLE_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  experimental: ["beta", "deprecated"],
  beta: ["stable", "deprecated", "experimental"],
  stable: ["deprecated"],
  deprecated: [],
};

// ---------- Contract shape ----------
export interface CapabilityContract<TInput = unknown, TOutput = unknown> {
  id: CapabilityId;
  displayName: string;
  description: string;
  version: string;                    // semver
  category: CapabilityCategory;
  lifecycle: LifecycleState;
  inputSchema: ZodTypeAny;
  outputSchema: ZodTypeAny;
  dependencies: CapabilityId[];
  requiredPermissions: string[];
  supportedAgents: string[];
  supportedProviders: string[];
  priority: number;
  featureFlags: string[];
  tags?: string[];
  deprecation?: {
    replacedBy?: CapabilityId;
    sunsetAt?: string;               // ISO date
    reason?: string;
  };
  handler?: (input: TInput, ctx: DecisionContext) => Promise<TOutput>;
}

export interface RegisteredContract<TInput = unknown, TOutput = unknown> {
  contract: CapabilityContract<TInput, TOutput>;
  registeredAt: number;
  updatedAt: number;
  invocationCount: number;
  lastInvokedAt?: number;
}

// ---------- Errors ----------
export class ContractValidationError extends Error {
  constructor(
    public readonly capabilityId: CapabilityId,
    public readonly phase: "input" | "output",
    public readonly issues: z.ZodIssue[],
  ) {
    super(
      `TIOS contract ${phase} validation failed for "${capabilityId}": ${issues
        .map((i) => `${i.path.join(".") || "<root>"} ${i.message}`)
        .join("; ")}`,
    );
    this.name = "ContractValidationError";
  }
}

export class LifecycleTransitionError extends Error {
  constructor(from: LifecycleState, to: LifecycleState) {
    super(`TIOS invalid lifecycle transition: ${from} → ${to}`);
    this.name = "LifecycleTransitionError";
  }
}

// ---------- Registry ----------
const contracts = new Map<CapabilityId, RegisteredContract>();

function toManifest(c: CapabilityContract): CapabilityManifest {
  return {
    id: c.id,
    version: c.version,
    description: c.description,
    dependencies: c.dependencies,
    permissions: c.requiredPermissions,
    inputSchema: c.inputSchema,
    outputSchema: c.outputSchema,
    supportedAgents: c.supportedAgents,
    supportedProviders: c.supportedProviders,
    priority: c.priority,
    featureFlags: c.featureFlags,
    tags: c.tags,
  };
}

export function registerContract<TInput, TOutput>(
  contract: CapabilityContract<TInput, TOutput>,
): RegisteredContract<TInput, TOutput> {
  const existing = contracts.get(contract.id);
  const now = Date.now();
  const record: RegisteredContract<TInput, TOutput> = {
    contract,
    registeredAt: existing?.registeredAt ?? now,
    updatedAt: now,
    invocationCount: existing?.invocationCount ?? 0,
    lastInvokedAt: existing?.lastInvokedAt,
  };
  contracts.set(contract.id, record as unknown as RegisteredContract);

  // Mirror into the CapabilityManifest registry so decision-engine
  // & policy engine keep working unchanged.
  registerCapability(toManifest(contract), async (input, ctx) => {
    return invokeContract(contract.id, input, ctx);
  });

  return record;
}

export function getContract<TInput = unknown, TOutput = unknown>(
  id: CapabilityId,
): RegisteredContract<TInput, TOutput> | undefined {
  return contracts.get(id) as RegisteredContract<TInput, TOutput> | undefined;
}

export function listContracts(): RegisteredContract[] {
  return Array.from(contracts.values());
}

export function listContractsByCategory(
  category: CapabilityCategory,
): RegisteredContract[] {
  return listContracts().filter((r) => r.contract.category === category);
}

export function listContractsByLifecycle(
  lifecycle: LifecycleState,
): RegisteredContract[] {
  return listContracts().filter((r) => r.contract.lifecycle === lifecycle);
}

// ---------- Lifecycle ----------
export function transitionLifecycle(
  id: CapabilityId,
  to: LifecycleState,
  reason?: string,
): void {
  const record = contracts.get(id);
  if (!record) throw new Error(`TIOS: no contract for "${id}"`);
  const from = record.contract.lifecycle;
  if (from === to) return;
  if (!LIFECYCLE_TRANSITIONS[from].includes(to)) {
    throw new LifecycleTransitionError(from, to);
  }
  record.contract.lifecycle = to;
  record.updatedAt = Date.now();
  if (to === "deprecated" && reason && !record.contract.deprecation) {
    record.contract.deprecation = { reason };
  }
  emitTIOSEvent({
    name: "CAPABILITY_UPDATED",
    requestId: makeRequestId("contract"),
    timestamp: Date.now(),
    capability: id,
    data: { lifecycle: to, from, reason },
  });
}

// ---------- Validated invocation ----------
export async function invokeContract<TInput = unknown, TOutput = unknown>(
  id: CapabilityId,
  input: TInput,
  ctx: DecisionContext,
): Promise<TOutput> {
  const record = contracts.get(id) as RegisteredContract<TInput, TOutput> | undefined;
  if (!record) throw new Error(`TIOS: no contract for "${id}"`);
  const { contract } = record;

  if (contract.lifecycle === "deprecated") {
    // Emit a warning event but don't block callers.
    emitTIOSEvent({
      name: "CAPABILITY_UPDATED",
      requestId: ctx.requestId,
      timestamp: Date.now(),
      capability: id,
      data: {
        warning: "deprecated",
        replacedBy: contract.deprecation?.replacedBy,
        sunsetAt: contract.deprecation?.sunsetAt,
      },
    });
  }

  const parsedInput = contract.inputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new ContractValidationError(id, "input", parsedInput.error.issues);
  }
  if (!contract.handler) {
    throw new Error(`TIOS: contract "${id}" has no handler`);
  }
  const output = await contract.handler(parsedInput.data as TInput, ctx);

  const parsedOutput = contract.outputSchema.safeParse(output);
  if (!parsedOutput.success) {
    throw new ContractValidationError(id, "output", parsedOutput.error.issues);
  }

  record.invocationCount += 1;
  record.lastInvokedAt = Date.now();
  return parsedOutput.data as TOutput;
}

// ---------- Utilities ----------
export function describeContract(id: CapabilityId): Record<string, unknown> | undefined {
  const record = contracts.get(id);
  if (!record) return undefined;
  const c = record.contract;
  return {
    id: c.id,
    displayName: c.displayName,
    version: c.version,
    category: c.category,
    lifecycle: c.lifecycle,
    dependencies: c.dependencies,
    requiredPermissions: c.requiredPermissions,
    supportedAgents: c.supportedAgents,
    supportedProviders: c.supportedProviders,
    featureFlags: c.featureFlags,
    tags: c.tags ?? [],
    deprecation: c.deprecation,
    invocationCount: record.invocationCount,
    registeredAt: record.registeredAt,
    updatedAt: record.updatedAt,
  };
}

export function describeAllContracts(): Array<Record<string, unknown>> {
  return listContracts()
    .map((r) => describeContract(r.contract.id))
    .filter((x): x is Record<string, unknown> => Boolean(x));
}

// Re-export Zod so contract authors get the same instance.
export { z };
