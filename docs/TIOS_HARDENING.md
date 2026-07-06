# TIOS 5.3 — Platform Hardening & Architecture Freeze

**This is the final foundational milestone.** After 5.3, the platform
architecture is frozen. Future milestones extend the platform via
capabilities, providers, and product features — not by adding new
architectural layers.

## Modules added

| File | Responsibility |
| --- | --- |
| `execution-context.ts` | Universal `ExecutionContext` (correlation, tracing, security, deadlines, cancellation). Extends `DecisionContext` — source-compatible. |
| `dependency-graph.ts` | `analyzeDependencies`, `resolveDependencies`. Cycle + missing-dep detection, topological order. |
| `provider-matrix.ts` | `(capability → provider)` mapping with priority, health, and `selectProvider()`. |
| `domain-events.ts` | Strongly typed `DomainEvent` union with `emitDomainEvent(ctx, name, payload)` and `onDomainEvent(name, listener)`. |
| `resilience.ts` | `CircuitBreaker`, `withRetry`, `withTimeout`, `withFallback`, `Bulkhead`, `abortableTimeout`. |
| `cost-governance.ts` | Daily/monthly/per-user/per-capability/provider budgets. Emergency stop. |
| `health.ts` | `readPlatformHealth()` aggregating capability/provider/workflow/AI/DB probes. |
| `validation.ts` | `validateArchitecture()` + `assertArchitectureHealthy()` for CI. |
| `plugin.ts` | `defineCapability()` builder, `CapabilityPlugin` base class, install/uninstall lifecycle. |

## Extended `CapabilityContract`

All new fields are optional to preserve backward compatibility:

- `requiredPolicies`, `requiredTools`
- `failureModes`, `fallbackStrategy`, `retryStrategy`
- `sla`, `latencyTargetMs`
- `costCategory`, `securityClassification`
- `ownerModule`, `docsUrl`
- `deprecation.replacedBy`, `deprecation.sunsetAt`, `deprecation.reason`

## Architecture flow

```
                ExecutionContext (universal request object)
                          │
                          ▼
             ┌────────────────────────────┐
             │        TIOS Core           │
             │                            │
             │  Capability Registry       │
             │  Capability Contracts      │◄─── validation.ts (CI gate)
             │  Dependency Graph          │
             │  Policy Engine             │
             │  Decision Engine           │
             │  Recommendation Pipeline   │
             │  Provider Matrix           │───► Provider Adapters
             │  Cost Governance           │
             │  Resilience Primitives     │
             │  Domain Events + Bus       │
             │  Observability + Health    │
             └────────────────────────────┘
                          │
                          ▼
           Travel Intelligence Engine  •  AI Core  •  Providers
```

## Plugin authoring example

```ts
import { defineCapability, z, CapabilityPlugin, type DecisionContext } from "@/lib/tios";

const contract = defineCapability("packing")
  .displayName("Packing Assistant")
  .version("1.0.0")
  .description("Generates a packing list from weather + trip.")
  .category("assistance")
  .lifecycle("beta")
  .input(z.object({ tripId: z.string() }))
  .output(z.object({ items: z.array(z.string()) }))
  .dependsOn("weather")
  .requiredPolicies("trip.archived.readonly")
  .fallback("cached")
  .retry({ maxAttempts: 2, backoffMs: 250, jitter: true })
  .sla({ availability: 0.99, p95LatencyMs: 1200 })
  .latencyTarget(800)
  .costCategory("low")
  .securityClassification("internal")
  .owner("packing-team")
  .docs("/docs/capabilities/packing.md")
  .handler(async () => ({ items: [] }))
  .build();

class PackingPlugin extends CapabilityPlugin<
  { tripId: string }, { items: string[] }
> {
  readonly contract = contract;
  async execute() { return { items: [] }; }
}

new PackingPlugin().install();
```

## Cost governance

```ts
import { configureCostLimits, setProviderQuota, guardCost, recordSpend } from "@/lib/tios";

configureCostLimits({ dailyBudget: 200, monthlyBudget: 5000, perUserDaily: 5 });
setProviderQuota({ providerId: "openai", dailyLimit: 100 });

const decision = guardCost({ cost: 0.02, userId, capabilityId: "planner", providerId: "gemini" });
if (!decision.allowed) throw new Error(decision.reason);
// … perform AI call …
recordSpend({ cost: 0.02, userId, capabilityId: "planner", providerId: "gemini" });
```

## Resilience composition

```ts
import { CircuitBreaker, withRetry, withTimeout, withFallback } from "@/lib/tios";

const breaker = new CircuitBreaker("weather.openmeteo", { failureThreshold: 5, cooldownMs: 30_000 });

const result = await withFallback(
  () => breaker.execute(() =>
    withTimeout(
      () => withRetry(() => fetchForecast(...), { maxAttempts: 3, backoffMs: 200, jitter: true }),
      1500,
    ),
  ),
  () => getCachedForecast(...),
);
```

## Architecture Decision Record — ADR-5.3 (Freeze)

- **Additive only.** No breaking changes; every earlier API works unchanged.
- **Contracts are the platform's public shape.** All new fields on
  `CapabilityContract` are optional, defaulted, and validated at registration.
- **No direct capability-to-capability calls.** All traversal goes through
  the dependency graph and the decision engine.
- **No direct capability-to-provider calls.** All selection routes through
  the provider matrix with health + priority + policy filters.
- **Universal request object.** Every capability, workflow, tool, and AI call
  accepts an `ExecutionContext`. `DecisionContext` remains as an alias
  contract for older sites.
- **Cost, resilience, health, validation are first-class.** No feature code
  hardcodes retries, timeouts, budgets, or health checks.
- **Freeze rule.** Future milestones may add capabilities, providers,
  contracts, policies, flags, and knowledge providers. They must not
  introduce new architectural layers.

## Platform Readiness Report

| Area | Status |
| --- | --- |
| Capability Registry | ✅ 19 contracts registered (all lifecycle: experimental) |
| Contract System | ✅ Zod-validated I/O, lifecycle FSM, deprecation policy |
| Dependency Graph | ✅ Cycle / missing / topological order detection |
| Provider Matrix | ✅ Seeded for planner, weather, flights, maps |
| Execution Context | ✅ Correlation, tracing, security, cancellation |
| Domain Events | ✅ 14 typed events (Journey, Activity, Workflow, Provider, Booking) |
| Resilience | ✅ Circuit breaker, retry, timeout, fallback, bulkhead |
| Cost Governance | ✅ Multi-scope budgets + emergency stop |
| Health Interfaces | ✅ Capability, provider, workflow, AI, DB, memory probes |
| Architecture Validation | ✅ `validateArchitecture()` + `assertArchitectureHealthy()` |
| Plugin Architecture | ✅ Fluent builder + `CapabilityPlugin` base class |
| Backward Compatibility | ✅ Every existing API works unchanged |
| Documentation | ✅ `docs/TIOS_HARDENING.md`, `docs/TIOS_CONTRACTS.md`, `docs/TIOS.md` |
| Typecheck | ✅ `tsgo --noEmit` |

## Remaining technical debt (tracked, not blocking)

1. Persistence — cost governance, plugin registry, and health probes are
   in-memory; persisting to Cloud tables is a swap-in per module.
2. Distributed tracing sink — `TracingMetadata` is captured but not shipped
   to an external collector yet (OTel exporter is a listener).
3. Knowledge graph is interface-only; concrete providers land per-capability.
4. Domain events flow through the generic bus for observability; a dedicated
   event store (Cloud table + replay) is future work.

## Confirmation

**The platform is ready for capability development.**

Next milestone should be Planner Agent v1 — attach a real handler to the
`planner` contract, promote its lifecycle to `beta`, and wire the
`/ai-planner` UI through `invokeContract("planner", ...)`.
