# Journey Intelligence Platform (JIP) v1.0

**Architecture & Systems Specification — Definitive Blueprint**

Status: Architecture-only. No implementation. No UI. No code.
Scope: Additive to AI Core, TIOS, TIE, Journey Graph, World Knowledge, and JIA v1.0.
Governing docs (frozen): `docs/AI_CORE.md`, `docs/TIOS.md`, `docs/TIE.md`, `docs/JOURNEY_INTELLIGENCE_ARCHITECTURE.md`, `docs/JOURNEY_STUDIO_PRD*.md`.

This document specifies the ten missing subsystems required to operate Easy Trip as a durable, explainable, evolving intelligence platform. It defines module boundaries, contracts, data flow, and integration points — not implementations.

---

## 0. Placement Within Existing Architecture

```text
                ┌───────────────────────────────────────────────┐
                │                  Journey Studio               │  (UI — frozen)
                └───────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Journey Intelligence Platform (JIP)                  │
│                                                                         │
│   Lifecycle Model  ◄──────►  Intelligence Bus  ◄──────►  Evaluation     │
│         │                          ▲                        ▲           │
│   ┌─────┴──────┐   ┌──────────┐    │    ┌──────────────┐    │           │
│   │ Observation│──►│ Memory   │────┼───►│ Prompt       │────┘           │
│   │  Engine    │   │ Hierarchy│    │    │ Orchestrator │                │
│   └────────────┘   └──────────┘    │    └──────┬───────┘                │
│                                    │           │                        │
│                    ┌──────────────┐│    ┌──────▼──────┐                 │
│                    │ Confidence   ├┼───►│ Tool Router │                 │
│                    │ Engine       ││    └──────┬──────┘                 │
│                    └──────────────┘│           │                        │
│                    ┌───────────────┴┐   ┌──────▼────────┐               │
│                    │ Recommendation │◄──┤ Explainability│               │
│                    │ Engine         │   │ Framework     │               │
│                    └────────────────┘   └───────────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
      AI Core ──── TIOS ──── TIE ──── Journey Graph ──── World Knowledge
```

**Boundary rules.** JIP is a coordination and reasoning layer. It never bypasses TIOS capability contracts, never calls providers directly (TIE does), and never mutates the Journey Graph outside TIE. It owns *how* the system thinks; TIOS owns *what capabilities exist*; TIE owns *how the world is reached*; AI Core owns *how models are called*.

---

## 1. Memory Hierarchy

### 1.1 Tiers

| Tier | Scope | Lifetime | Storage substrate | Purpose |
|---|---|---|---|---|
| **Working Memory (WM)** | Single request/turn | Milliseconds → seconds | Ephemeral (in-process) | Active tool results, partial reasoning, in-flight tokens |
| **Session Memory (SM)** | One user session / conversation | Minutes → hours | `conversation_memory` (scope=`short_term`) | Turn-to-turn continuity, current focus, unresolved intents |
| **Journey Memory (JM)** | One Journey (trip) | Journey lifetime + 90d | `conversation_memory` (scope=`trip`) + Journey Graph | Decisions, constraints, bookings, revisions, artefacts |
| **Cross-Journey Memory (CJM)** | Per user across journeys | Years (user-owned) | `conversation_memory` (scope=`long_term`) | Patterns spanning multiple trips (e.g. "always books aisle seat") |
| **Journey DNA (DNA)** | Per user, distilled | Permanent, versioned | `conversation_memory` (scope=`preference`, high importance) | Stable traveller model: values, thresholds, aesthetics, red-lines |
| **Global Anonymous Learning (GAL)** | Population-level | Rolling windows | Aggregated, k-anonymised store (future) | Priors: "solo travellers in Kyoto in Nov prefer …" |

All tiers are **read through the Memory Engine** (`src/lib/ai/memory.server.ts` today) via a single retrieval API; no consumer knows the tier boundaries.

### 1.2 Promotion rules (evidence → durable)

Promotion is event-driven, never time-driven alone. Each promotion requires a *promotion event* + *confidence threshold* + *repetition or explicit act*.

| From → To | Trigger | Threshold | Notes |
|---|---|---|---|
| WM → SM | Turn commit | Always, if referenced ≥1 downstream call | Retained as short_term for session TTL |
| SM → JM | Bound to a Journey entity (activity, booking, day) | `confidence ≥ 0.6` OR explicit user action | Written through TIE so Journey Graph is source of truth |
| JM → CJM | Pattern observed in ≥ 2 journeys OR explicit "remember this" | `confidence ≥ 0.7` | De-duplicated by semantic key |
| CJM → DNA | ≥ 3 corroborating CJM entries within category OR explicit preference set | `confidence ≥ 0.8`, no contradicting evidence within decay window | Versioned; each DNA revision keeps prior for rollback |
| Any → GAL | k ≥ 50 users, differentially private aggregation | Policy-gated | Never contains raw user text or identifiers |

### 1.3 Eviction rules

- **WM:** discarded at turn end.
- **SM:** TTL (default 24h); LRU cap per user.
- **JM:** retained through Journey `archived_at + 90d`, then compacted into a Journey Summary artefact and cold-stored.
- **CJM:** eviction only on explicit user delete, or on **contradiction decay** (see §5.2): if newer high-confidence evidence contradicts an entry for N observations, the entry is retired (kept in shadow for audit, not returned by retrieval).
- **DNA:** never auto-deleted; superseded by a new version. User can revoke a version.
- **GAL:** rolling aggregation windows; raw contributors expire per policy.

### 1.4 Retrieval strategy

Retrieval is a **layered union with tier-aware weighting**, executed once per prompt assembly:

1. **Intent vector** built from current user turn + active Journey context.
2. Parallel fetch: `top_k(WM) ∪ top_k(SM) ∪ top_k(JM) ∪ top_k(CJM) ∪ top_k(DNA)` — each with independent `k` from prompt policy.
3. **Rerank** by composite score `score = α·semantic + β·recency + γ·importance + δ·tierPrior + ε·confidence`, where `tierPrior` favours DNA > JM > CJM > SM > WM for stable preferences and inverts for situational context.
4. **Contradiction filter:** if two entries conflict, keep the higher-tier or higher-confidence one; the loser is passed to the Observation Engine as a contradiction signal.
5. **Budget clipping:** enforce prompt token budget per §2.4.
6. GAL is *never* retrieved as fact — only as a **prior** consumed by the Confidence Engine and Recommendation Engine.

### 1.5 Interface (informal contract)

```text
MemoryEngine.retrieve(query, {
  userId, journeyId?, sessionId?,
  tiers?: Tier[], budgetTokens?, minConfidence?
}) -> RankedMemoryBundle

MemoryEngine.write(record, { tier, importance, ttl?, source, evidenceIds })
MemoryEngine.promote(recordId, { toTier, evidence, actor })
MemoryEngine.retire(recordId, reason)
```

Backed by, and only by, `src/lib/ai/memory.server.ts` — no consumer touches the DB directly.

---

## 2. Prompt Orchestration Engine (POE)

### 2.1 Responsibilities

POE deterministically assembles the exact input given to any model call — system prompt, capability prompt, memory, tools, schema, and metadata — and records the assembled artefact for evaluation and reproducibility. It is the **only** producer of model inputs.

### 2.2 Prompt layers (composed in strict order)

1. **Platform system prompt** — invariants: identity, safety, neutrality, tone, refusal policy. Versioned globally.
2. **Capability system prompt** — role-specific system prompt for the invoked TIOS capability (planner, budget, recommender, …). Loaded from `prompt_templates` via `src/lib/ai/prompts.server.ts`.
3. **Context frame** — normalized `DecisionContext`: user, journey, locale, time, device, feature flags.
4. **Memory frame** — output of `MemoryEngine.retrieve` (see §1.4), rendered by tier with provenance tags.
5. **World frame** — freshness-stamped facts from World Knowledge (weather, FX, advisories) that the capability declares as required inputs.
6. **Tool frame** — the *subset* of tools this capability is allowed to use, chosen by the Tool Router (§3).
7. **Output schema** — Zod / JSON schema attached via AI SDK `Output` API (see AI SDK rules) or, when the schema is inherently large/dynamic, a documented free-JSON contract with a validating parser.
8. **User turn** — the actual user message / structured request.

### 2.3 Dynamic context assembly

- Assembly is **capability-declarative**: each TIOS capability declares required context slots, optional slots, and hard budgets (already modelled in `CapabilityContract`).
- POE resolves slots by querying: Context Graph (TIOS), Memory Engine (JIP), World Knowledge (TIE), Journey Graph (TIE).
- Missing required slots → capability is short-circuited with a typed `ContextIncomplete` decision, not a hallucinated answer.

### 2.4 Budget & injection policy

- Hard token budget per capability, per model tier.
- Priority order when clipping: platform system > capability system > output schema > user turn > world frame > memory (DNA → JM → CJM → SM) > tool descriptions.
- Tool frame uses **tool deferral** (see AI SDK rules) when the eligible set exceeds catalogue threshold; POE emits a `tool_search` meta-tool instead of full tool schemas.

### 2.5 Versioning

- Every prompt (platform, capability, output schema) is a row in `prompt_templates` with `slug` + monotonic `version` + `is_active`.
- POE resolves at call time (already implemented in `prompts.server.ts`) with in-worker cache.
- Every model call records `{platformPromptVersion, capabilityPromptSlug@version, schemaVersion, memoryBundleHash, toolSetHash}` on the invocation event so any output can be re-derived.
- Rollout uses feature flags (TIOS `flags.ts`): shadow → canary → default → deprecate.

### 2.6 Interface

```text
POE.assemble({ capabilityId, userTurn, context, journeyId?, sessionId? })
  -> AssembledPrompt {
       messages, tools, outputSchema,
       provenance: { versions, memoryBundleHash, toolSetHash, contextHash },
       budget: { promptTokens, maxOutputTokens }
     }
```

---

## 3. Tool Routing Layer (TRL)

### 3.1 Registry

- Tools are declared in a **single Tool Registry** keyed by `toolId`, each with: description, input schema, output schema, side-effect class (`read | mutate | pay | external-notify`), latency SLA, cost class, required scopes, allowed capabilities, `needsApproval` flag.
- Registry is a projection over: TIE providers, TIOS capabilities exposed as callable tools, AI Core internal tools (memory read/write, search).
- No tool can be invoked unless registered.

### 3.2 Capability → tool mapping

- Each capability contract declares `allowedTools: toolId[]` and `preferredTools: toolId[]`.
- TRL enforces intersection with policy engine output (TIOS `policy.ts`); denied tools never enter the tool frame.

### 3.3 Routing strategy

For each tool call requested by a model:

1. **Resolve** — map name → registered tool; reject unknown.
2. **Authorize** — policy check (scopes, RLS, feature flags, needsApproval).
3. **Select provider** — via TIOS provider matrix (priority + health + cost governor).
4. **Plan** — determine if independent tool calls in the batch can run in parallel.
5. **Execute** — with timeout, retry, and failover.
6. **Record** — emit `TOOL_INVOKED` on the Intelligence Bus with duration, cost, result hash.

### 3.4 Parallel execution

- The router treats each tool call as a node in a mini-DAG. Independent nodes (no shared mutations, no ordering constraint, no shared rate-limit bucket) execute concurrently under a per-request concurrency cap.
- Mutating tools serialize per resource key (e.g. `journeyId`).

### 3.5 Failure recovery

Recovery is per **failure class**, not per exception:

| Class | Example | Policy |
|---|---|---|
| Transient | network, 5xx, timeout | Retry (§3.6) then failover to next provider |
| Rate-limited | 429, quota | Backoff with jitter; if budget remains, failover; else degrade |
| Contract | schema mismatch, invalid input | No retry; return typed error to model with corrective hint |
| Policy | denied by policy engine | No retry; return typed refusal |
| Semantic | provider returned empty / low-quality | Try alternate provider; downgrade to cached; expose as `partial` |
| Fatal | credentials, config | Fail-fast; emit incident event |

### 3.6 Retry & timeout policy

- Defaults live on the capability contract (`retryStrategy`, `sla`), overridable per tool.
- Standard: `maxAttempts=2`, exponential backoff base 250–500ms, jitter on, hard timeout = `min(capability.latencyTargetMs × 3, 15s)`.
- Retries are **idempotency-aware**: mutating tools require an idempotency key produced by TRL and passed to the provider.

### 3.7 Interface

```text
ToolRouter.invoke(toolId, input, { capabilityId, requestId, journeyId?, idempotencyKey? })
  -> ToolResult<T> | ToolError

ToolRouter.plan(toolCalls[]) -> ExecutionPlan  // parallel/serial DAG
```

---

## 4. Observation Engine (OBS)

### 4.1 Signal taxonomy

| Kind | Example | Weight prior |
|---|---|---|
| **Explicit** | "I hate early flights", saved preference, deleted suggestion with reason | High |
| **Behavioural** | Accepted a suggestion, dwelled on a card, re-ordered a day, edited a budget line | Medium |
| **Contextual** | Time of day, device, locale switch | Low, modifier only |
| **Outcome** | Post-trip rating, rebooking, cancellation, "regret" click | Very high |
| **Negative** | Dismissed, hidden, undo, ignored after impression | Medium (as anti-signal) |

Signals arrive as events on the Intelligence Bus and are ingested by OBS only from that bus — never from UI code directly.

### 4.2 Evidence collection

Each signal becomes an **Evidence record**: `{ id, userId, journeyId?, kind, source, subject (graph node ref), polarity, magnitude, context, timestamp, confidence }`. Evidence is append-only and referenced by memory promotions, so every DNA fact is traceable to raw evidence.

### 4.3 Preference inference

- Grouping: evidence is bucketed by *facet* (e.g. `flight.time_of_day`, `hotel.style`, `pace.activities_per_day`).
- Inference runs as a per-facet estimator; the initial family is Bayesian updating over a prior (from GAL) with beta/Dirichlet posteriors depending on facet type.
- Output per facet: `{ value, confidence, supportCount, lastUpdated, halfLifeDays }`.

### 4.4 DNA update rules

- A DNA facet is (re)written only when: `confidence ≥ 0.8`, `supportCount ≥ threshold(facet)`, no unresolved contradiction, and the delta from previous value is material.
- Every DNA write produces a new **DNA version**; the diff and evidence bundle are stored for user-facing "Why we think this".
- User can pin, edit, or revoke any facet; pinned facets bypass automated overwrites.

### 4.5 Confidence decay

- Each evidence record carries a `halfLifeDays` per facet (e.g. "budget style" decays slower than "current mood").
- Effective weight at time t: `w(t) = w0 · 2^(-Δt / halfLife)`.
- Facet confidence is recomputed on read or on periodic compaction; decayed-below-threshold facets are demoted from DNA back to CJM.

### 4.6 Interface

```text
OBS.ingest(event) // subscribes to Intelligence Bus
OBS.query(facet, { userId }) -> FacetEstimate
OBS.explain(facetOrDNAField) -> EvidenceTrail
```

---

## 5. Confidence Engine (CE)

### 5.1 Composite score

For any assertion `A` produced by the system, confidence is:

```text
C(A) = clamp01(
    w_kf · KnowledgeFreshness
  + w_sa · SourceAuthority
  + w_ma · MemoryAgreement
  + w_ta · ToolAgreement
  + w_gc · GraphCompleteness
  + w_ic · InventoryConfidence
  + w_mc · ModelCertainty
  − penalties
)
```

with weights per assertion class (fact, recommendation, forecast, plan) and `Σw = 1`.

### 5.2 Component definitions

- **KnowledgeFreshness** — `f(ageOfSource, volatilityClass)`. Weather/FX high volatility → sharp decay; visa/geography low volatility → slow decay.
- **SourceAuthority** — per-provider prior in TIOS provider matrix × historical accuracy score maintained by Evaluation Framework.
- **MemoryAgreement** — Bayesian agreement between the assertion and retrieved memory bundle; disagreement with DNA is a strong negative.
- **ToolAgreement** — inter-tool concordance; if 3 sources agree on price ±ε, high; if they diverge, low.
- **GraphCompleteness** — fraction of required Journey Graph slots the assertion depends on that are populated with fresh data.
- **InventoryConfidence** — for bookable items, provider-reported availability firmness (soft cache vs live).
- **ModelCertainty** — logprob-derived where available; else self-report constrained by calibration factor.
- **Penalties** — contradiction with pinned DNA, safety flag, hallucination pattern match, missing citations.

### 5.3 Calibration

- Every assertion is stored with `C(A)` and later reconciled with observed outcome (accepted / corrected / failed).
- The Evaluation Framework (§9) fits per-class calibration curves; weights are updated via governed releases (shadow → canary → default).

### 5.4 Consumption

- Recommendation Engine uses `C` for ranking and thresholding.
- Explainability surfaces `C` as a bounded qualitative band (e.g. tentative / likely / confirmed) — never a raw number to the user, always a raw number in logs.
- Below capability-defined floor, the system must present a *question* or *uncertainty*, not an answer.

---

## 6. Recommendation Engine (REC)

REC is the reasoning consumer of memory + world + confidence. It never talks to providers directly (goes through TRL) and never assembles prompts (goes through POE).

### 6.1 Pipeline

```text
Intent
  ▼
[1] Candidate Generation   ← TIE providers via TRL + Journey Graph + GAL priors
  ▼
[2] Constraint Filtering   ← hard constraints (budget, dates, accessibility, visa, safety)
  ▼
[3] Personalisation        ← DNA + CJM + JM signal projection onto candidates
  ▼
[4] Ranking                ← multi-objective scorer (fit, cost, time, risk, novelty)
  ▼
[5] Trade-off Analysis     ← Pareto frontier over top-K; identify dominated options
  ▼
[6] Explanation Generation ← reasons, anti-reasons, alternatives, confidence
  ▼
RankedRecommendationBundle
```

### 6.2 Candidate generation

- Sources: live inventory (TIE), knowledge graph entities (TIOS knowledge providers), memory suggestions ("last trip you loved X"), GAL priors.
- De-duplication by canonical entity id.

### 6.3 Constraint filtering

- Hard constraints from Journey Graph + DNA red-lines. A candidate failing a hard constraint is **removed with reason** (kept in an audit list for explainability, not surfaced).
- Soft constraints become ranking penalties, not filters.

### 6.4 Ranking

- Multi-objective utility: `U = Σ wi · normalized(objective_i)` where objectives include fit-to-DNA, price-vs-budget, time cost, risk-adjusted quality, novelty, ecological/ethical fit if user opted in.
- Weights are DNA-driven, not global.
- Diversification: MMR-style penalty prevents monoculture in the top-K.

### 6.5 Trade-off analysis

- Compute Pareto frontier over top-K on `{cost, time, quality, risk}`.
- For each surfaced option, annotate what it *trades away* vs the frontier — this is what powers the "why not the cheaper one?" question.

### 6.6 Personalisation

- Personalisation is applied as *ranking* and *explanation*, not as *filtering*, unless the DNA field is a red-line.
- Cold-start: fall back to GAL priors + explicit onboarding + broadest diversification.

### 6.7 Interface

```text
REC.recommend({ subject, journeyId?, context, limit }) -> RankedBundle
```

Returned bundle contains: items, per-item explanation, dropped candidates with reasons (audit), Pareto notes, bundle-level confidence.

---

## 7. Explainability Framework (XAI)

Every user-facing assertion must, on demand, answer six questions with the same underlying record:

| Question | Source |
|---|---|
| **Why?** | Positive reasons: matched DNA facets, agreed sources, constraint fit |
| **Why not (this one instead of others)?** | Pareto trade-off vs alternatives |
| **Alternatives?** | Next-best items with their reason deltas |
| **Sources?** | Provider ids + retrieval timestamps + citation URIs where public |
| **Confidence?** | Qualitative band from CE, with contributing components |
| **Trade-offs?** | What was given up: cost, time, quality, risk, novelty |

### 7.1 Contract

Every REC item and every capability decision carries an `Explanation` object (already partially modelled in `src/lib/tios/explainability.ts`). XAI extends it:

```text
Explanation {
  summary: string
  reasons: Reason[]           // {text, evidenceIds[], weight}
  antiReasons: Reason[]
  alternatives: AlternativeRef[]  // {itemId, deltaReasons[]}
  sources: SourceRef[]        // {providerId, uri?, fetchedAt, freshness}
  confidence: { band, score, components }
  tradeoffs: Tradeoff[]       // {axis, sacrificed, gained}
  promptProvenance: { versions, hashes }  // from POE
}
```

### 7.2 Guarantees

- No user-facing recommendation exists without an Explanation.
- Every Explanation is reproducible from stored evidence + prompt provenance.
- The Explanation is the *primary* artefact; the UI is one of many renderers.

---

## 8. Intelligence Bus (IB)

### 8.1 Purpose

A single, ordered, typed event backbone through which all JIP subsystems, TIOS decisions, TIE outcomes, and UI-originated signals communicate. **Agents and capabilities do not call each other directly.**

### 8.2 Topology

- Logical single bus; physically implemented over the existing TIOS event bus (`src/lib/tios/events.ts`) extended with JIP event types.
- Delivery: at-least-once, per-partition ordering keyed by `{userId}` for user-scoped events and `{journeyId}` for journey-scoped events.
- Consumers are idempotent; each event carries a stable `eventId`.

### 8.3 Event families

`intent.*`, `context.*`, `memory.*` (`written|promoted|retired|contradicted`), `prompt.*` (`assembled|clipped`), `tool.*` (`invoked|failed|failover`), `decision.*`, `recommendation.*`, `observation.*` (`signal|inference|dna_updated`), `confidence.*` (`scored|calibrated`), `lifecycle.*` (§10), `eval.*`.

### 8.4 Contracts

Each event: `{ eventId, type, ts, actor, userId?, journeyId?, sessionId?, causationId, correlationId, payload, provenance }`. `causationId` and `correlationId` make full request traces reconstructable.

### 8.5 Non-goals

- Not a request/response channel. Synchronous flows (e.g. tool invocation) still return values; the bus receives an event *about* the call.
- No business logic on the bus itself; consumers hold policy.

---

## 9. Evaluation Framework (EVAL)

### 9.1 KPI catalogue

| KPI | Definition | Target direction |
|---|---|---|
| **Recommendation quality** | Blended: acceptance-rate × dwell × post-trip rating on recommended items | ↑ |
| **Hallucination rate** | Assertions failing source verification per 1k assertions | ↓ (SLO ≤ 0.5%) |
| **User acceptance** | % of surfaced recommendations accepted (weighted by criticality) | ↑ |
| **Planning efficiency** | Turns and elapsed time from intent to committed Journey slice | ↓ |
| **Latency** | p50/p95/p99 per capability, per pipeline stage | meet contract SLA |
| **Cost** | Credits + external $ per successful decision, per acceptance | ↓ |
| **Confidence calibration** | Brier score / ECE per assertion class | ↓ (better calibrated) |
| **Contradiction rate** | Memory contradictions per user per week | ↓ |
| **Coverage** | % of Journey slots the system can fill without human input | ↑ |
| **Safety** | Policy violations per 1k decisions | ↓ (SLO ≈ 0) |

### 9.2 Mechanisms

- **Online:** every event on the bus is a candidate signal; sampled and joined with outcomes.
- **Offline:** golden sets per capability; replay against new prompt/model versions before promotion.
- **Shadow:** new prompt/model version runs in parallel; decisions are compared, not surfaced.
- **Human review queue:** low-confidence or high-impact decisions sampled for expert review; results feed back as evidence.

### 9.3 Governance loop

Every promotion (prompt version, model, weights, capability contract change) requires: golden-set pass, shadow run within tolerance, canary win or neutrality on primary KPI, no regression on safety and hallucination.

---

## 10. Lifecycle Model

The canonical loop each Journey travels through. Each stage is a formal state with entry/exit events, an owning subsystem, and required artefacts. Multiple stages can be active for different slices of a Journey concurrently.

| Stage | Owner | Inputs | Outputs | Bus events |
|---|---|---|---|---|
| **Observe** | OBS | UI + tool + world events | Evidence records | `observation.signal` |
| **Understand** | POE + CE | Latest turn, memory, context | Structured intent + open questions | `intent.parsed`, `context.assembled` |
| **Plan** | Planner capability via TIOS | Intent, constraints, memory | Draft Journey slice | `decision.plan_drafted` |
| **Recommend** | REC | Plan slice, candidates | Ranked bundle with explanations | `recommendation.produced` |
| **Book** | TIE (through TRL) | User approval, chosen item | Confirmed booking artefact | `tool.invoked`, `decision.booked` |
| **Monitor** | World Knowledge + TIE watchers | Bookings, world state | Change alerts (delays, weather, price, safety) | `lifecycle.monitored`, `lifecycle.alert` |
| **Adapt** | Planner + REC | Alerts, updated context | Revised plan / alternatives | `decision.replanned` |
| **Remember** | Memory Engine | Outcomes, artefacts | JM writes, JM→CJM promotions | `memory.written`, `memory.promoted` |
| **Learn** | OBS + EVAL | Aggregated evidence + outcomes | DNA revisions, weight updates, calibration | `observation.dna_updated`, `eval.calibrated` |

Each stage is idempotent, resumable, and traceable end-to-end via `correlationId` on the Intelligence Bus.

---

## 11. Data Flow (Text Diagrams)

### 11.1 Single user turn

```text
User turn ──► IB(intent.received)
   │
   ▼
POE.assemble ──► MemoryEngine.retrieve ─┐
   │                                    │
   ├── Context Graph (TIOS) ────────────┤
   ├── World Knowledge (TIE) ───────────┤
   └── Tool Router.eligibleTools ───────┘
                    │
                    ▼
             AssembledPrompt ── IB(prompt.assembled)
                    │
                    ▼
         AI Core .generate/.stream (via AI SDK)
                    │
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
  tool calls    partial text   final output
     │
     ▼
Tool Router.invoke ──► TIE providers ──► results
     │
     ▼
IB(tool.invoked) ── OBS.ingest ── CE.score ── REC (if applicable)
                                                │
                                                ▼
                                      Explanation attached
                                                │
                                                ▼
                              Response returned to UI + IB(decision.produced)
```

### 11.2 Post-turn learning

```text
IB(decision.produced, tool.invoked, user.feedback)
        │
        ▼
    OBS.infer ── evidence written (append-only)
        │
        ▼
Memory promotion evaluator ── (rules §1.2) ── MemoryEngine.promote
        │
        ▼
DNA versioner ── (rules §4.4) ── new DNA version
        │
        ▼
EVAL.join(outcomes) ── calibration + KPI updates ── governance queue
```

### 11.3 Monitor & adapt

```text
World watchers (TIE) ── IB(lifecycle.alert)
        │
        ▼
Planner (via TIOS) ── replan slice ── REC.recommend(alternatives)
        │
        ▼
User approval ── TRL.invoke(booking mutation) ── Journey Graph updated
```

---

## 12. Module Boundaries & Ownership

| Module | Owns | Does NOT own |
|---|---|---|
| Memory Engine | Tiered read/write, promotion, retrieval ranking | Preference inference, DNA semantics |
| Observation Engine | Signals, evidence, facet inference, DNA writes | Prompt assembly, tool calls |
| Prompt Orchestration | Prompt assembly, versioning, budgeting | Model execution, tool execution |
| Tool Router | Tool registry, authz, provider selection, execution | Provider implementations (TIE), policies (TIOS) |
| Confidence Engine | Confidence scoring, calibration | Ranking, filtering |
| Recommendation Engine | Candidate → ranked bundle + explanation | Booking mutations, prompt assembly |
| Explainability | Explanation contract + reproduction | Business decisions |
| Intelligence Bus | Event typing, ordering, delivery guarantees | Business logic |
| Evaluation | KPIs, calibration, golden sets, governance gates | Feature choices |
| Lifecycle | Stage transitions, orchestration state | Any subsystem's internals |

---

## 13. Integration With Existing Systems

- **AI Core** — POE is the sole assembler feeding `core.server.ts`; memory calls continue through `memory.server.ts`; prompts continue through `prompts.server.ts`.
- **TIOS** — Every JIP call to a capability goes through `tios.decide` / `contracts`; JIP does not bypass the policy or capability registry. New JIP events are added to `src/lib/tios/events.ts` under a `jip.*` namespace.
- **TIE** — TRL is a client of TIE; TIE remains the only path to external providers and the Journey Graph.
- **Journey Graph** — Read by POE (context/memory frame) and REC (candidates/constraints); written only through TIE (bookings, activities, versions).
- **World Knowledge** — Consumed by POE (world frame), CE (freshness), REC (candidates), Monitor stage (watchers).
- **Journey Studio (UI)** — Renders Explanations; emits signals into the Intelligence Bus. No UI logic is added by this document.

---

## 14. Non-Goals & Boundaries Preserved

- No changes to homepage, Studio components, routes, auth, database schema, APIs, or SDK surfaces.
- No new provider integrations.
- No React components, no placeholders, no mock logic.
- No changes to the frozen governing docs; this document is additive.

---

## 15. Acceptance Criteria (for later implementation sprints)

1. Every model call is produced by POE and carries full provenance.
2. Every recommendation carries a complete Explanation resolvable from stored evidence.
3. Every DNA facet is traceable to evidence and reversible by the user.
4. Every tool call is registered, authorised, and observable.
5. Every subsystem communicates through the Intelligence Bus for non-return-value coordination.
6. Every KPI in §9.1 has an owner, a source of truth, and a dashboard target.
7. No subsystem exceeds its declared boundary in §12.

---

**End of JIP v1.0. Awaiting review before implementation planning.**
