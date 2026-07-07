# Travel Intelligence Capabilities (Phase 2)

First generation of Travel Intelligence Capabilities. Every capability is
registered with TIOS as a strongly-typed contract, invoked through
`invokeContract`, and exposed to UI code through the Capabilities SDK.

Never bypass the SDK. UI code MUST NOT import service files or TIOS
internals directly.

## Architecture

```text
UI / Route
    │
    ▼
Capabilities SDK  ──►  ExecutionContext  ──►  invokeContract (TIOS)
                                                  │
                        Input validated ─────────►│
                                                  ▼
                                          Capability Handler
                                            (service.ts)
                                                  │
                        Emits typed capability event
                        Emits TIOS domain event
                                                  ▼
                                          Output validated
                                                  │
                                                  ▼
                                          Structured DTO
```

Every capability:
- Registers a `CapabilityContract` (`contract.ts`) — Zod input/output schemas,
  lifecycle, SLA, retry, cost, security, feature flags.
- Implements pure logic (`service.ts`) with no direct provider access.
- Exposes a typed client (`sdk.ts` → `capabilitiesClient.<name>`).
- Emits domain events (`PlannerGenerated`, `BudgetCalculated`,
  `RecommendationCreated`, `WeatherAnalyzed`, `SearchCompleted`,
  `MapResolved`).

## Capabilities

### Planner (`planner`)
Extracts intent from natural language (destination, duration, budget, style,
companions, season, constraints) and emits a structured `PlannerOutput`:
journey summary, day-by-day timeline, budget estimate, recommendations,
risks, packing suggestions, follow-up questions, alternatives. Every
activity is marked `editable: true`. Populates TIE — never independent
state.

### Budget (`budget`)
Estimates, tracks, forecasts, and optimises trip spending. Supports
currency conversion, per-category breakdown, overspend alerts, savings
suggestions, and an optimisation score.

### Recommendation (`recommendation-engine`)
Six-stage pipeline: Context → Knowledge → Business Rules → Ranking →
AI Enhancement → Explainability. Emits `score`, `confidence`, `reasons`,
`antiReasons`. Never returns raw AI output — AI is one stage, not the
source of truth.

### Weather (`weather`)
Provider-independent interface for forecast, climate summary, travel
warnings, packing hints, activity suitability, and risk assessment.
Providers attach through the TIOS Provider Matrix.

### Map (`maps`)
Provider-independent geospatial operations: route, nearby, distance,
travel time, pins, saved places, heatmap.

### Search (`search-engine`)
Semantic search architecture across destinations, experiences, hotels,
restaurants. Detects intent (`browse | compare | book | learn | plan`),
ranks results, returns suggestions.

## Flows

### Planner flow
```text
prompt ──► extractIntent ──► buildTimeline
                       └──► budgetEstimate
                       └──► recommendations (via recommendation-engine)
                       └──► risks + packing + questions + alternatives
                       └──► PlannerOutput  ──►  TIE.updateJourney
```

### Budget flow
```text
expenses + duration + style ──► perDay estimate
                              └──► category variance
                              └──► burn-rate forecast
                              └──► alerts + savings + optimisation
```

### Recommendation flow
```text
input ──► stageContext ──► stageKnowledge ──► stageRules
      └──► stageRanking ──► stageAI (optional) ──► stageExplain
```

### Weather flow
```text
destination + dates ──► deterministic seed forecast ──► warnings + packing
                                                    └──► activity suitability
                                                    └──► overall risk
```

### Search flow
```text
query ──► intentOf ──► scope filter ──► term scoring ──► ranked hits
                                    └──► suggestions
```

### Map flow
```text
operation + coords ──► haversine + mode kph ──► distance / time
                                            └──► polyline / pins / heatmap
```

## API Contracts

All schemas live under `src/lib/capabilities/<name>/types.ts` and are Zod.
Contract IDs registered with TIOS:

| Capability | Contract ID           | Lifecycle |
| ---------- | --------------------- | --------- |
| Planner    | `planner`             | beta      |
| Budget     | `budget`              | beta      |
| Recommend. | `recommendation-engine` | beta    |
| Weather    | `weather`             | beta      |
| Map        | `maps`                | beta      |
| Search     | `search-engine`       | beta      |

## Events

Typed capability events (`CapabilityEvent`) mirror into the TIOS event bus
as `DECISION_CREATED` domain events with a `capabilityEvent` discriminator,
so any existing TIOS observability sink already sees them.

## Extensibility

- Providers attach through `src/lib/tios/provider-matrix.ts` — capabilities
  do not import providers directly.
- AI stages call AI Core via the recommendation pipeline's AI stage;
  no capability calls a model provider directly.
- New capabilities follow the same shape and register via
  `registerContract(...)` — no core changes required.
