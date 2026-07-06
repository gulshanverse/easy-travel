# TIOS 5.2 — Capability Contract System

Extends TIOS with strongly-typed, versioned, lifecycle-managed capability
contracts. Additive on top of Milestone 5.1 — the existing
`registerCapability(manifest, invoke)` path continues to work unchanged.

## What a Contract adds over a Manifest

| Field | Contract | Manifest |
| --- | :-: | :-: |
| Zod input/output schemas | ✅ | ✳️ (opaque `unknown`) |
| Lifecycle state (experimental → beta → stable → deprecated) | ✅ | — |
| Category taxonomy | ✅ | — |
| Display name | ✅ | — |
| Deprecation policy (`replacedBy`, `sunsetAt`, `reason`) | ✅ | — |
| Handler (validated invocation) | ✅ | invoke (unvalidated) |
| Invocation metrics | ✅ | — |

## Lifecycle State Machine

```text
experimental ──► beta ──► stable ──► deprecated
     │            │                       ▲
     └────────────┴───────────────────────┘
```

Invalid transitions throw `LifecycleTransitionError`. Deprecation emits a
`CAPABILITY_UPDATED` event with `warning: "deprecated"` and any
`replacedBy` / `sunsetAt` metadata on every invocation.

## Categories

`planning`, `discovery`, `booking`, `logistics`, `assistance`, `safety`,
`financial`, `communications`, `insights`, `infrastructure`.

## API

```ts
import {
  registerContract, invokeContract, transitionLifecycle,
  listContractsByCategory, describeAllContracts, z,
} from "@/lib/tios";

registerContract({
  id: "weather",
  displayName: "Weather",
  version: "1.1.0",
  description: "5-day forecast + severe advisories",
  category: "insights",
  lifecycle: "beta",
  inputSchema:  z.object({ lat: z.number(), lon: z.number() }),
  outputSchema: z.object({ tempC: z.number(), summary: z.string() }),
  dependencies: [], requiredPermissions: [],
  supportedAgents: [], supportedProviders: ["open-meteo"],
  priority: 70, featureFlags: ["Weather"],
  handler: async ({ lat, lon }) => fetchForecast(lat, lon),
});

const out = await invokeContract("weather", { lat: 12.9, lon: 77.6 }, ctx);
```

Inputs and outputs are validated with Zod. Failures throw
`ContractValidationError` with the offending `ZodIssue[]` and a
`phase: "input" | "output"` marker for observability.

## Backward Compatibility

`registerContract` also mirrors the contract into the manifest registry, so:

- `getCapability(id)`, `listCapabilities()`, `setCapabilityHealth()` still work.
- `decide({ capabilityId, input, ctx })` continues to route through the
  Decision Engine → Policy Engine → capability invoke pipeline, and now
  benefits from schema validation.
- Nothing in TIE, AI Core, or existing routes changed.

## Default Contracts

All 19 seeded capabilities from Milestone 5.1 (planner, budget, weather,
maps, flights, hotels, restaurants, experiences, packing, translator, visa,
booking, safety, emergency, notifications, calendar, currency, reviews,
analytics) now have contracts registered at lifecycle `experimental`. Each
feature milestone attaches a real handler and promotes its contract via
`transitionLifecycle(id, "beta" | "stable")`.

## Definition of Done

- [x] TypeScript typechecks
- [x] Build succeeds
- [x] Zod-validated contract system implemented
- [x] Lifecycle state machine with guarded transitions
- [x] Default contracts registered for all seeded capabilities
- [x] Deprecation policy with runtime warning events
- [x] Backward compatibility preserved (existing APIs unchanged)
- [x] Documentation added (`docs/TIOS_CONTRACTS.md`)
