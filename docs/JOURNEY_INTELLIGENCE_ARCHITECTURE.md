# Easy Trip — Journey Intelligence Architecture (JIA) v1.0

**Status:** Frozen — Final architecture document before implementation.
**Scope:** Additive intelligence layer above Product Vision, Engineering Architecture, AI Core, TIOS, TIE, Homepage, and Journey Studio PRDs v1.0 / v1.1 / v2.0.
**Non-scope:** No code, no React, no UI, no diagrams, no implementation. This document defines **how Easy Trip thinks**, not how it looks or ships.

---

## 0. Preamble — Why This Document Exists

The frozen PRDs define **what** Easy Trip is (Vision), **what it does** (Journey Studio), and **how it is built** (AI Core / TIOS / TIE). None of them describe **how Easy Trip reasons**: how facts about the world become knowledge, how a user's journey becomes a graph, how agents cooperate, how memory compounds, and how confidence is earned.

Without this layer, Easy Trip would be an interface over a model. With it, Easy Trip becomes an intelligence — one that improves with every journey, remembers every traveller, and reasons about the world with a coherent voice.

This document is the **contract between product ambition and machine reasoning**. Every capability shipped after this date must be traceable to a stage, agent, or model defined here.

---

## SECTION 1 — World Knowledge Model

### 1.1 Purpose
A single canonical representation of the physical, cultural, temporal, and regulatory world of travel. It is the substrate every agent, capability, and recommendation reads from. It is authored once, evolves continuously, and is never duplicated per feature.

### 1.2 Ontology (canonical entity hierarchy)

The world is a directed, typed graph — **not** a strict tree. Most entities have one primary parent and many cross-cutting edges.

**Geographic spine (containment):**
World → Continent → Country → Region → State/Province → County/Prefecture → City → Neighbourhood → District → Block → Point of Interest (POI).

**POI subtypes (typed leaves):** Hotel, Restaurant, Experience, Attraction, Nature Site, Cultural Site, Nightlife, Wellness, Shopping, Landmark, Transit Hub.

**Mobility spine:** Airport, Rail Station, Bus Terminal, Port, Ferry Dock, Metro Station, Road Corridor, Trail. Connected to geography via `LOCATED_IN` and to each other via typed `ROUTES_TO` edges (mode, duration, cost class, frequency).

**Temporal & environmental spine:** Season, Month-of-year (per hemisphere), Weather Pattern, Micro-climate, Daylight Window, Tide, Air Quality Index.

**Cultural spine:** Culture, Language (with dialects), Cuisine, Etiquette Norm, Religion/Observance, Dress Code, Tipping Norm, Communication Style.

**Regulatory & risk spine:** Visa Regime, Entry Requirement, Vaccination, Currency, FX Regime, Payment Methods Accepted, Safety Advisory, Crime Index, Health Advisory, Natural Hazard, Political Advisory, Local Law of Interest.

**Event spine:** Festival, Public Holiday, Religious Observance, Sporting Event, Concert, Exhibition, Migration/Natural Phenomenon, School Holiday Window.

**Reputation & media spine:** Review Corpus, Rating Distribution, Media Item (image, video, editorial), Provenance, Consent Status.

**Travel meta-rules:** Best-time-to-visit windows, minimum-viable-stay, "one-shot vs slow-travel" classification, family-friendliness, accessibility profile, LGBTQ+ safety profile, solo-traveller profile.

### 1.3 Relationship semantics

Edges are typed and directional. The core edge vocabulary:

- **Containment:** `CONTAINS`, `LOCATED_IN`.
- **Connectivity:** `CONNECTED_TO` (mode, duration, cost class), `NEAR` (haversine + walkable).
- **Temporality:** `ACTIVE_DURING`, `SEASONAL_FOR`, `PEAKS_IN`.
- **Cultural affinity:** `PART_OF_CULTURE`, `SPEAKS`, `PRACTISES`.
- **Regulatory:** `REQUIRES_VISA_FOR`, `USES_CURRENCY`, `ENFORCES`.
- **Reputation:** `REVIEWED_AS`, `PICTURED_IN`, `EDITORIALLY_FEATURED_IN`.
- **Substitution:** `ALTERNATIVE_TO` (for recommendations under constraint).
- **Composition:** `PAIRS_WITH` (Tokyo ↔ Kyoto, Serengeti ↔ Zanzibar).

Every edge carries: `confidence (0..1)`, `source_id`, `observed_at`, `expires_at`, `provenance_class` (authoritative / crowd / editorial / inferred).

### 1.4 Ownership & authorship

- **Custodian:** the Knowledge Guild — the single team that owns schema, provenance policy, and source federation. No feature team writes to World Knowledge directly.
- **Authoritative sources** (per class): government registries (visas, currencies, holidays), IATA/OAG (aviation), OSM (geo), meteorological agencies (weather), UNESCO/national tourism boards (cultural), curated editorial (voice), review syndication (reputation), operator inventories via TIE (bookable facts).
- **Write path:** all sources land in an **ingestion staging tier**, are normalised to the ontology, deduplicated, conflict-resolved against provenance rules, then promoted. Nothing enters the graph without a provenance record.
- **Read path:** every capability reads through a **Knowledge Access API** that enforces freshness class, confidence floor, and licensing scope. No feature reads raw sources.

### 1.5 Freshness classes

| Class | Refresh cadence | Examples |
|---|---|---|
| Immutable | Never / geological | Coordinates, elevation, continent membership |
| Slow | Yearly | Cuisine, cultural norms, language distributions |
| Cyclical | Seasonal | Best-time windows, festival calendars |
| Fluid | Weekly | Reviews, ratings, editorial features |
| Live | Sub-hour | Weather, safety alerts, FX, flight schedules |
| Volatile | Real-time | Prices, availability, disruption events (owned by TIE, not World Knowledge) |

Every entity carries its class. Every consumer chooses a **staleness tolerance**; violations degrade confidence, they do not block.

### 1.6 Extensibility principles

- **Ontology is versioned**, migrations are additive by default; deletions require a deprecation window and a compatibility shim.
- **New entity types are plugins**: they declare parent edges, freshness class, provenance rules, and a mapping to at least one existing traversal.
- **Regional overlays**: countries can extend the ontology (e.g. Japan's `Ryokan` as a Hotel subtype) without forking the global schema.
- **Sovereignty**: entities can be scoped to a jurisdiction so licensing and legal rules travel with the data.

### 1.7 Architectural recommendations (delta vs. brief)

- Treat the world as a **graph, not a taxonomy** — a strict hierarchy breaks the moment "Cherry Blossom" needs to belong to Season, Culture, Event, and Weather at once.
- Separate **World Knowledge (facts about the world)** from **Inventory (bookable facts about supply)**. Inventory is TIE's domain; conflating them makes the graph rot every time a hotel closes.
- Adopt **provenance-first** design: every fact carries who said it, when, and how confident. This is the only durable defence against hallucination downstream.

---

## SECTION 2 — Journey Knowledge Graph

### 2.1 Purpose
A journey is not a document. It is a living, connected graph of intent, plans, bookings, memories, people, and risks. Every screen in Journey Studio is a projection of this graph.

### 2.2 Node types

- **Journey** (root). Attributes: title, dream state, intent summary, purpose, DNA snapshot at creation.
- **Chapter** (Dream / Plan / Book / Prepare / Travel / Remember / Share) — narrative phases; the same journey traverses them in order but can revisit any.
- **Leg** — a contiguous stay in one primary geography.
- **City / Region node** — projection of a World Knowledge node into this journey (a *citation*, not a copy).
- **Day** — a dated slot inside a Leg.
- **Activity** — a scheduled or wished intent (visit, meal, experience, transit).
- **Booking** — a committed transaction (flight, hotel, rail, car, experience).
- **Document** — passport, visa, ticket, insurance, reservation, boarding pass.
- **Budget line** — planned or actual money movement.
- **Weather forecast / observation** — bound to Day + Location.
- **Companion** — human participant with role (planner, viewer, co-editor, dependent).
- **Recommendation** — an AI suggestion, always with rationale and confidence.
- **Risk** — an identified concern (weather, health, visa, logistics, budget).
- **Memory** — a captured artefact (photo, note, voice, checkin, receipt).
- **Experience** — a lived, completed activity (post-hoc counterpart of Activity).
- **Decision** — a recorded fork ("we chose Ryokan over Hotel", with reasons).

### 2.3 Edge semantics

- **Structural:** `HAS_LEG`, `HAS_DAY`, `HAS_ACTIVITY`, `HAS_BOOKING`, `HAS_DOCUMENT`.
- **Referential:** `CITES_WORLD_NODE` (points at World Knowledge; never copies).
- **Causal:** `BOOKS`, `FULFILS`, `REPLACES`, `CANCELS`, `DERIVES_FROM`.
- **Financial:** `COSTS`, `REFUNDED_BY`, `SPLIT_WITH`.
- **Social:** `SHARED_WITH`, `EDITED_BY`, `SUGGESTED_BY_AI`.
- **Risk:** `THREATENS`, `MITIGATED_BY`.
- **Memory:** `REMEMBERS`, `CAPTURED_AT`.
- **Temporal projection:** `SCHEDULED_ON`, `OBSERVED_ON`.

### 2.4 Graph evolution

Journeys are **event-sourced**. Every mutation is an append-only event (Intent added, Activity scheduled, Booking confirmed, Photo captured, Companion joined, Risk raised, Decision recorded). The graph is a materialised projection. This makes:

- Undo, replay, and versioning trivial.
- Offline merges deterministic.
- Post-trip narrative generation ("your journey as a story") a query, not a build.
- Learning signals extractable without instrumenting UI.

Chapters gate the projection: Dream nodes may be speculative and freely mutable; Booked nodes become semi-immutable (mutations must go through cancellation flows); Memory nodes are append-only.

### 2.5 Traversal patterns

The four canonical queries every screen resolves to:

1. **Vertical** — "give me Day 4 in full" (Day → Activities → Bookings → Weather → Risks).
2. **Horizontal** — "give me every hotel across this Journey" (Journey → Bookings[type=hotel]).
3. **Radial** — "everything happening around this POI on this Day" (Activity → NEAR world POIs → Weather → Risks).
4. **Temporal** — "everything scheduled in the next 24 hours" (traveller mode).

The graph must serve all four in sub-100ms client-perceived latency for a typical 14-day journey. This is a design constraint, not an optimisation.

### 2.6 Architectural recommendations

- **Citations, not copies.** Journey nodes reference World Knowledge by ID + observed snapshot hash. This is the only way to keep memory of "what we knew when we booked" while still benefiting from live truth.
- **Chapters are first-class**, not tags. They gate mutation rules, notification cadence, and AI posture (dreamy in Dream, precise in Travel).
- **Decisions are nodes.** Recording *why* a choice was made turns the graph into a teacher for future journeys and for the traveller themselves.

---

## SECTION 3 — AI Reasoning Framework

Every AI-facing capability flows through the same 14-stage pipeline. No agent may skip stages; agents may only weight them differently.

### Stage 1 — Intent
- **Purpose:** convert natural language, gesture, or implicit context into a typed intent.
- **Inputs:** utterance, current chapter, active selection, recent events.
- **Outputs:** `IntentFrame { type, subject, constraints, missing_slots, confidence }`.
- **Responsibilities:** disambiguation, slot filling, intent-vs-question classification.
- **Failure behaviour:** if confidence < floor, ask one calm clarifying question; never guess silently.

### Stage 2 — Context
- **Purpose:** assemble the situational envelope.
- **Inputs:** intent, journey graph slice, device state, locale, time, network class.
- **Outputs:** `ContextBundle`.
- **Responsibilities:** decide what the model *needs to know now* — not everything.
- **Failure behaviour:** degrade gracefully; missing context is annotated, not fabricated.

### Stage 3 — Memory
- **Purpose:** retrieve relevant short-term, trip, and Journey DNA memory.
- **Inputs:** context, user id, conversation id.
- **Outputs:** ranked memory records with reasons for inclusion.
- **Failure behaviour:** proceed without memory; log the miss; never invent preferences.

### Stage 4 — Journey Graph
- **Purpose:** load the relevant subgraph, not the whole journey.
- **Inputs:** intent subject, chapter.
- **Outputs:** typed subgraph handle.
- **Failure behaviour:** if journey unresolved, fall back to global reasoning with an explicit "no journey context" flag.

### Stage 5 — World Knowledge
- **Purpose:** attach world facts at the freshness class the intent requires.
- **Outputs:** annotated world slice with provenance.
- **Failure behaviour:** downgrade confidence; expose staleness in the answer.

### Stage 6 — Provider Selection
- **Purpose:** choose the model/provider under cost, latency, capability, and jurisdiction constraints (delegated to AI Core routing).
- **Failure behaviour:** cascade to next eligible provider; annotate degradation.

### Stage 7 — Capability Selection
- **Purpose:** pick the TIOS capability (planner, budget, weather, recommendation, etc.) matching the intent.
- **Failure behaviour:** if no capability fits, escalate to a general reasoning agent with reduced authority (cannot mutate the graph).

### Stage 8 — Reasoning
- **Purpose:** produce a candidate answer or plan.
- **Outputs:** structured proposal (never free-form for mutating actions).
- **Failure behaviour:** on structural failure, retry once with tightened schema; then surface a partial answer with visible gaps.

### Stage 9 — Validation
- **Purpose:** verify the proposal against schema, world facts, journey constraints, and safety rules.
- **Failure behaviour:** invalid proposals are rewritten or rejected — **never softened and shown**.

### Stage 10 — Trade-off Analysis
- **Purpose:** examine cost / time / comfort / risk trade-offs and produce alternatives.
- **Outputs:** primary + 1–3 alternates, each with a one-line reason.
- **Failure behaviour:** if no alternates exist, say so plainly.

### Stage 11 — Confidence
- **Purpose:** compute a single confidence score with contributing factors (source freshness, model self-report, cross-source agreement, memory match).
- **Failure behaviour:** confidence < floor → downgrade tone from *recommendation* to *option*.

### Stage 12 — Recommendation
- **Purpose:** render the proposal in the current chapter's voice with correct authority level (suggest / propose / do).

### Stage 13 — Explanation
- **Purpose:** attach the *why* — the specific facts and memories that led here. Always available; never noisy.

### Stage 14 — Learning
- **Purpose:** capture the outcome (accepted, edited, rejected, ignored) as a signal for Journey DNA and Cross-Journey Intelligence.
- **Failure behaviour:** learning is best-effort and never blocks the response.

### 3.1 Cross-cutting invariants

- **No stage may fabricate.** Every claim traces to a source, a memory, or an explicit inference marker.
- **The pipeline is observable end-to-end.** Every response ships with a reasoning trace ID; internal tools can replay it deterministically from event logs.
- **Determinism where possible.** Given identical inputs and provider seed, the pipeline should reproduce.

---

## SECTION 4 — Multi-Agent Coordination

Agents are **capability-scoped experts** that plug into the reasoning pipeline. They do not compete; they collaborate under a governor.

### 4.1 Agent roster

| Agent | Owns | Reads | Writes | Escalates to |
|---|---|---|---|---|
| **Planner** | Itinerary shape, pacing, day structure | Journey graph, DNA, World | Activities, Days, Legs | Companion (for judgement calls) |
| **Budget** | Money model, forecasts, alerts | Bookings, DNA, FX | Budget lines, alerts | Planner (re-plan under new constraint) |
| **Weather** | Forecasts, climate suitability | World live tier | Weather nodes, risks | Planner, Safety |
| **Recommendation** | Ranked options with rationale | World, DNA, cross-journey | Recommendation nodes | Companion |
| **Booking** | Cart, availability, hold, confirm (via TIE) | Inventory (TIE), Budget | Bookings, Documents | Budget, Safety |
| **Safety** | Advisories, health, natural hazards | World live, gov feeds | Risks | Planner (mitigation), Companion (calm delivery) |
| **Translator** | Language, phrasebook, on-device translation | World culture/language | — | Companion (voice) |
| **Document** | Passport, visa, tickets, insurance | World regulatory | Document nodes | Safety (expiries) |
| **Memory** | Journey memory, DNA updates, cross-trip signals | Everything (read-only for others) | Memory nodes, DNA | — |
| **Companion** | Voice, tone, orchestration of user-facing responses | All above | User-facing turn | Governor |

### 4.2 Coordination model

- **Governor (Orchestrator).** A single coordinator per turn. Owns intent routing, agent invocation order, timeouts, and the final composed response. No agent talks to the user directly except through the Companion.
- **Blackboard, not chat.** Agents write typed proposals to a shared per-turn blackboard. They do not converse. This is faster, cheaper, and auditable.
- **Delegation.** An agent may request another agent's output ("Planner asks Weather for a 7-day forecast for Kyoto"). Requests are typed; results are cached for the turn.
- **Escalation.** Any agent may raise a `NeedsJudgement` signal. The governor decides: resolve automatically (rule-based), ask the user (one question), or defer with a follow-up.

### 4.3 Conflict resolution

Conflicts are inevitable (Budget says no, Recommendation says yes). Resolution order:

1. **Safety trumps everything.**
2. **Explicit user constraints** beat inferred preferences.
3. **Higher-confidence source** beats lower.
4. **Recency of preference signal** breaks remaining ties.
5. If still unresolved, present a **trade-off card** to the user; never auto-resolve silently.

### 4.4 Shared memory model

Three tiers, all read-only to non-owning agents:

- **Turn memory** — blackboard; discarded at turn end.
- **Journey memory** — bound to the journey; survives sessions.
- **Journey DNA** — bound to the user; survives journeys.

Only the Memory Agent may promote signals between tiers, and only through explicit promotion rules.

### 4.5 Agent governance

- **Contracts.** Every agent has a machine-readable capability manifest (already the TIOS contract shape). Agents cannot act outside it.
- **Budget per turn.** Each agent has a token / latency / cost budget. Overrun triggers graceful degradation, not user-visible failure.
- **Kill switches.** Any agent can be disabled per user, per region, per experiment without redeploy.
- **Explainability.** Every agent output carries a reason string suitable for the Explanation stage.
- **Silent by default.** Agents speak only when they add value. Idle agents produce nothing — no chatter, no reassurance theatre.

### 4.6 Architectural recommendations

- Prefer **blackboard coordination** over agent-to-agent chat. Chat-based multi-agent systems look impressive in demos and collapse under production latency and cost.
- **One Companion voice** at the user seam. Multiple agent voices are the fastest way to feel like a chatbot, which the Vision forbids.
- **Governor is the only mutator of user-facing state.** Agents propose; the governor commits. This is how we keep the experience calm.

---

## SECTION 5 — Journey DNA

### 5.1 Purpose
The durable, portable model of *who this traveller is*. It survives journeys, devices, and years. It is the single most valuable long-term asset Easy Trip accumulates per user.

### 5.2 Dimensions

Each dimension is a distribution, not a label — travellers are rarely one thing.

- **Travel Style** — explorer, relaxer, planner, wanderer, connoisseur.
- **Budget Style** — frugal, value-seeking, comfort-first, uncompromising.
- **Planning Style** — architect (plans everything), sketcher (outline + improv), drifter (arrive-and-see).
- **Risk Tolerance** — cautious, balanced, adventurous.
- **Interest vector** — adventure, luxury, food, photography, culture, nature, history, business, wellness, nightlife, family, spirituality.
- **Accessibility profile** — mobility, dietary, sensory, cognitive; treated as first-class, never as an afterthought.
- **Travel Pace** — slow, moderate, packed. Measured in activities/day and transit/day.
- **Decision Behaviour** — deliberator vs. decider; sensitivity to reviews vs. editorial vs. peers.
- **Companionship pattern** — solo, couple, family, group, mixed.
- **Climate preference** — temperature bands, humidity tolerance, daylight preference.
- **Chronotype** — early riser, night owl (affects itinerary shape).

Each dimension carries: current estimate, confidence, last-updated, contributing signals count, override lock (user-set values are never overwritten by inference).

### 5.3 Evolution

- **Explicit signals** (onboarding, settings, direct feedback) update deterministically.
- **Implicit signals** (accepted recommendations, edits, dwell, dismissals, completed activities) update probabilistically with dampening — one bad Tuesday should not rewrite a decade of taste.
- **Post-trip reflection** offers the user a chance to review and correct DNA shifts; corrections are the highest-weight signal.
- **Decay** applies to interest dimensions but never to accessibility or hard constraints.

### 5.4 Influence on AI

DNA is a **first-class input to every reasoning stage** — not a filter bolted onto the output. It changes:

- Which options are surfaced (Recommendation).
- The pacing of proposed itineraries (Planner).
- The tone and length of Companion responses.
- The default cost class in Budget.
- The confidence threshold above which the assistant proposes vs. asks.

DNA never *restricts* — it *leans*. The user can always see and override the lean.

### 5.5 Portability & sovereignty

- DNA is exportable, human-readable, and user-owned.
- Deleting the account deletes DNA and all derived signals; there is no shadow profile.
- DNA is never sold, never used for advertising, never exposed to third-party models beyond the routed provider for the current turn.

---

## SECTION 6 — Cross-Journey Intelligence

### 6.1 Purpose
Learning that compounds across trips. A user's second journey should feel measurably more understood than their first; their tenth should feel effortless.

### 6.2 Signal classes

- **Preference signals** — favourite hotel brands, airlines, seat classes, cuisines, room types, walking radius, view preferences.
- **Behavioural signals** — average booking lead time, planning duration, replan frequency, mid-trip flexibility.
- **Money signals** — actual vs. planned spend by category, willingness-to-pay-up for specific comforts.
- **Comfort signals** — sleep environment, climate reactions, altitude tolerance, motion sensitivity.
- **Aesthetic signals** — photography subjects, editorial themes engaged with, saved memories.
- **Social signals** — who they travel with, who they share journeys with, roles they take.
- **Failure signals** — what went wrong, what was regretted (the most valuable data of all).

### 6.3 Accumulation rules

- Signals **never reset**. They can decay, be corrected, or be locked, but the ledger is append-only.
- **Cross-journey aggregation** happens in a dedicated pipeline owned by the Memory Agent — not in feature code.
- **Cold start** for a new journey uses DNA + recent trip signals; it does not restart from zero.
- **Cross-user signals** (aggregate statistics: "people like you loved Kanazawa in November") are only ever used in **anonymised, k-anonymous** form. No individual signal leaves an account.

### 6.4 Privacy principles (non-negotiable)

- **Local by preference.** Sensitive signals (health, sleep, location trails) are computed and stored on-device where feasible.
- **Purpose binding.** Each signal declares the capabilities that may read it. A budget signal cannot leak into a marketing surface — there is no marketing surface.
- **Zero-knowledge to providers.** No third-party model receives raw DNA or cross-journey signals; only the minimum context for the current turn.
- **User-visible ledger.** The user can inspect every signal that shapes their experience and delete any of them.
- **No third-party sharing. Ever.**

---

## SECTION 7 — World Intelligence Layer

### 7.1 Purpose
Global, time-aware awareness that lets Easy Trip proactively shape journeys around the state of the world. This is the layer that turns "book a trip" into "arrive during cherry blossom peak with a rainy-day backup".

### 7.2 Signal domains

- **Natural phenomena** — cherry blossom fronts, monsoon onset, aurora forecasts, wildlife migrations, tides, coral spawning, foliage peaks.
- **Cultural calendar** — festivals, religious observances, national days, cultural weeks.
- **Civic calendar** — public holidays, school holidays (per region), election dates that affect movement.
- **Sports & entertainment** — tournaments, concerts, exhibitions, biennales.
- **Regulatory dynamics** — visa policy changes, entry requirement shifts, currency controls.
- **Safety & health** — advisories, outbreaks, weather warnings, geopolitical shifts.
- **Aviation & transit** — strike calendars, seasonal route openings, major disruptions.
- **Economic** — FX volatility, local price seasonality.

### 7.3 Influence on planning

The layer feeds three surfaces:

1. **Proactive** — "The lavender fields peak the week after your dates. Shift by 5 days?" (surfaced only when confidence is high and shift is feasible).
2. **Protective** — "Your arrival day is a national strike; here's an alternative." Always shown, never dismissed silently.
3. **Enriching** — "There's a jazz festival two nights of your stay." Optional, calm, one card.

Signals carry a **relevance score** per journey (function of proximity, magnitude, alignment with DNA). Below a threshold, they never surface. The Vision requires calm; a firehose of world events is the opposite of calm.

### 7.4 Governance

- Every signal has an authoritative source and an expiry.
- Safety and regulatory signals bypass relevance thresholds — they always surface.
- Editorial signals (festivals, natural phenomena) go through a human curation layer before promotion. The world's beauty deserves editing.

---

## SECTION 8 — Search Architecture

### 8.1 Philosophy
**One search surface, many indexes, one ranker.** The user should never wonder "which search should I use". Easy Trip infers the scope from the query and context.

### 8.2 Search domains (unified under one API)

- **Global** — everything the user can act on.
- **Journey** — inside the current journey graph.
- **Destination** — World Knowledge scoped to a place.
- **Memory** — photos, notes, past experiences.
- **Document** — passports, tickets, reservations.
- **Semantic** — meaning-based across all of the above.
- **Natural language** — question-answering ("what did I spend on food in Kyoto?").
- **AI action** — search that ends in an action ("book a rainy-day museum for tomorrow").

### 8.3 Ranking model

A single composed ranker with signals in this priority:

1. **Intent match** — did we understand the query?
2. **Journey relevance** — is this about their current or upcoming journey?
3. **Recency** — for memory and events.
4. **Personal fit** — DNA alignment.
5. **Authority** — provenance and confidence.
6. **Popularity** — used sparingly; the user is not a crowd.

Ranking is **explainable per result** — every hit can show why it ranked where it did.

### 8.4 Relevance and discovery

- **Two-mode surface**: results answer the query; a discovery lane suggests adjacent things worth knowing ("also happening in Kyoto this week").
- **Zero-result is a first-class state** — always offers a next best action, never dead-ends.
- **Progressive disclosure** — 5 top results, then more on request; no infinite lists.

### 8.5 Architectural recommendations

- **Retrieval-augmented reasoning, not RAG-as-a-feature.** All AI answers pass through the same retrieval layer as search; there is one truth source.
- **Hybrid retrieval** (lexical + vector + graph) with the ranker as arbiter. No single method wins across all queries.
- **Client-side pre-ranking** for offline scenarios; server-side reranking when online.

---

## SECTION 9 — Offline & Synchronisation Strategy

### 9.1 Reality
Travel is where connectivity is worst and reliability matters most. Offline is not a fallback; it is a design axis.

### 9.2 Capabilities by mode

- **Full offline** — read any journey, view all documents, follow the itinerary, navigate offline maps for booked cities, translate offline packs, capture memories, edit non-booking data.
- **Sync-on-return** — edits queue locally, sync when connectivity resumes.
- **Partial online** — degraded search (local index only), cached recommendations, no live inventory.
- **Full online** — everything.

### 9.3 Sync model

- **Event-sourced client + server.** Both hold the append-only event log; sync is log reconciliation, not diffing.
- **CRDT-style merges** for non-booking data (notes, activity ordering, budget planning).
- **Server-authoritative** for money-touching operations (bookings, payments) — client cannot commit these offline; it queues intents.
- **Conflict resolution rules:**
  1. Server wins on bookings and payments.
  2. Last-writer-wins on trivial fields (title, notes).
  3. Structural conflicts (same activity edited on two devices) surface a **calm merge card** — never a modal, never destructive.

### 9.4 Cache strategy

- **Journey bundle** pre-fetched at Chapter transition Plan→Book and again at Prepare→Travel: itinerary, documents, maps, offline translations, currency snapshots, essential world facts.
- **Priority tiers** — documents and safety > itinerary > maps > memory sync > recommendations.
- **Storage discipline** — bundle sized for a middling phone; user can pin more, prune anytime.

### 9.5 Recovery

- Every device holds a self-sufficient copy of the current and next journey.
- Loss of device is a soft event — sign in elsewhere, everything returns.
- Corrupted local state is recoverable from server event log; corrupted server state is recoverable from client logs (dual custodianship).

### 9.6 User experience

Offline must feel *identical* to online for the modes above — same layout, same speed, same voice. The only surface acknowledgement of offline is a small, calm status; nothing else changes. The traveller should be able to spend a day in the mountains without noticing.

---

## SECTION 10 — Product Intelligence & Analytics

### 10.1 Purpose
Measure whether Easy Trip is getting better at the thing it exists to do. Analytics is **for product improvement, not for surveillance**.

### 10.2 Event model

Events are **domain-shaped, not UI-shaped**. Renaming a button never breaks analytics.

Canonical events:

- **Lifecycle** — Journey Started, Chapter Advanced, Journey Completed, Journey Shared, Journey Reflected.
- **Planning** — Intent Expressed, Plan Proposed, Plan Accepted, Plan Edited, Plan Rejected, Alternative Explored, Question Asked (by AI or user).
- **Booking** — Option Considered, Option Compared, Booking Initiated, Booking Confirmed, Booking Cancelled.
- **Money** — Budget Set, Budget Revised, Overspend Warned, Overspend Occurred.
- **AI quality** — Suggestion Shown, Suggestion Accepted, Suggestion Rejected, Explanation Opened, Confidence Downgraded, Hallucination Reported.
- **Memory** — Memory Captured, Memory Curated, Memory Shared.
- **Search** — Search Performed, Result Selected, Zero-Result Occurred.
- **Trust** — Neutrality Card Viewed, Source Cited, Decision Recorded.

Every event carries: `journey_id?`, `chapter`, `agent?`, `confidence?`, `provenance?`. No PII beyond stable pseudonymous IDs.

### 10.3 Metric families

- **Effectiveness** — plan acceptance, edit distance, replan frequency.
- **Trust** — explanation open rate, override rate, neutrality card exposure vs. dismissal.
- **Delight** — memory capture density, reflection completion, share rate.
- **Reliability** — offline session success, sync conflict rate, booking failure rate.
- **AI quality** — hallucination reports, confidence calibration curve, agent SLA adherence.
- **Retention that matters** — return-for-next-trip within 12 months.

### 10.4 Privacy principles

- **Aggregate by default.** Individual event streams are engineering-only and time-boxed.
- **Local computation.** Sensitive signals (locations, memories, health) are aggregated on-device and only anonymised summaries are transmitted.
- **User visibility.** A "how we're learning from you" surface explains what is collected and why, and lets the user opt out per family.
- **No dark patterns.** Analytics never drives UX toward manipulative outcomes; success metrics are user-centric (trips completed happily), not engagement-centric (minutes spent).
- **Deletion is real.** Account deletion purges event history, not just PII fields.

### 10.5 Architectural recommendations

- Adopt the event-sourced journey log as the **canonical analytics source** — no separate tracking layer, no drift between "what happened" and "what we measured".
- Ban UI-shaped events. If a metric can be renamed by a designer, it's not a metric.
- Maintain a **confidence calibration dashboard** as a first-class quality gate — model self-reported confidence must correlate with observed outcomes, or the model is wrong about being right.

---

## SECTION 11 — Acceptance Criteria

Easy Trip's intelligence layer is considered **world-class** when it meets every criterion below. Anything less is a work-in-progress.

### 11.1 Knowledge
- Every fact shown to a user is traceable to a provenance record within one click.
- World Knowledge freshness classes are respected across 100% of read paths.
- Ontology additions ship without breaking any downstream capability (contract-tested).

### 11.2 Journey graph
- Any of the four canonical traversals returns in under 100ms perceived latency on a mid-range device for a 14-day journey.
- Event log replay produces the identical journey state, byte-for-byte, across clients.
- Undo, redo, and time-travel work over the entire journey lifecycle.

### 11.3 Reasoning
- Every AI response carries a replayable reasoning trace.
- Confidence scores calibrate: outcomes match self-reported confidence within a defined tolerance band across cohorts.
- Fabrication rate (as reviewed by internal audits and user reports) trends toward zero and is bounded by SLA.

### 11.4 Agents
- No user-visible conflict is auto-resolved silently against explicit user constraints.
- One voice reaches the user; internal agent chatter is invisible.
- Any agent can be disabled per user without degrading other capabilities beyond a documented envelope.

### 11.5 DNA & Cross-journey
- Second and subsequent journeys measurably outperform the first on plan-acceptance and edit-distance metrics for the same user.
- User-set DNA fields are never overwritten by inference.
- DNA export is complete, human-readable, and portable.

### 11.6 World Intelligence
- Safety and regulatory signals reach affected journeys within a bounded latency SLA.
- Enriching signals surface at a density the user rates as "calm, not noisy" in reflection surveys.

### 11.7 Search
- One search surface. Domain inference correct on a defined benchmark set at world-class accuracy.
- Every result explains its ranking on demand.
- Zero-result never dead-ends.

### 11.8 Offline
- A traveller can complete a full travel day with zero connectivity without noticing degradation across a defined capability envelope.
- Sync conflicts never destroy user data.

### 11.9 Analytics
- Zero UI-shaped events.
- Users can inspect and delete their own event history.
- Model confidence calibration dashboard is green on the release gate.

### 11.10 Benchmark parity
Easy Trip's intelligence layer meets or exceeds, for its domain:

- **Apple** — restraint, sensory quality, silent reliability.
- **Google Maps** — geographic recall and route reasoning.
- **Flighty** — proactive travel-day awareness.
- **Notion AI** — in-context reasoning that respects the document/graph.
- **Linear** — speed, keyboard fluency, opinion.
- **Figma** — real-time collaboration under conflict.
- **Airbnb** — emotional resonance and belonging.
- **OpenAI** — reasoning quality and honesty under uncertainty.

---

## Closing Note

This document is the **final architectural act** before implementation. It should be read alongside the frozen PRDs, not in place of them. Where this document and the earlier PRDs disagree, this document defines *how the system thinks*, and the PRDs define *what the system is and does*; neither overrides the other, and any contradiction is a defect to be resolved by the governance process defined in PRD v1.1.

Implementation planning may now begin.
