# Journey Intelligence Platform (JIP) v1.1

**Architecture Extension — Definitive Blueprint**

Status: Architecture-only. No implementation. No UI. No code.
Baseline: `docs/JOURNEY_INTELLIGENCE_PLATFORM.md` (JIP v1.0) — approved and frozen.
Additive to: AI Core, TIOS, TIE, Journey Graph, World Knowledge, JIA v1.0, all Journey Studio PRDs.
This document extends v1.0 with 14 new/expanded subsystems while preserving every existing boundary.

> **Product Vision restatement.** Easy Trip is not an AI travel planner. It is evolving into a **Journey Intelligence Operating System (J-IOS)** — a durable, explainable substrate on which every travel-related decision, memory, simulation, and companion interaction runs. Every subsystem in this document is designed to reinforce that long-term posture: composable, observable, reversible, and traceable across years of a traveller's life.

---

## 0. Placement Within JIP v1.0

```text
                    Journey Studio (UI — frozen)
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────┐
│           Companion Intelligence Layer  (§7 — sits above AI Core)         │
├───────────────────────────────────────────────────────────────────────────┤
│                     Intelligence Mesh  (§10 — over IB)                    │
│  ┌────────────┬────────────┬───────────────┬──────────────┬────────────┐  │
│  │  Memory    │ Observation│ Simulation    │ Recommendation│ Timeline  │  │
│  │  (v1.0 §1) │ (v1.0 §4)  │  (§1 NEW)     │  (v1.0 §6)   │  (§4 NEW) │  │
│  ├────────────┼────────────┼───────────────┼──────────────┼────────────┤  │
│  │ Confidence │ Explain.   │ Planning Sim  │ Health       │ Emotional  │  │
│  │ (v1.0 §5+§12)│ (v1.0 §7+§13)│ (§5 NEW)  │  (§6 NEW)    │  (§3 NEW) │  │
│  ├────────────┴────────────┴───────────────┴──────────────┴────────────┤  │
│  │ Decision Intelligence (§8) │ Continuous Learning (§9) │ POE (v1.0 §2 + §11) │ │
│  └───────────────────────────────────────────────────────────────────────┘  │
├───────────────────────────────────────────────────────────────────────────┤
│  Experience Graph (§2 NEW) ── overlays ──► Journey Graph (existing)       │
├───────────────────────────────────────────────────────────────────────────┤
│           AI Core   ·   TIOS   ·   TIE   ·   World Knowledge              │
└───────────────────────────────────────────────────────────────────────────┘
```

**Boundary invariants (unchanged from v1.0).** New subsystems reach the world only through TIE via the Tool Router; call capabilities only through TIOS; assemble prompts only through POE; write to the Journey Graph only through TIE; write to memory only through the Memory Engine; and communicate cross-module only through the Intelligence Bus / Mesh.

---

## 1. World Simulation Engine (WSE) — NEW

### 1.1 Purpose

WSE models **hypothetical future travel outcomes** before REC produces recommendations. It answers "if…" questions as first-class artefacts, not as ad-hoc prompts.

### 1.2 Responsibilities

- Materialise counterfactual Journey slices without mutating the real Journey Graph.
- Project weather, crowd, price, availability, fatigue, and health signals forward under each hypothesis.
- Emit **Scenario** artefacts (deltas + projections + confidence) consumable by REC, Planning Simulator (§5), Timeline (§4), Health (§6), and Explainability (§13).

### 1.3 Inputs

Journey Graph slice · World Knowledge (weather, seasonality, events) · Crowd forecasts (TIE providers) · Budget model · User DNA + Emotional state (§3) · Timeline stage (§4) · Experience Graph (§2) · Constraint set.

### 1.4 Outputs

```text
Scenario {
  scenarioId, baselineJourneyId, hypothesis: StructuredDelta,
  projected: {
    itineraryDraft,          // shadow Journey slice, never persisted
    weatherProfile,
    crowdProfile,
    priceProfile,
    fatigueProfile,
    healthProjection,        // fed to §6
    experienceOverlay,       // §2
  },
  confidenceDimensions,      // §12
  tradeoffs, risks, opportunities,
  provenance: { sourcesFetchedAt, freshness, promptVersions }
}
```

### 1.5 Interfaces

```text
WSE.simulate({ baselineJourneyId, hypothesis, horizonDays?, k? }) -> Scenario[]
WSE.compare(scenarioIds[]) -> ScenarioDiff
WSE.dispose(scenarioId)  // scenarios are ephemeral by default
```

### 1.6 Lifecycle

`draft → projecting → ready → consumed → disposed`. Scenarios live in Working/Session Memory (v1.0 §1.1); promotion to Journey Memory only occurs when the Planning Simulator (§5) commits an accepted scenario back through TIE.

### 1.7 Ownership & integration

- Owner module: `intelligence/simulation` (future).
- **Never** calls providers directly — routes every external lookup through the Tool Router (v1.0 §3).
- Consumers: REC (candidate re-ranking under scenarios), §5 (sandbox), §6 (health), §13 (why-not narratives), §4 (timeline what-ifs).
- Publishes: `simulation.requested`, `simulation.ready`, `simulation.disposed` on the Intelligence Bus.

---

## 2. Experience Graph (EG) — NEW

### 2.1 Purpose

Travel is experiences, not inventory. EG is an **overlay graph above the Journey Graph** that models emotionally-meaningful moments as first-class nodes.

### 2.2 Experience Nodes

```text
ExperienceNode {
  id, canonicalName: "Golden Hour Walk" | "Rainy Café Morning" | ...,
  category: ExperienceCategory,
  sensoryProfile: { light, sound, pace, solitude, novelty },
  contextRequirements: { timeOfDay, weather, season, crowd, companions },
  durationBand, intensityBand, costBand,
  emotionalAffinity: EmotionState[],   // §3
  culturalContext, safetyProfile, accessibilityProfile,
  compositionHints: { pairsWellWith[], follows[], precedes[] },
  provenance
}
```

### 2.3 Experience Categories

`Contemplative · Culinary · Cultural · Nature · Nocturnal · Social · Ceremonial · Adventurous · Restorative · Creative · Hidden/Local · Seasonal/Festival`.

### 2.4 Relationships

- **Composes-with** (Temple Sunrise → Rainy Café Morning)
- **Substitutes-for** (Street Food Night ↔ Night Market Wander)
- **Requires-context** (Festival Evening → date/place)
- **Contraindicates** (Mountain Silence ✗ Festival Evening same day)
- **Grows-from** (Hidden Village ← Local Guide encounter)
- **Anchors-day** — one experience defines a day's emotional centre.

### 2.5 Journey Composition

A day is composed as: `Anchor Experience + Compatible Experiences + Logistics`. Logistics (hotels, transport, meals) are inferred *from* the experience composition, not the other way around. The Planner capability consumes EG through POE's new Experience Context slot (§11).

### 2.6 Recommendation integration

REC candidate generation (v1.0 §6.2) gains a new source: **Experience candidates** produced by EG traversal seeded by DNA + Emotional state + Timeline stage. Concrete inventory (a specific café) is *bound* to experience nodes late in the pipeline via TIE.

### 2.7 Memory integration

Every completed experience is written to Journey Memory as an **Experience Instance** (which node, when, with whom, weather, rating). Cross-Journey Memory clusters instances into personal experience patterns (e.g. "you gravitate to Contemplative anchors on day 1").

### 2.8 DNA integration

Emergent DNA facets: `experience.preferredAnchors`, `experience.pacePreference`, `experience.novelty vs. familiarity`, `experience.solitude vs. social`. These are promoted per v1.0 §4.4 rules.

### 2.9 Explainability integration

Explanations gain first-class fields: `anchorExperience`, `composedExperiences[]`, `experienceReasoning` — enabling narratives like *"This day is anchored by Temple Sunrise, composed with Rainy Café Morning; you've historically loved contemplative starts."*

---

## 3. Emotional Intelligence Engine (EIE) — NEW

### 3.1 Purpose

Infer **travel intent** — never diagnose emotions. EIE produces a bounded, explainable **Emotional State Vector** used to shape recommendation, pace, density, budget flexibility, and destination weighting.

### 3.2 State space

`Adventure · Relaxation · Celebration · Healing · Romantic · Luxury · Business · Family · Creative · Spiritual · Minimalist`. Non-exclusive: represented as a probability distribution with confidences and half-lives.

### 3.3 Inference sources

- Explicit prompts / onboarding chips.
- Behavioural signals routed through OBS (v1.0 §4): dwell, acceptance, edits.
- Contextual signals: trip kind, companions, calendar, time-of-year.
- Cross-Journey priors from DNA.

### 3.4 Influence surfaces

| Consumer | Effect |
|---|---|
| REC ranking | Objective weights shift (e.g. Healing ↑ solitude, ↓ density) |
| Planning pace | Activities/day cap, transitions/day cap |
| Activity density | Anchor-experience count, buffer time |
| Budget flexibility | Soft-cap elasticity per category |
| Destination selection | EG-weighted candidate generation |
| Explainability (§13) | Named influence: *"tuned for a Healing trip"* |
| Memory | Emotional context tagged on Experience Instances |
| Confidence (§12) | Feeds `Prediction Confidence` and `Recommendation Confidence` |

### 3.5 Guarantees

- Never surfaces raw affect labels to the user unless the user has named them.
- Every emotional inference is reversible: users can override; overrides pin the DNA facet.
- No emotional signal is used for pricing decisions or dark-pattern nudging — enforced by the policy engine.

### 3.6 Interfaces

```text
EIE.infer({ userId, journeyId?, window }) -> EmotionalState
EIE.applyTo(recommendationContext) -> ShapedContext
EIE.explain(journeyId) -> InfluenceTrail
```

---

## 4. Journey Timeline Engine (JTE) — NEW

### 4.1 Purpose

Every Journey exists **simultaneously** across nine temporal stages. JTE owns the temporal semantics; TIOS and TIE remain the executors.

### 4.2 Stages

| Stage | Entry | Exit | Owning subsystem | Allowed capabilities | Memory behaviour |
|---|---|---|---|---|---|
| **Dream** | intent captured, no dates | dates or destination committed | EIE + EG | recommendation, simulation | SM only |
| **Planning** | draft slice exists | first booking or explicit commit | Planner + WSE + §5 | planner, budget, weather, map, rec | SM → JM on commit |
| **Booked** | ≥1 booking confirmed | T‑minus preparation window | TIE | booking, budget, notifications | JM |
| **Preparing** | departure − X days | day-of departure | Planner + Health (§6) | packing, visa, weather, notifications | JM |
| **Travelling** | first leg begun | last leg complete | Companion (§7) + Monitor | all read + real-time adapt | JM (high write rate) |
| **Experiencing** | in-situ moment window | window close | EG + EIE | experience-log, translate, safety | JM (Experience Instances) |
| **Returning** | last leg → home arrival | +48h | Companion + Health | wind-down, receipts | JM |
| **Remembering** | +48h → +30d | 30d elapsed or user closes | Memory + OBS | summary, journal, photos | JM → CJM promotions |
| **Archived** | 30d elapsed | never (or user delete) | Memory | read-only summary | JM compacted; CJM/DNA retained |

### 4.3 Contracts

- Each stage has typed **entry conditions**, **exit conditions**, **allowed capability set**, **allowed side-effect classes** (read/mutate/pay/notify), and **memory tier writes**.
- Stage transitions are events on the Intelligence Bus (`timeline.entered`, `timeline.exited`); consumers subscribe rather than poll.
- Multiple slices of a Journey may occupy different stages concurrently (e.g. Kyoto leg *Booked*, Osaka leg still *Planning*).

### 4.4 Interfaces

```text
JTE.stageOf(journeyId, slice?) -> Stage
JTE.allowedCapabilities(journeyId, slice?) -> CapabilityId[]
JTE.transition(journeyId, slice?, to) -> TransitionResult   // guarded
JTE.subscribe(pattern) -> AsyncIterable<TimelineEvent>
```

---

## 5. Planning Simulator (PS) — NEW

### 5.1 Purpose

A **sandbox** over the real Journey Graph enabling "what if…" exploration with zero mutation until user acceptance.

### 5.2 Model

- PS forks a **shadow Journey** referencing the real Journey by version pointer.
- Every hypothesis (move hotel, reorder cities, add child companion, extend stay, add festival) is applied to the shadow via TIE's existing mutation contracts — but against the shadow ref.
- WSE (§1) projects outcomes; REC re-ranks under the shadow; Health (§6) re-scores; Confidence (§12) recomputes.

### 5.3 Output per simulation

```text
SimulationResult {
  simulationId, shadowJourneyRef,
  score, scoreDelta,
  tradeoffs, risks, opportunities,
  explanation,                 // §13 shape
  confidenceDimensions,        // §12
  acceptance: { commitPlan, reversiblePlan }
}
```

### 5.4 Commit path

Acceptance triggers a **TIE-mediated diff apply** onto the real Journey Graph, producing a new Journey version. Rejection disposes the shadow. Nothing else can mutate real state.

### 5.5 Interfaces

```text
PS.fork(journeyId) -> ShadowRef
PS.apply(shadowRef, hypothesis) -> SimulationResult
PS.compare(shadowRefs[]) -> ComparativeReport
PS.commit(shadowRef) -> JourneyVersion     // via TIE
PS.discard(shadowRef)
```

### 5.6 Lifecycle

Bound to SM by default; can be pinned to JM if the user says "keep this idea".

---

## 6. Journey Health Engine (JHE) — NEW

### 6.1 Purpose

A per-Journey, per-slice, per-day **health scoring system** that is always explainable and never opaque.

### 6.2 Dimensions

| Dimension | Signals |
|---|---|
| Budget health | Estimated vs actual vs forecast (existing Budget capability) |
| Fatigue | Cumulative walking, sleep windows, travel legs, jetlag model |
| Travel density | Activities/day, transitions/day vs DNA pace |
| Weather exposure | Forecast vs planned outdoor time |
| Risk | Safety advisories, health advisories, provider stability |
| Walking intensity | Route walking distance & elevation |
| Reservation confidence | Firm vs soft bookings, cancellation windows |
| Schedule flexibility | Slack minutes/day, replan options count |
| Crowding | Crowd forecasts at planned experiences |
| Overall balance | Weighted composite with anti-monoculture penalty |

### 6.3 Contract

```text
HealthScore {
  scope: journey|leg|day,
  dimensions: { name, score01, band, drivers[], recommendations[] },
  overall: { score01, band },
  explanation,                 // §13
  confidenceDimensions         // §12
}
```

Every score cites its drivers (evidence refs) and offers actionable recommendations — no bare numbers.

### 6.4 Consumers

REC (as ranking modifier), PS (as delta metric), Timeline (transition guard: e.g. can't cleanly enter *Travelling* if reservation confidence < floor), UI (via Explainability contract only).

---

## 7. Companion Intelligence Layer (CIL) — NEW

### 7.1 Purpose

A **persistent travel companion** that sits **above** AI Core (never replacing it), unifying identity, tone, memory boundaries, and decision consistency across every touchpoint.

### 7.2 Identity contract

- **Name & voice**: single canonical companion identity, versioned. Tone: calm, cinematic, human, plainspoken; never salesy.
- **Neutrality**: the companion has no commercial preferences; ranking is governed by REC + policy, not persona.
- **Refusal & safety**: inherits platform system prompt (POE §11).

### 7.3 Memory boundaries

- Reads: full Memory Hierarchy per user (v1.0 §1) with tier-appropriate rendering.
- Writes: only through Memory Engine; never behind the user's back — every memory write of consequence is user-visible in a "what I remembered" trail.

### 7.4 Consistency guarantees

- **Tone consistency**: single style guide compiled into the Identity slot of the prompt stack (§11).
- **Decision consistency**: prior decisions on the same Journey are treated as constraints unless explicitly revised.
- **Knowledge boundaries**: never asserts beyond CE-thresholded confidence; below threshold, it *asks*.
- **Learning boundaries**: only learns via OBS + Continuous Learning (§9). No silent prompt drift.

### 7.5 Lifecycle

`Introduced → Trusted → Long-term → Dormant → Re-engaged`. Each state adjusts memory recall breadth, proactive-suggestion rate, and initiative level — all governed by DNA + user preference, never by growth metrics.

### 7.6 Position in the stack

CIL is a **thin orchestrator** over POE + AI Core: it selects capability, sets identity/tone, and enforces companion invariants before POE assembles the prompt. It does not itself call models or providers.

---

## 8. Decision Intelligence Layer (DIL) — NEW

### 8.1 Purpose

Replace linear recommendation with **structured multi-perspective reasoning**. DIL is **architectural**, not a swarm of independent agents.

### 8.2 Perspectives

`Budget · Comfort · Adventure · Efficiency · Local Experience · Accessibility · Sustainability · Safety`. Each perspective is a **scoring function** with its own objective, its own evidence needs, and its own explanation template.

### 8.3 Mechanism

1. REC produces candidate set.
2. DIL runs each perspective as a **pure scoring pass** over candidates — no additional provider calls; reads World, Memory, DNA.
3. Perspective scores are combined via a **DNA-weighted aggregator** (weights derived from Emotional state §3 + DNA + explicit user emphasis).
4. Aggregator produces final ranking **and** the perspective contribution vector.
5. Explanations (§13) surface top perspectives and dissenting perspectives ("Adventure disagreed because…").

### 8.4 Guarantees

- Deterministic given the same inputs.
- Every ranking includes a **perspective breakdown** and a **dissent report**.
- No perspective can be silently dropped; weight = 0 is explicit.

### 8.5 Interfaces

```text
DIL.evaluate(candidates, context) -> {
  ranked, perspectiveScores, aggregatorWeights, dissent, explanation
}
```

---

## 9. Continuous Learning Framework (CLF) — Extended

### 9.1 New pipeline

`Observe → Measure → Infer → Validate → Promote → Calibrate → Retire → Explain`

| Stage | Owner | Output |
|---|---|---|
| Observe | OBS (v1.0 §4) | Evidence records |
| Measure | EVAL (v1.0 §9) | KPI deltas, outcomes joined |
| Infer | OBS + DIL | Facet posteriors, weight suggestions |
| Validate | EVAL | Golden-set + shadow + canary results |
| Promote | Governance queue | Prompt/model/weight/contract version bumps |
| Calibrate | CE (§12) | Updated calibration curves per assertion class |
| Retire | Memory + EVAL | Decayed facets, deprecated prompts, retired providers |
| Explain | XAI (§13) | Human-readable change log per user & platform |

### 9.2 Governance

- Every promotion requires: golden-set pass, shadow parity or improvement on primary KPI, no safety/hallucination regression, human sign-off for user-facing tone/identity changes.
- Every retirement is auditable and reversible for N days.
- Users receive a **personal learning digest** — what the system now believes about them and why — on cadence and on demand.

---

## 10. Intelligence Mesh (IM) — Extended

### 10.1 Purpose

Extend the Intelligence Bus (v1.0 §8) into a **mesh** of loosely-coupled subsystems continuously exchanging structured knowledge — never direct calls.

### 10.2 Participants

Memory · Observation · Simulation (§1) · Recommendation · Timeline (§4) · Confidence · Evaluation · Explainability · Companion (§7) · Emotional (§3) · Health (§6) · Decision (§8).

### 10.3 Mesh contracts

- **Typed topics** per event family (`memory.*`, `simulation.*`, `timeline.*`, `emotion.*`, `health.*`, `decision.*`, `learning.*`).
- **Contract-versioned payloads**; consumers declare supported versions; broker rejects unversioned events.
- **Backpressure** and **replay** via correlation and causation ids (v1.0 §8.4).
- **Loose coupling invariant**: any subsystem may be removed without breaking others; consumers degrade gracefully on missing signals.
- **No bypass**: any cross-module communication outside the mesh is an architectural violation caught by static analysis (module import lint) + runtime guards in the router.

### 10.4 Knowledge exchange examples

- EIE publishes `emotion.state_updated` → REC re-weights → JHE re-scores → CIL adjusts tone.
- WSE publishes `simulation.ready` → PS updates comparison view → EVAL logs shadow decision.
- OBS publishes `observation.dna_updated` → Memory promotes → CIL surfaces "I noticed…" digest.

---

## 11. Prompt Orchestration Extension (POE v1.1)

The v1.0 layer order is superseded by this canonical stack. Order is **normative**, not decorative.

```text
[1]  Mission                     — J-IOS mission statement, invariants
[2]  Identity                    — Companion identity + tone (§7)
[3]  Platform Rules              — safety, neutrality, refusal, privacy
[4]  Capability Rules            — capability-specific system prompt (versioned)
[5]  Journey Context             — normalized Journey slice
[6]  Timeline Context            — current stage, allowed capabilities (§4)
[7]  Experience Context          — anchor/composed experiences (§2)
[8]  World Context               — freshness-stamped world facts
[9]  Memory                      — retrieved bundle (v1.0 §1.4)
[10] Simulation Results          — active Scenarios / SimulationResults (§1, §5)
[11] Tool Context                — eligible tools (or deferred meta-tool)
[12] Output Schema               — Zod/JSON schema or free-JSON contract
[13] User Intent                 — the actual turn
```

### 11.1 Rules

- Missing normative slots are **explicit nulls with reason**, never silently omitted.
- Budget clipping order (highest priority kept): 1 > 3 > 12 > 2 > 4 > 13 > 6 > 5 > 8 > 7 > 9 > 10 > 11.
- Every assembled prompt records `stackHash` + each slot's version/hash in provenance. Reproducible bit-for-bit.
- Slot 10 (Simulation Results) may be empty; when present, it is authoritative for counterfactual questions.

---

## 12. Confidence Engine Extension (CE v1.1)

### 12.1 Dimensions

Replace the single score with a **confidence vector**:

| Dimension | Meaning | Primary inputs |
|---|---|---|
| **Knowledge Confidence** | Are the facts fresh and authoritative? | Freshness, Source Authority, Graph Completeness |
| **Prediction Confidence** | Are forecasts reliable? | Model + provider historical accuracy, horizon |
| **Planning Confidence** | Is the plan internally coherent? | Constraint satisfaction, JHE score |
| **Inventory Confidence** | Is what we recommend actually bookable? | Provider inventory firmness |
| **Memory Confidence** | Are we correctly modelling the user? | DNA support, contradiction rate, decay |
| **Recommendation Confidence** | Is this the right item for this user now? | DIL perspective agreement, dissent |
| **Overall Confidence** | Composite | Weighted, non-linear (see §12.2) |

### 12.2 Aggregation

```text
Overall = softmin(dimensions weighted by assertion class) − penalties
```

- `softmin` (not average): the system is only as confident as its weakest relevant dimension, but doesn't collapse to it. This prevents a strong model prior from masking stale inventory.
- Assertion classes (`fact`, `forecast`, `plan`, `recommendation`, `experience_match`) select which dimensions dominate.
- Penalties: contradiction with pinned DNA, safety flag, hallucination pattern match, missing citations, expired freshness.

### 12.3 User-facing rendering

Users see qualitative bands per dimension (e.g. *"Inventory: firm · Prediction: tentative"*), never raw numbers. Below capability floor, the system asks instead of answers (v1.0 §5.4 preserved).

---

## 13. Explainability Extension (XAI v1.1)

Every user-facing assertion carries an extended Explanation object answering **ten** questions:

```text
Explanation v1.1 {
  summary,
  why[],                    // reasons
  whyNot[],                 // anti-reasons vs Pareto neighbours
  alternatives[],           // next-best with delta reasons
  tradeoffs[],              // axes sacrificed/gained (from DIL)
  evidence[],               // evidence refs from OBS/Memory/World
  confidence: ConfidenceVector,   // §12
  futureImpact,             // projected effect on remaining Journey (via WSE)
  journeyImpact,            // effect on other slices, budget, health (via JHE)
  memoryInfluence,          // which memories/DNA facets shaped this (with links)
  simulationInfluence,      // which Scenarios/Sim results informed it (§1, §5)
  perspectiveBreakdown,     // per-perspective scores + dissent (§8)
  promptProvenance          // stackHash + slot versions (§11)
}
```

Guarantees (extend v1.0 §7.2): every field is reproducible from stored artefacts; no field is generated by the model outside of a governed template; users can drill from any field to its underlying evidence.

---

## 14. Product Vision — Journey Intelligence Operating System

### 14.1 Positioning

Easy Trip is a **Journey Intelligence Operating System**. The v1.1 architecture makes this concrete:

- **Kernel**: AI Core + TIOS + TIE + Memory + Intelligence Mesh.
- **Substrate**: Journey Graph + Experience Graph + World Knowledge + DNA.
- **Runtime**: POE + Tool Router + WSE + PS + JHE + JTE.
- **Reasoning**: DIL + CE + EIE + REC.
- **Interface layer**: CIL + XAI.
- **Governance**: CLF + EVAL.

Each subsystem is composable, observable, reversible, and traceable — the properties an OS must have to be trusted with a decade of a traveller's life.

### 14.2 Reinforcement per subsystem

| Subsystem | How it reinforces the J-IOS vision |
|---|---|
| WSE | Turns the platform from reactive to **projective** |
| Experience Graph | Makes emotion the primary schema, not inventory |
| EIE | Aligns the OS with human intent, not utility metrics |
| Timeline | Makes time a native dimension, not metadata |
| Planning Simulator | Preserves user agency — nothing changes without consent |
| Health | Makes wellbeing a first-class SLO |
| Companion | Gives the OS a single, consistent voice |
| Decision Intelligence | Makes reasoning multi-perspective and explainable |
| Continuous Learning | Makes the OS improve without drifting |
| Intelligence Mesh | Keeps the OS loosely coupled and evolvable |
| POE v1.1 | Makes prompts a governed, versioned artefact |
| CE v1.1 | Makes uncertainty a first-class quantity |
| XAI v1.1 | Makes every output auditable end-to-end |

---

## 15. Cross-cutting Compatibility

- **AI Core**: unchanged. CIL wraps, POE feeds, Tool Router mediates.
- **TIOS**: unchanged. New JIP events added under `jip.*` namespace only.
- **TIE**: unchanged. WSE/PS/JHE consume TIE via Tool Router; only PS.commit mutates the Journey Graph, via existing TIE contracts.
- **Journey Graph**: unchanged. Experience Graph is an overlay; nodes reference Journey Graph nodes but never replace them.
- **World Knowledge**: unchanged. New consumers (WSE, JHE, EIE) subscribe via existing interfaces.
- **Journey Studio (UI)**: unchanged. All new subsystems reach the UI only through the extended Explanation contract and existing rendering surfaces.
- **Auth / Database / APIs / Routing**: unchanged.

---

## 16. Acceptance Criteria (for later implementation sprints)

1. No Scenario, SimulationResult, HealthScore, or Emotional inference reaches a user without an XAI v1.1 Explanation.
2. No cross-module call exists outside the Intelligence Mesh.
3. No mutation of the Journey Graph occurs outside TIE (PS.commit included).
4. Every prompt records the v1.1 stack hash and per-slot versions.
5. CE emits a full ConfidenceVector; the UI renders qualitative bands.
6. JTE governs allowed capabilities per stage; TIOS policy denies out-of-stage capability use.
7. Every DNA change from CLF is reversible and user-visible within one Remembering-stage digest cycle.
8. Every subsystem in §12.1 of v1.0 and §§1–13 of v1.1 has an owning module, an interface contract, and a KPI in EVAL.

---

**End of JIP v1.1. Additive to v1.0. Awaiting review before implementation planning.**
