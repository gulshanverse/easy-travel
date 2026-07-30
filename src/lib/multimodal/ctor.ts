/** MTIP — CTOR capability registration bridge.
 *
 *  MTIP never imports CTOR (ADR-016 / cross-engine rules). Instead it publishes
 *  a structural contract source + tool descriptors that CTOR's
 *  `CapabilityRegistry.discover()` / `registerTool()` consume. Every tool
 *  executes through the MTIP runtime, which executes through IPCF only.
 */
import {
  MULTIMODAL_CAPABILITY_IDS, MULTIMODAL_CONTRACTS, TRAVEL_MODES,
  type MultiModalCapabilityContract, type MultiModalCapabilityId, type TravelMode,
} from "./contracts";
import type { MultiModalTravelRuntime, TravelInvokeOptions } from "./runtime";
import type { TravelRequestInput } from "./providers/types";

export const MULTIMODAL_CAPABILITY_NAMESPACE = "multimodal";
export const MULTIMODAL_CAPABILITY_VERSION = "1.0.0";
export const MULTIMODAL_ENGINE_OWNER = Object.freeze({ engine: "multimodal.travel.platform" });

/** Aggregate capability composed of other multimodal capabilities. */
export const TRAVEL_SUMMARY_CAPABILITY_ID = "travel_summary";

export function ctorCapabilityId(capability: string): string {
  return `${MULTIMODAL_CAPABILITY_NAMESPACE}.${capability}`;
}

/** Structural mirror of CTOR's `CTORCapabilityContract` (no import). */
export interface MultiModalCtorCapabilityContract {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly owner: { readonly engine: string };
  readonly dependencies?: readonly { capabilityId: string; versionRange?: string }[];
  readonly ports?: readonly string[];
  readonly features?: readonly string[];
}

function contractFor(c: MultiModalCapabilityContract): MultiModalCtorCapabilityContract {
  return Object.freeze({
    id: ctorCapabilityId(c.id),
    name: c.name,
    version: c.version,
    owner: MULTIMODAL_ENGINE_OWNER,
    dependencies: Object.freeze([{ capabilityId: "integration.runtime", versionRange: "1.0.0" }]),
    ports: Object.freeze(["ipcf"]),
    features: Object.freeze([
      c.mode, c.output, `volatility:${c.volatility}`, `cacheable:${c.cacheable}`,
    ]),
  });
}

const TRAVEL_SUMMARY_CONTRACT: MultiModalCtorCapabilityContract = Object.freeze({
  id: ctorCapabilityId(TRAVEL_SUMMARY_CAPABILITY_ID),
  name: "Travel Summary",
  version: MULTIMODAL_CAPABILITY_VERSION,
  owner: MULTIMODAL_ENGINE_OWNER,
  dependencies: Object.freeze([
    { capabilityId: ctorCapabilityId("weather"), versionRange: "1.0.0" },
    { capabilityId: ctorCapabilityId("timezone_lookup"), versionRange: "1.0.0" },
    { capabilityId: ctorCapabilityId("currency_convert"), versionRange: "1.0.0" },
  ]),
  ports: Object.freeze(["ipcf"]),
  features: Object.freeze(["aggregate", "summary", "volatility:live", "cacheable:false"]),
});

export const MULTIMODAL_CTOR_CONTRACTS: readonly MultiModalCtorCapabilityContract[] = Object.freeze([
  ...MULTIMODAL_CAPABILITY_IDS.map((id) => contractFor(MULTIMODAL_CONTRACTS[id])),
  TRAVEL_SUMMARY_CONTRACT,
]);

export const MULTIMODAL_CTOR_CAPABILITY_IDS: readonly string[] = Object.freeze(
  MULTIMODAL_CTOR_CONTRACTS.map((c) => c.id),
);

/** Structural mirror of CTOR's `CTORContractSource`. */
export interface MultiModalContractSource {
  discover(): Promise<readonly MultiModalCtorCapabilityContract[]>;
}

export function multiModalContractSource(modes?: readonly TravelMode[]): MultiModalContractSource {
  const allowed = new Set<TravelMode>(modes ?? TRAVEL_MODES);
  return {
    async discover() {
      if (!modes) return MULTIMODAL_CTOR_CONTRACTS;
      return Object.freeze(
        MULTIMODAL_CAPABILITY_IDS
          .filter((id) => allowed.has(MULTIMODAL_CONTRACTS[id].mode))
          .map((id) => contractFor(MULTIMODAL_CONTRACTS[id])),
      );
    },
  };
}

// ------------------------------------------------------------------ Tools

export interface MultiModalToolParameter {
  readonly name: string;
  readonly type: "string" | "number" | "boolean" | "object" | "array";
  readonly required: boolean;
  readonly description?: string;
}

export interface MultiModalToolDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly capabilityId: string;
  readonly mode: TravelMode | "aggregate";
  readonly description: string;
  readonly schema: {
    readonly input: readonly MultiModalToolParameter[];
    readonly output: { readonly type: string; readonly description?: string };
  };
  readonly tags: readonly string[];
  readonly idempotent: boolean;
  readonly impl: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
}

const NUMERIC_INPUTS = new Set(["lat", "lon", "limit", "guests", "nights", "amount", "instant"]);
const ARRAY_INPUTS = new Set(["origins", "destinations"]);

function paramType(name: string): MultiModalToolParameter["type"] {
  if (NUMERIC_INPUTS.has(name)) return "number";
  if (ARRAY_INPUTS.has(name)) return "array";
  return "string";
}

export interface TravelSummaryInput {
  readonly place: string;
  readonly homeCurrency?: string;
  readonly destinationCurrency?: string;
}

export interface TravelSummaryResult {
  readonly place: string;
  readonly weather: unknown;
  readonly timezone: unknown;
  readonly currency: unknown;
  readonly generatedAt: number;
}

/** Aggregate summary — still executed only through the runtime → IPCF path. */
export async function travelSummary(
  runtime: MultiModalTravelRuntime,
  input: TravelSummaryInput,
  options: TravelInvokeOptions = {},
): Promise<TravelSummaryResult> {
  const [weather, timezone, currency] = await Promise.all([
    runtime.invoke("weather", { place: input.place }, options).catch(() => undefined),
    runtime.invoke("timezone_lookup", { place: input.place }, options).catch(() => undefined),
    input.homeCurrency && input.destinationCurrency
      ? runtime
          .invoke("exchange_rate", { from: input.homeCurrency, to: input.destinationCurrency }, options)
          .catch(() => undefined)
      : Promise.resolve(undefined),
  ]);
  return Object.freeze({
    place: input.place,
    weather: weather?.data,
    timezone: timezone?.data,
    currency: currency?.data,
    generatedAt: Date.now(),
  });
}

/** Build one CTOR tool descriptor per multimodal capability plus travel_summary. */
export function multiModalToolDescriptors(
  runtime: MultiModalTravelRuntime,
): readonly MultiModalToolDescriptor[] {
  const tools: MultiModalToolDescriptor[] = MULTIMODAL_CAPABILITY_IDS.map((id) => {
    const contract = MULTIMODAL_CONTRACTS[id];
    const required = new Set(contract.required);
    return Object.freeze({
      id: ctorCapabilityId(id),
      name: contract.name,
      version: contract.version,
      capabilityId: ctorCapabilityId(id),
      mode: contract.mode,
      description: contract.description,
      schema: Object.freeze({
        input: Object.freeze(
          contract.inputs.map((n) =>
            Object.freeze({ name: n, type: paramType(n), required: required.has(n) }),
          ),
        ),
        output: Object.freeze({ type: "object", description: contract.output }),
      }),
      tags: Object.freeze(["multimodal", contract.mode, contract.volatility]),
      idempotent: contract.volatility !== "live",
      impl: async (input: Readonly<Record<string, unknown>>) => {
        const response = await runtime.invoke(id as MultiModalCapabilityId, input as TravelRequestInput);
        return { ok: response.ok, data: response.data };
      },
    }) as MultiModalToolDescriptor;
  });

  tools.push(Object.freeze({
    id: ctorCapabilityId(TRAVEL_SUMMARY_CAPABILITY_ID),
    name: "Travel Summary",
    version: MULTIMODAL_CAPABILITY_VERSION,
    capabilityId: ctorCapabilityId(TRAVEL_SUMMARY_CAPABILITY_ID),
    mode: "aggregate",
    description: "Aggregate weather, timezone and currency snapshot for a destination.",
    schema: Object.freeze({
      input: Object.freeze([
        Object.freeze({ name: "place", type: "string", required: true }),
        Object.freeze({ name: "homeCurrency", type: "string", required: false }),
        Object.freeze({ name: "destinationCurrency", type: "string", required: false }),
      ]),
      output: Object.freeze({ type: "object", description: "TravelSummaryResult" }),
    }),
    tags: Object.freeze(["multimodal", "aggregate", "live"]),
    idempotent: false,
    impl: async (input: Readonly<Record<string, unknown>>) =>
      travelSummary(runtime, {
        place: String(input.place ?? ""),
        homeCurrency: input.homeCurrency ? String(input.homeCurrency) : undefined,
        destinationCurrency: input.destinationCurrency ? String(input.destinationCurrency) : undefined,
      }),
  }) as MultiModalToolDescriptor);

  return Object.freeze(tools);
}

/** Structural mirror of the slice of CTOR's CapabilityManager that MTIP needs. */
export interface MultiModalCtorRegistrarPort {
  readonly capabilities: { discover(source: MultiModalContractSource): Promise<readonly { id: string }[]> };
  registerTool(
    tool: {
      id: string; name: string; version: string;
      schema: { input: readonly MultiModalToolParameter[]; output: { type: string; description?: string } };
      contract: { capabilityId?: string; idempotent: boolean; sideEffects: boolean };
      permissions: readonly { scope: string }[];
      metadata: { tags: readonly string[]; labels: Readonly<Record<string, string>>; description?: string; createdAt: number };
      status: "registered";
    },
    impl?: (input: Readonly<Record<string, unknown>>) => Promise<unknown> | unknown,
  ): unknown;
}

export interface MultiModalRegistrationResult {
  readonly capabilityIds: readonly string[];
  readonly toolIds: readonly string[];
}

/**
 * Register every multimodal capability + tool with a CTOR capability manager.
 * The manager is passed structurally, so MTIP keeps zero engine imports.
 */
export async function registerMultiModalCapabilities(
  manager: MultiModalCtorRegistrarPort,
  runtime: MultiModalTravelRuntime,
): Promise<MultiModalRegistrationResult> {
  const discovered = await manager.capabilities.discover(multiModalContractSource());
  const descriptors = multiModalToolDescriptors(runtime);
  const now = Date.now();
  const toolIds: string[] = [];
  for (const d of descriptors) {
    manager.registerTool(
      {
        id: d.id, name: d.name, version: d.version,
        schema: d.schema,
        contract: { capabilityId: d.capabilityId, idempotent: d.idempotent, sideEffects: false },
        permissions: Object.freeze([]),
        metadata: {
          tags: d.tags, labels: Object.freeze({ suite: "multimodal", mode: d.mode }),
          description: d.description, createdAt: now,
        },
        status: "registered",
      },
      d.impl,
    );
    toolIds.push(d.id);
  }
  return Object.freeze({
    capabilityIds: Object.freeze(discovered.map((c) => c.id)),
    toolIds: Object.freeze(toolIds),
  });
}
