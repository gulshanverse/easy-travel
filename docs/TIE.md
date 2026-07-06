# Travel Intelligence Engine (TIE)

The Travel Intelligence Engine is the domain core of Easy Trip. It owns the
full lifecycle of a journey — from empty draft to booked, in-progress and
archived — and coordinates every intelligent capability that plugs into the
platform. TIE never renders UI; it is pure business orchestration on top of
Lovable Cloud and the AI Core.

> AI Agents provide intelligence. TIE owns orchestration.

---

## 1. Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  UI layer (routes, components, hooks)                       │
│  imports only: src/lib/tie/sdk.ts                           │
└─────────────────────────────────────────────────────────────┘
                        │  tieClient.*
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Server-function surface (tie.functions.ts)                 │
│  - Zod validation, auth (requireSupabaseAuth)               │
│  - Dynamic import of *.server.ts handlers                   │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Orchestration: TravelIntelligenceService                   │
│  (composes every domain service, guards ownership,          │
│   snapshots on state transitions, exposes aggregates)       │
└─────────────────────────────────────────────────────────────┘
   │        │        │        │        │        │        │
   ▼        ▼        ▼        ▼        ▼        ▼        ▼
Journey  Timeline Activity Budget  Dest   Recs   Collab
Service  Service  Service  Service Insight Service Service
   │        │        │        │        │        │        │
   └────────┴────────┴────────┼────────┴────────┴────────┘
                              ▼
                    ┌─────────────────────┐
                    │  Lovable Cloud DB   │
                    │  (trips, days,      │
                    │  activities,        │
                    │  itineraries,       │
                    │  ai_recommendations)│
                    └─────────────────────┘

           AI Core ─── runAgent() ───► TIE Recommendation Service
           Event Bus ◄── emitTIEEvent() ── every service
```

---

## 2. Modules

| Module | File | Purpose |
| --- | --- | --- |
| Types | `src/lib/tie/types.ts` | Domain types, DB row aliases, `JourneyState`, transitions, `TIEResult<T>` envelope |
| Event Bus | `src/lib/tie/events.ts` | `emitTIEEvent`, `onTIEEvent` — bridged onto AI event bus for unified observability |
| Journey | `src/lib/tie/journey.server.ts` | CRUD + lifecycle state machine + cloning |
| Timeline | `src/lib/tie/timeline.server.ts` | Assembles days + activities, detects overlaps/gaps, drag/move |
| Activity | `src/lib/tie/activity.server.ts` | CRUD for flights, hotels, meals, experiences, transit, notes |
| Budget | `src/lib/tie/budget.server.ts` | Estimated vs actual, per-category rollup, warnings, FX plug-in |
| Destination | `src/lib/tie/destination.server.ts` | Insight aggregation, weather/safety provider interfaces |
| Recommendations | `src/lib/tie/recommendation.server.ts` | Bridge to AI Core `runAgent`; persistence, dedup, dismiss/click |
| Collaboration | `src/lib/tie/collaboration.server.ts` | Invite/roles/remove via `trip_companions` |
| Version | `src/lib/tie/version.server.ts` | Immutable itinerary snapshots, diff, rollback |
| Export | `src/lib/tie/export.server.ts` | ICS, JSON, share-link, offline bundle |
| Maps | `src/lib/tie/maps.ts` | Provider-agnostic `MapService/RouteService/DistanceService/NearbySearchService` |
| Orchestrator | `src/lib/tie/orchestrator.server.ts` | `TravelIntelligenceService` — composes everything |
| Server fns | `src/lib/tie/tie.functions.ts` | Typed `createServerFn` surface |
| Client SDK | `src/lib/tie/sdk.ts` | Frontend-facing `tieClient` |

---

## 3. Journey Lifecycle

TIE aligns 1:1 with the `trip_status` DB enum:

```
        ┌──────────┐
        │  draft   │◄────────────────┐
        └────┬─────┘                 │
             │                       │
             ▼                       │
        ┌──────────┐    ┌────────────┴───┐
        │ planning │◄──►│    archived    │
        └────┬─────┘    └────────▲───────┘
             │                   │
             ▼                   │
        ┌──────────┐             │
        │confirmed │             │
        └────┬─────┘             │
             │                   │
             ▼                   │
        ┌──────────┐             │
        │in_progress│            │
        └────┬─────┘             │
             │                   │
             ▼                   │
        ┌──────────┐             │
        │completed │─────────────┘
        └──────────┘
         (cancelled reachable from any active state)
```

`JourneyService.transition()` refuses any transition that isn't in
`JOURNEY_TRANSITIONS`. Major transitions (`confirmed`, `in_progress`,
`completed`) auto-snapshot via `VersionService`.

---

## 4. Timeline Flow

```
build(tripId)
   │
   ├─ fetch trips.currency
   ├─ fetch trip_days (order: day_index)
   ├─ fetch trip_activities (order: position)
   │
   ├─ group activities by trip_day_id → Map
   ├─ split scheduled vs unscheduled
   │
   ├─ per day:
   │    ├─ toEvent(...)
   │    ├─ detectConflicts(events)    // overlap, missing-time
   │    ├─ totals: cost, duration
   │
   └─ return Timeline { days[], unscheduled[], totals }
```

`moveActivity` and `reorderDay` update `trip_day_id` and `position`, then
emit `ACTIVITY_MOVED` and `TIMELINE_UPDATED`.

---

## 5. Budget Flow

Estimated cost comes from `trip_activities.cost_cents`.
Actual spend comes from `booking_items.total_cents`, joined via
`bookings.trip_id` (currency taken from the parent booking).

```
summarize(tripId)
   ├─ trip: currency, budget_total_cents, traveler_count, dates
   ├─ activities: cost_cents, currency, activity_type   → estimated
   ├─ bookings + items: total_cents, currency, item_type → actual
   ├─ FX-normalize both streams to trip currency
   ├─ rollup by category (transport / lodging / food / activities / other)
   ├─ compute per-day, per-traveler
   ├─ warnings: no-budget-set | near-limit (≥85%) | over-budget
   └─ emit BUDGET_CHANGED (+ BUDGET_WARNING for actionable ones)
```

The FX provider is pluggable (`CurrencyConverter`); the default is
`identityConverter`. A real provider slots in without touching callers.

---

## 6. Recommendation Flow

```
UI ──► tieClient.generate(...)  (future exposure)
         │
         ▼
RecommendationService.generate({ agent, subjectKind, subjectId, input, userId })
         │
         ├─► AI Core runAgent(agent, input, { userId, feature: 'tie.recommendation' })
         │       (AI Core owns prompt, tools, safety, memory, usage)
         │
         ├─► normalize output   → RawSuggestion[]
         │
         └─► for each suggestion:
                 insert into ai_recommendations
                 emit AI_RECOMMENDATION_CREATED
```

Business logic (what to recommend) lives in the AI agent. TIE owns
**storage, visibility, dedup, and lifecycle** only (`dismiss`, `click`,
`expiresAt`).

---

## 7. Event-Driven Architecture

Every TIE service emits domain events via `emitTIEEvent`. TIE events are
bridged onto the AI event bus (`TIE:` prefix) so a single instrumentation
pipeline observes AI + domain lifecycle.

Events emitted:

```
TRIP_CREATED             DAY_ADDED                COLLABORATOR_ADDED
TRIP_UPDATED             DAY_UPDATED              COLLABORATOR_ROLE_CHANGED
TRIP_STATE_CHANGED       DAY_REMOVED              COLLABORATOR_REMOVED
TRIP_DELETED             ACTIVITY_ADDED           VERSION_CREATED
BUDGET_CHANGED           ACTIVITY_UPDATED         VERSION_ROLLED_BACK
BUDGET_WARNING           ACTIVITY_MOVED           EXPORT_CREATED
AI_RECOMMENDATION_       ACTIVITY_REMOVED         BOOKING_LINKED
   CREATED               TIMELINE_UPDATED         BOOKING_UNLINKED
AI_RECOMMENDATION_APPLIED
```

Subscribe from anywhere (server or client):

```ts
import { onTIEEvent } from "@/lib/tie";
onTIEEvent("TRIP_STATE_CHANGED", (e) => notify(e.tripId, e.data));
```

---

## 8. AI Integration

TIE **never bypasses AI Core**. Every producer is an AI Core agent
(`planner`, `budget`, `recommendation`, `weather`, `safety`, `translator`,
`booking`, `memory`, `general`) reached through `runAgent()`. TIE owns:

- The *when* — orchestration triggers and lifecycle hooks.
- The *where* — persistence into `ai_recommendations`, `itineraries`, `trips`.
- The *who* — user ownership guards and RLS-authenticated Supabase client.

---

## 9. Maps

Maps are behind provider-agnostic interfaces in `src/lib/tie/maps.ts`:

- `MapService.geocode / reverseGeocode`
- `RouteService.route / optimize`
- `DistanceService.matrix`
- `NearbySearchService.nearby`

Register a concrete provider (Google, Mapbox, OSM) later with
`registerMapProvider({ map, route, distance, nearby })`. Until then a
`NotConfigured` stub throws a clear error on use.

---

## 10. Public API Contracts (SDK)

```ts
tieClient.createTrip({ title, ... })          → { tripId, version }
tieClient.listTrips()                         → TripRow[]
tieClient.getTrip(tripId)                     → full snapshot
tieClient.advanceTrip(tripId, next)           → { state, version? }
tieClient.cloneTrip(tripId)                   → TripRow

tieClient.buildTimeline(tripId)               → Timeline
tieClient.moveActivity(id, dayId, pos)        → TripActivityRow
tieClient.createActivity({...})               → TripActivityRow
tieClient.removeActivity(id)                  → { id, tripId }

tieClient.budgetSummary(tripId)               → BudgetSummary
tieClient.setBudget(tripId, cents, currency?) → { id }

tieClient.listRecommendations(subjectKind?)   → Recommendation[]
tieClient.dismissRecommendation(id)           → { id }

tieClient.inviteCollaborator(tripId, uid, role) → Collaborator
tieClient.listVersions(tripId)                → JourneyVersion[]
tieClient.rollback(tripId, version)           → { appliedVersion }
tieClient.export(tripId, format, baseUrl?)    → ExportResult
```

Every call returns a `TIEResult<T>` — `{ ok: true, data }` or
`{ ok: false, error: { code, message, cause? } }` — safe across the RPC
boundary.

---

## 11. Sequence — Create-then-Recommend

```
UI ─► tieClient.createTrip
       │
       ▼
   createTripFn  ─► TravelIntelligenceService.createJourney
                       ├─ JourneyService.create           (emit TRIP_CREATED)
                       └─ VersionService.snapshot         (emit VERSION_CREATED, v1)
       ◄── { tripId, version: 1 }

UI ─► tieClient.listRecommendations('trip')
       │
       ▼
   listRecommendationsFn  ─► RecommendationService.list
       ◄── Recommendation[]

(future) UI or agent trigger ─► RecommendationService.generate
       ├─ runAgent('recommendation', input, ctx)   (AI Core)
       ├─ persist to ai_recommendations
       └─ emit AI_RECOMMENDATION_CREATED
```

---

## 12. Architecture Decisions

1. **State machine is DB-enum-backed.** `JourneyState = trip_status` — one
   source of truth, no drift.
2. **Result envelope is serializable.** `TIEResult<T>.error.cause` is a
   string, not `unknown` — safe across TanStack Start's RPC serializer.
3. **Metadata typed as `Record<string, any>`.** `unknown` is rejected by
   the RPC serializer; `any` in domain payloads is a pragmatic tradeoff.
4. **Server files never re-exported from the barrel.** `src/lib/tie/index.ts`
   re-exports client-safe modules only. Server code is loaded via dynamic
   `import()` inside server-function handlers.
5. **AI orchestration is agent-first.** TIE never inlines prompts or model
   calls; all intelligence flows through AI Core's `runAgent`.
6. **Events bridge onto AI bus.** One observability pipeline for both
   AI lifecycle and domain lifecycle.
7. **Maps stay behind interfaces until a provider is chosen.** Prevents
   premature lock-in.
8. **Snapshots on major state changes.** Rollback and diff work from day 1.

---

## 13. Files Created

- `src/lib/tie/types.ts`
- `src/lib/tie/events.ts`
- `src/lib/tie/journey.server.ts`
- `src/lib/tie/timeline.server.ts`
- `src/lib/tie/activity.server.ts`
- `src/lib/tie/budget.server.ts`
- `src/lib/tie/destination.server.ts`
- `src/lib/tie/recommendation.server.ts`
- `src/lib/tie/collaboration.server.ts`
- `src/lib/tie/version.server.ts`
- `src/lib/tie/export.server.ts`
- `src/lib/tie/maps.ts`
- `src/lib/tie/orchestrator.server.ts`
- `src/lib/tie/tie.functions.ts`
- `src/lib/tie/sdk.ts`
- `src/lib/tie/index.ts`
- `docs/TIE.md`

## 14. Remaining Risks & Next Steps

- **Weather / Safety providers** are interfaces only — wire real vendors
  during the Destination Intelligence milestone.
- **FX converter** is identity — plug a real rate provider before shipping
  multi-currency trips.
- **PDF export** returns the offline JSON payload; a downstream Playwright
  or print worker should materialize the actual PDF.
- **Rollback** replaces days+activities atomically at the app level but does
  not run inside a DB transaction; failure recovery relies on the next
  snapshot. Move to a Postgres function once traffic warrants it.
- **`Record<string, any>` in payloads** loses type-safety on the wire —
  narrow to per-agent Zod schemas as the recommendation UIs come online.

## 15. Recommended Milestone 6

**Planner Agent v1 on top of TIE.** Wire the `planner` agent to
`TravelIntelligenceService.createJourney`, produce a structured itinerary,
persist through `TripDay` + `TripActivity` writes, snapshot via
`VersionService`, and surface via `tieClient`. All existing UI routes then
become thin views over the SDK — zero business logic in components.
