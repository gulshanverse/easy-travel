# Travel Intelligence Operating System (TIOS)

**Milestone 5.1 — platform architecture (no UI, no bookings, no breaking changes).**

TIOS is the central intelligence coordinator for Easy Trip. Nothing calls
providers or the AI Core directly; every intelligent request flows through
TIOS so decisions can be governed, explained, observed, and evolved.

```
UI / API
   │
   ▼
Travel Intelligence Operating System  ← this milestone
   │
   ├─ Capability Registry
   ├─ Decision Engine
   ├─ Policy Engine
   ├─ Context Graph
   ├─ Knowledge Graph Interfaces
   ├─ Recommendation Pipeline
   ├─ Orchestration Engine
   ├─ Provider Abstraction
   ├─ Feature Flags
   ├─ Event Bus + Observability
   └─ Explainability
   │
   ▼
AI Core  ──►  Travel Intelligence Engine  ──►  Providers
```

## Modules

| File | Purpose |
| --- | --- |
| `types.ts` | Shared TIOS types (capabilities, policies, decisions, graph, knowledge). |
| `events.ts` | OS-level event bus (`CAPABILITY_REGISTERED`, `DECISION_CREATED`, `PROVIDER_SELECTED`, …). |
| `flags.ts` | Feature flag registry with in-memory overrides. |
| `registry.ts` | Capability manifests + health, seeded with 19 default capabilities. |
| `policy.ts` | Rule engine with `allow` / `deny` / `warn` effects. |
| `context-graph.ts` | Dynamic in-memory graph of user/trip/environment nodes. |
| `knowledge.ts` | Knowledge-graph provider interfaces (future entities documented). |
| `recommendation.ts` | Context → Knowledge → Rules → Ranking → AI → Explain pipeline. |
| `decision-engine.ts` | Single decision request orchestrator. |
| `orchestrator.ts` | Workflow engine (sequential/parallel, retries, timeouts, compensation, cancellation). |
| `providers.ts` | Ranked provider adapters with failover semantics. |
| `explainability.ts` | Human-readable explanations from decisions & recommendations. |
| `observability.ts` | In-memory metrics wired through the event bus. |
| `index.ts` | Barrel export — the public TIOS surface. |

## Capability Registry

Every capability declares an ID, version, dependencies, permissions, supported
agents/providers, priority, and feature flags. Nineteen default capabilities
are seeded (Planner, Budget, Weather, Maps, Flights, Hotels, Restaurants,
Experiences, Packing, Translator, Visa, Booking, Safety, Emergency,
Notifications, Calendar, Currency, Reviews, Analytics).

Capabilities can attach an `invoke` implementation later without changing
callers.

## Decision Engine flow

```
DecisionRequest
   │
   ▼
Capability lookup ──► Feature flag gate ──► Policy evaluate
                                                │
                                                ▼
                                          Capability.invoke
                                                │
                                                ▼
                                    Explanation + Metrics + DECISION_CREATED
```

## Policy Engine

Rules are pure functions over `(input, DecisionContext)` with effects
`allow` / `deny` / `warn`. A single deny short-circuits. Default rules cover
budget-exceeded, archived-trip write blocking, severe weather warnings, and
accessibility.

## Context Graph

Nodes: user, trip, destination, companion, budget, weather, booking,
preference, time, device, language, currency.
Edges: `travelling_to`, `prefers`, `contains`, `belongs_to`, `depends_on`,
`scheduled_at`.
`buildGraph(seed)` produces a per-request graph; `snapshot()` gives an
immutable view for downstream layers.

## Knowledge Graph interfaces

Providers register with `registerKnowledgeProvider` and declare which
entities they support (country, city, airport, hotel, weather, visa,
currency, medical, embassy, …). The full graph is intentionally out of scope
for this milestone.

## Recommendation Pipeline

`Context → Knowledge → Business Rules → Ranking → AI Enhancement →
Explainability → User`. Scoring blends base relevance, policy penalties, and
context boost. Diversification runs round-robin by type. AI enhancement is
optional and injected as a function.

## Orchestration Engine

`runWorkflow` executes groups of steps sequentially or in parallel with
per-step retries, timeouts, cancellation via `AbortSignal`, and automatic
compensation on failure.

## Provider Abstraction

Adapters register per capability with priority and health. `callCapabilityProvider`
selects the highest-priority healthy provider, falls back, and emits
`FAILOVER_OCCURRED`.

## Feature Flags

`getFlag` / `setFlag` for `PlannerV2`, `BudgetV2`, `Claude`, `Gemini`,
`OpenAI`, `Weather`, `Maps`, `KnowledgeGraph`, `DecisionEngine` and custom
flags.

## Event Bus events

`CAPABILITY_REGISTERED`, `CAPABILITY_UPDATED`, `CAPABILITY_HEALTH_CHANGED`,
`DECISION_CREATED`, `POLICY_MATCHED`, `POLICY_DENIED`, `CONTEXT_UPDATED`,
`RECOMMENDATION_CREATED`, `WORKFLOW_STARTED`, `WORKFLOW_COMPLETED`,
`WORKFLOW_FAILED`, `PROVIDER_SELECTED`, `FAILOVER_OCCURRED`, `FLAG_EVALUATED`.

## Observability

`readMetricsSnapshot()` returns capability usage, decision latency histogram,
policy match/deny counters, workflow durations, provider failures,
recommendation counts, and flag evaluations.

## Explainability

Every decision and recommendation produces an `Explanation` with `summary`,
`reasons` (WHY), `antiReasons` (WHY NOT), `alternatives`, and `confidence`.
`explanationToMarkdown` renders it for UI or logs.

## Architecture Decision Record (ADR-5.1)

- **Additive-only.** TIOS ships as new modules under `src/lib/tios/` and
  does not modify existing TIE, AI Core, or route surfaces.
- **In-memory registries** for capabilities, policies, providers, flags, and
  metrics. Persistence to Cloud tables is a later milestone; call sites will
  not change.
- **Event-driven observability.** Metrics are derived from the TIOS event bus
  so shipping to Cloud analytics is a listener swap.
- **No AI in the core loop.** The Decision Engine and Recommendation
  Pipeline never call AI directly — AI enhancement is an injected function,
  keeping the core deterministic and testable.
- **Backward compatibility guaranteed.** Existing APIs (`tieClient`,
  `aiClient`, RPC surface) are untouched.

## Definition of Done

- [x] TypeScript typechecks
- [x] Build succeeds
- [x] Documentation added (`docs/TIOS.md`)
- [x] No breaking changes to existing APIs
- [x] New APIs documented in the barrel export
