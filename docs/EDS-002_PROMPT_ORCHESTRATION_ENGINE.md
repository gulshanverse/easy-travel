# EDS-002 — Prompt Orchestration Engine Engineering Specification

**Status:** Frozen (Engineering Baseline)
**Architecture Baseline:** JIP v1.3 (frozen), EDS-001 Memory Engine (frozen)
**Compatibility:** AI Core, TIOS, TIE, Intelligence Mesh, Explainability Engine (XE), Trust & Evidence Engine (TEE), Unified Decision Engine (UDE)
**Document Type:** Engineering Design Specification (not architecture, not implementation)
**Owner:** Intelligence Platform Engineering

---

## 0. Preface

This document translates the Prompt Orchestration Engine (POE) defined in JIP v1.3 into a production-grade engineering specification. It defines **how** the engine will be built, operated, evolved, and evaluated. It does not alter any architectural boundary defined in JIP v1.0–v1.3 or EDS-001, and it does not prescribe frameworks, languages, or vendors. Every subsystem is designed to be technology-agnostic and forward-compatible with multi-provider evolution.

The POE is the single, canonical construction path for every prompt that enters any LLM used by Easy Trip. All other subsystems (Agents, UDE, MAG, PLE, CIE, IIE, EIE, WIM, EIX, Journey Studio, TIE, Capabilities) reach the LLM **only** through POE. No component may synthesize its own prompt string outside POE.

---

## 1. Goals

### 1.1 Purpose
Provide a deterministic, observable, safe, versioned, cost-aware, provider-neutral pipeline that assembles a prompt, invokes an LLM, validates the output, and returns a fully explainable result to callers.

### 1.2 Responsibilities
1. Compile prompts from typed, ordered stages.
2. Enforce token, cost, and safety budgets.
3. Integrate with Memory Engine (EDS-001), Tools Registry, World Model, and Context Frames.
4. Emit structured, schema-validated outputs.
5. Produce full traces for XE / TEE / UDE / observability.
6. Manage provider selection, failover, and streaming.
7. Enforce prompt versioning, canaries, and rollback.

### 1.3 Design Philosophy
- **Assemble, never improvise.** Prompts are the deterministic output of a typed pipeline.
- **Every byte accounted for.** Every token, every stage, every source is traceable.
- **Provider-neutral core.** Provider quirks live only in adapters.
- **Fail loudly, degrade gracefully.** Missing stages cannot silently vanish; degradation is explicit.
- **Composition over templates.** Stages compose; monolithic string templates are prohibited.

### 1.4 Non-Goals
- POE does not decide *what* to ask the LLM (that is UDE / Agents / MAG).
- POE does not write to Memory (that is EDS-001 write-path).
- POE does not implement business tools (Tools Registry does).
- POE does not perform booking, payment, or side-effectful mutations.
- POE does not host RAG stores; it retrieves through EDS-001 and TIE.

### 1.5 Engineering Assumptions
- LLM invocations are network I/O with p95 100 ms – 8 s latency.
- All providers may fail, throttle, or deprecate models.
- Context windows are bounded and expensive; token cost dominates.
- Every prompt is potentially adversarial input.
- Memory retrieval is available at ≤ 120 ms p95 (per EDS-001 SLO).

### 1.6 Core Principles
1. **Deterministic assembly** — same inputs ⇒ byte-identical prompt (barring timestamps, which are stamped).
2. **Explicit ordering** — 17-stage canonical order (see §3).
3. **Typed slots** — each stage yields a typed `PromptFragment`, never a raw string until final compilation.
4. **Budget-aware** — every stage declares soft/hard token budgets.
5. **Versioned** — every prompt, stage, schema, provider adapter carries a semantic version.
6. **Explainable** — every prompt run produces a `PromptTrace` consumable by XE.

### 1.7 Success Criteria
| KPI | Target |
|---|---|
| Assembly latency (p95, non-LLM) | ≤ 35 ms |
| Streaming first-token latency (p95) | ≤ 1.2 s |
| Structured-output validation pass rate | ≥ 99.3% |
| Prompt-injection detection recall | ≥ 0.97 on internal corpus |
| Provider failover success | ≥ 99.9% within 2 hops |
| Token-budget adherence (no hard-limit breach) | 100% |
| Trace completeness (spans emitted per run) | 100% |
| Cost variance vs. forecast | ≤ ±8% weekly |

### 1.8 Operational Constraints
- No secret material may enter any prompt stage.
- No cross-user data may enter another user's context.
- No stage may exceed its declared hard budget.
- No provider adapter may leak provider-specific fields into caller responses.
- POE must remain callable during EDS-001 partial degradation (memory becomes optional, not fatal).

---

## 2. Prompt Runtime Architecture

### 2.1 Runtime Diagram (textual)

```
Caller (Agent / UDE / MAG / Studio)
   │  PromptRequest{intent, agent, ctxRefs, schemaRef, policyRef}
   ▼
┌───────────────────────────────────────────────────────────┐
│                 PROMPT ORCHESTRATION ENGINE               │
│                                                           │
│  Admission → Resolver → Assembler → Compiler → Budgeter   │
│      ↓          ↓          ↓           ↓          ↓       │
│  Safety → Provider Router → Invoker (stream/unary)        │
│                    ↓                                      │
│           Output Validator → Repair → Emitter             │
│                    ↓                                      │
│         Trace Sink (XE) / Usage Sink / TEE evidence       │
└───────────────────────────────────────────────────────────┘
```

### 2.2 Prompt Lifecycle
`REQUESTED → ADMITTED → ASSEMBLED → COMPILED → BUDGETED → SAFETY_CLEARED → DISPATCHED → STREAMING → VALIDATED → EMITTED → TRACED → CLOSED`
Terminal error states: `REJECTED`, `TIMED_OUT`, `CANCELLED`, `FAILED`, `DEGRADED_OK`.

### 2.3 Pipeline Stages (execution-time, distinct from assembly order in §3)
1. **Admission Control** — auth, quota, tenant isolation, request schema check.
2. **Reference Resolution** — hydrate ctxRefs from Memory / TIE / WIM / CIE.
3. **Stage Assembly** — invoke 17 assembly stages (§3) to produce `PromptFragment[]`.
4. **Compilation** — deterministic serialization to provider-neutral IR.
5. **Budgeter** — enforce token / cost budgets, trigger compression.
6. **Safety Gate** — injection scan, PII redaction, policy evaluation.
7. **Provider Router** — model selection (§10).
8. **Invoker** — unary or streaming invocation with cancellation.
9. **Output Validator** — schema + typed contract validation (§8).
10. **Repair** — bounded self-repair (§8.6).
11. **Emitter** — return result to caller.
12. **Trace Sink** — flush spans to XE / TEE / observability (§12).

### 2.4 Validation Stages
- **Structural:** stage list well-formed, budgets sum ≤ window.
- **Semantic:** required stages present for the requested agent profile.
- **Policy:** governance flags (residency, redaction, tool allow-list).
- **Contract:** output schema resolvable and versioned.

### 2.5 Compilation Stages
- **Normalize:** fragment ordering, whitespace canonicalization.
- **Interpolate:** typed variable substitution (no string concat by callers).
- **Serialize:** provider-neutral IR (`PromptIR v1`).
- **Adapt:** provider-specific transformation via adapter (§10).
- **Fingerprint:** SHA-256 of pre-adapter IR — used for cache keys, dedupe, and audit.

### 2.6 Injection Stages
Memory (§6), Tools (§7), World (WIM), Simulation (from JIP v1.2 Simulation Engine) — each is a typed injector with its own budget slot.

### 2.7 Output Stages
Unary buffered, JSON-schema enforced, or streamed with incremental JSON parser (§8.4).

### 2.8 Streaming Stages
`OPEN → FIRST_TOKEN → CHUNK* → PARTIAL_VALIDATE* → CLOSE`. Each chunk is validated incrementally against the schema; unrecoverable violation triggers early-terminate with repair fallback.

### 2.9 Termination
`success | validated | repaired | degraded | client_cancelled | timed_out | provider_error | policy_block`.

### 2.10 Cancellation
Cooperative via cancellation token. Cancellation MUST propagate to provider adapter and abort in-flight streams within 250 ms.

### 2.11 Recovery
Idempotent by `promptFingerprint + attemptId`. Recovery attempts reuse the compiled IR; assembly is not re-run unless inputs changed.

### 2.12 Timeouts
Hard timeout per invocation defaults to 30 s (streamed) / 20 s (unary), configurable per agent profile. Assembly timeout: 500 ms hard, 150 ms soft.

### 2.13 Retries
- Provider errors: up to 2 retries with exponential backoff (250 ms base, jitter).
- Structured-output failures: 1 repair attempt (§8.6).
- Injection-scan failures: never retried (surfaced to caller).

### 2.14 Versioning
Each run pins: `poe.version`, `promptProfile.version`, `stageSet.version`, `schema.version`, `providerAdapter.version`, `modelId`. Recorded in `PromptTrace`.

### 2.15 Deterministic Execution
Given identical inputs, assembly is byte-identical modulo declared non-deterministic slots (timestamps, RNG seeds). All non-determinism is captured in the trace.

---

## 3. Prompt Assembly Pipeline

### 3.1 Canonical Assembly Order (17 stages)
1. **Mission** — invariant platform mission statement.
2. **Identity** — agent identity (Planner, Concierge, Curator, etc.).
3. **Platform Rules** — global platform invariants.
4. **Capability Rules** — capability-scoped rules (Booking, Search, etc.).
5. **Safety Rules** — safety policies applicable to this call.
6. **Journey Context** — active journey state (from TIE / TIOS).
7. **Timeline Context** — temporal frame (past/present/planned).
8. **Experience Context** — EIX outputs (flow, mood, serendipity signals).
9. **Goal Context** — user goals (Goal Graph via UDE).
10. **Identity Context** — IIE persona projection.
11. **Relationship Context** — companions, group dynamics.
12. **Memory Context** — Memory Engine retrievals (§6).
13. **Simulation Context** — Simulation Engine outputs, if requested.
14. **Tool Context** — tool manifest and constraints (§7).
15. **World Context** — WIM snapshot, external state.
16. **Output Schema** — the target contract (§8).
17. **User Intent** — the user's turn / current instruction.

### 3.2 Stage Contract
Every stage exposes:
```
Stage {
  id, version, owner
  inputs: TypedRef[]
  produce(ctx) -> PromptFragment | null
  budget: { softTokens, hardTokens }
  cachePolicy: { key, ttl, scope }
  failure: { onError: "omit"|"degrade"|"abort", fallback?: Ref }
}
```

### 3.3 Per-Stage Specification

| # | Stage | Owner | Inputs | Outputs | Ordering | Failure | Cache | Version |
|---|---|---|---|---|---|---|---|---|
| 1 | Mission | POE | Static | Fragment | First | abort | infinite | pinned |
| 2 | Identity | AgentRegistry | agentId | Fragment | After Mission | abort | 24h | agent semver |
| 3 | Platform Rules | Governance | policySetId | Fragment | After Identity | abort | 1h | policy semver |
| 4 | Capability Rules | Capabilities | capabilityIds | Fragment | After Platform | abort | 1h | cap semver |
| 5 | Safety Rules | Safety | safetyProfileId | Fragment | After Capability | abort | 15m | safety semver |
| 6 | Journey Ctx | TIE | journeyId | Fragment | After Safety | degrade | 60s | journey rev |
| 7 | Timeline Ctx | TIE | journeyId | Fragment | After Journey | degrade | 60s | timeline rev |
| 8 | Experience Ctx | EIX | userId, journeyId | Fragment | After Timeline | omit | 5m | eix rev |
| 9 | Goal Ctx | UDE | userId | Fragment | After Experience | degrade | 5m | goal rev |
| 10 | Identity Ctx | IIE | userId | Fragment | After Goal | omit | 30m | iie rev |
| 11 | Relationship Ctx | IIE/Social | userId, groupId | Fragment | After Identity | omit | 30m | rel rev |
| 12 | Memory Ctx | Memory Engine | query, filters | Fragment | After Relationship | degrade | 60s | memory rev |
| 13 | Simulation Ctx | Simulation | simRef | Fragment | After Memory | omit | 5m | sim rev |
| 14 | Tool Ctx | Tools Registry | toolAllowList | Fragment | After Simulation | abort | 5m | tools semver |
| 15 | World Ctx | WIM | worldRefs | Fragment | After Tool | degrade | 60s | wim rev |
| 16 | Output Schema | ContractRegistry | schemaRef | Fragment | Penultimate | abort | infinite | schema semver |
| 17 | User Intent | Caller | turnInput | Fragment | Last | abort | none | n/a |

Ordering is a total order; concurrent production is permitted, but final serialization respects the table.

---

## 4. Context Window Management

- **Window allocation:** each stage declares soft/hard budgets summing ≤ 85% of model window; 15% reserved for output.
- **Priority ordering:** Stages 1–5, 16, 17 are inviolable. Stages 6–15 are compressible.
- **Sliding window:** conversation history stage (part of User Intent) uses last-N + rolling summary.
- **Hierarchical compression:** raw → bulleted → summarised → dropped, per stage policy.
- **Chunk selection:** retrievals ranked by weighted score (see §6.3).
- **Duplicate elimination:** content hash across fragments; last-writer-wins by ordering.
- **Summarisation:** performed by dedicated summariser prompt profile, cached by input fingerprint.
- **Context expiry:** each fragment carries `producedAt`; TTL enforced by cache policy.
- **Freshness:** WIM and Journey Ctx must be ≤ 60 s old at dispatch.
- **Conflict resolution:** later stages override earlier only via explicit `overrides` field.
- **Overflow:** Budgeter runs compression passes 1..N; if hard limit still breached ⇒ `BUDGET_OVERFLOW` failure with degradation record.
- **Budget-aware selection:** retrievers receive remaining budget and MUST honor it.

---

## 5. Token Budget Management

| Budget | Type | Default | Enforcement |
|---|---|---|---|
| Global window | Hard | model-dependent | Budgeter |
| Reserved output | Hard | 15% of window | Budgeter |
| Stage soft | Advisory | per §3.3 | Compression trigger |
| Stage hard | Hard | 2× soft | Emergency trimming |
| Per-user/minute | Hard | policy | Admission |
| Per-tenant/day | Hard | policy | Admission |
| Per-agent invocation | Hard | policy | Admission |

- **Emergency trimming:** progressive compression → drop optional stages → refuse.
- **Adaptive budgeting:** per-agent budgets adjusted from evaluation metrics (§11) via governance change control.
- **Provider-specific budgets:** each adapter declares real window; POE uses the minimum of policy and provider.
- **Streaming budgets:** early-stop when reserved output tokens exhausted.
- **Cost optimisation:** cheapest-adequate model selected per policy (§10).

---

## 6. Memory Injection (integration with EDS-001)

### 6.1 Retrieval Timing
Memory retrieval starts in parallel with stages 6–11 to hide latency; final selection occurs at stage 12.

### 6.2 Retrieval Interface
```
MemoryQuery {
  userId, journeyId?, agent, intent,
  filters { types, tags, minConfidence, notOlderThan },
  budgetTokens, k, mode: "semantic"|"hybrid"|"graph"
}
```
Returns `MemoryHit[]` with `explanation` per EDS-001 §H4.

### 6.3 Ranking
Weighted score `w_sim·sim + w_rec·recency + w_imp·importance + w_ident·identityAlign + w_goal·goalAlign + w_journey·journeyAlign − w_conf·conflict`.

### 6.4 Filtering
Confidence ≥ 0.4 by default; PII-tagged memories require explicit consent flag.

### 6.5 Deduplication
Content-hash + semantic dedupe (cosine ≥ 0.92 dropped).

### 6.6 Conflict Handling
Contradictory memories surfaced with `conflict` marker; UDE arbitrates; POE never silently drops the loser.

### 6.7 Identity / Goal / Journey Weighting
Weights loaded from agent profile, overridable per call; defaults published in profile registry.

### 6.8 Confidence Thresholds
Below 0.4 → excluded. 0.4–0.6 → labelled `low-confidence` in prompt. ≥ 0.6 → normal.

### 6.9 Explainability Metadata
Every injected memory carries `{id, type, sourceEvent, retrievedBy, score, componentScores}` recorded in trace.

### 6.10 Provenance
Trace links each memory back to its EDS-001 storage row for audit.

### 6.11 Failure Recovery
Memory Engine unavailable ⇒ stage 12 degrades to empty; run is marked `memory:degraded`; caller receives soft warning.

---

## 7. Tool Injection

### 7.1 Selection
Tools filtered by (agent allow-list) ∩ (capability policy) ∩ (safety policy) ∩ (user consent).

### 7.2 Capability Mapping
Each tool declares capability tags; POE selects only tools relevant to the current intent (via UDE hint or agent profile).

### 7.3 Ordering
Deterministic — alphabetical within priority band; priorities from ToolRegistry.

### 7.4 Invocation Planning
POE exposes tools; the LLM proposes calls. POE executes according to `parallel` / `sequential` flags declared per tool.

### 7.5 Parallelism
Independent tools run concurrently up to `maxParallelTools` (default 4).

### 7.6 Sequential
Declared dependencies enforced as a DAG; cycles rejected at registration.

### 7.7 Fallback
Each tool may declare a `fallbackToolId`; used only on transient failure classes.

### 7.8 Timeout
Per-tool timeout, default 8 s; overrides in ToolRegistry.

### 7.9 Retry
At most 1 retry for idempotent tools; non-idempotent tools never retried by POE.

### 7.10 Cancellation
Cascades from parent prompt cancellation.

### 7.11 Structured Responses
Tool results are JSON-schema validated; failure → surfaced to LLM as `tool_error` with typed reason.

### 7.12 Error Propagation
Tool errors never crash POE; they become model-visible structured errors.

### 7.13 Provenance
Every tool call is a span in `PromptTrace` with inputs (hashed), outputs (hashed), latency, cost.

---

## 8. Output Contracts

### 8.1 JSON Schema Enforcement
All outputs (except free-form Concierge text) MUST resolve to a registered schema in ContractRegistry, versioned semver.

### 8.2 Typed Responses
Callers receive typed values; POE never returns raw provider text to typed callers.

### 8.3 Validation
Two passes: structural (JSON well-formed) → semantic (schema + refinements).

### 8.4 Streaming JSON
Incremental parser validates prefix-well-formedness; schema-level checks applied to completed sub-objects.

### 8.5 Partial Responses
Callers may opt in to `partial=true`; partials carry `completeness` metadata.

### 8.6 Repair Strategy
On validation failure: one bounded repair attempt using a repair-profile prompt with the error message and the invalid output as inputs. No second repair.

### 8.7 Schema Versioning
Semver; minor = additive optional fields; major = breaking. Expand/Migrate/Contract lifecycle (mirrors EDS-001 §H6).

### 8.8 Compatibility
Consumers pin `schema.version`; POE selects compatible model behavior.

---

## 9. Prompt Versioning

- **Identifiers:** `promptProfileId@semver` + `stageSet@semver`.
- **Compatibility:** minor changes must be backward-compatible in trace shape.
- **Migration:** dual-run (shadow) required before flip.
- **Rollback:** any profile can be pinned to previous semver via governance flag within 60 s.
- **Canary:** default rollout 1% → 10% → 50% → 100% over 72 h with SLO gates.
- **Shadow prompts:** shadow profile evaluated on production traffic without affecting user; results compared offline.
- **A/B testing:** experiment framework (§11) assigns cohorts by hashed userId.
- **Deprecation:** 30-day notice, telemetry-driven; removal requires zero-traffic 7 days.
- **Audit history:** every profile change recorded with author, diff, rationale, approval.

---

## 10. Provider Abstraction

### 10.1 Capability Matrix
Per model: contextWindow, maxOutputTokens, supportsStreaming, supportsToolCalls, supportsStructuredOutput, supportsVision/audio, costPerInputToken, costPerOutputToken, region, deprecationDate.

### 10.2 Adapter Contract
```
ProviderAdapter {
  id, version
  translate(PromptIR) -> ProviderRequest
  invoke(ProviderRequest, opts) -> Stream|Response
  parseError(err) -> POEError
  reportUsage(resp) -> Usage
}
```

### 10.3 Provider Selection Policy
Order: policy override → cheapest-adequate for schema/tools → latency-optimised → fallback chain.

### 10.4 Failover
On classified retriable error, POE walks the declared fallback chain (max 2 hops), preserving fingerprint.

### 10.5 Streaming Differences
Adapters normalise to POE stream events: `token`, `tool_call`, `tool_result`, `finish`.

### 10.6 Tool-Calling Differences
Adapters translate POE tool schema ↔ provider format; unsupported ⇒ POE falls back to JSON-mode tool emulation.

### 10.7 Structured-Output Differences
Preference: native JSON mode > function-tool coercion > post-hoc parse+repair.

### 10.8 Cost Awareness
Every dispatch records forecast vs actual cost; deviation feeds routing.

### 10.9 No Lock-in
No provider-specific fields cross the POE boundary; adapter tests verify parity.

---

## 11. Prompt Evaluation Framework

### 11.1 Metrics
Answer correctness, hallucination rate, instruction adherence, context utilisation, memory usefulness, tool usefulness, latency, token efficiency, cost per successful turn, user acceptance (thumbs, edits, abandonment).

### 11.2 Regression Thresholds
Blocking: hallucination > baseline + 2%, correctness < baseline − 3%, cost > baseline + 15%.

### 11.3 Datasets
Golden sets per agent profile; refreshed monthly; privacy-scrubbed.

### 11.4 Offline Evaluation
Batch harness runs candidate profile against golden sets before canary.

### 11.5 Online Evaluation
Sampled traces auto-scored by rubric evaluator; human-review queue for low scores.

### 11.6 A/B Experiments
Cohort assignment via stable hash; minimum sample size and power computed per metric.

---

## 12. Observability

- **Tracing:** OpenTelemetry-compatible; one root span per prompt run; child spans per stage, per tool call, per provider invocation.
- **IDs:** `promptRunId`, `promptFingerprint`, `correlationId` (linked to UDE Decision Record).
- **Metrics:** counters (runs, failures per class), histograms (latency, tokens, cost), gauges (in-flight, queue depth).
- **Logs:** structured; no prompt content; content refs by fingerprint only.
- **Dashboards:** per-agent, per-model, per-tenant.
- **Alerts:** SLO burn-rate, provider error spikes, budget breaches, validation regression.
- **Audit trails:** every run recorded to durable, immutable audit log (retention per policy).

---

## 13. Security & Privacy

- **Prompt isolation:** per-request context; no shared mutable in-process state across users.
- **Cross-user protection:** tenant + userId bound at admission; all retrievers RLS-scoped.
- **Secret handling:** secrets never enter prompts; secrets available to tools via secret-broker only.
- **Prompt injection resistance:** untrusted content demarcated with typed fences; system stages inviolable; injection detector runs pre-dispatch.
- **Tool injection resistance:** tool descriptions are trusted; tool *outputs* are untrusted and fenced.
- **Data leakage prevention:** output scan for known secrets/PII before emit.
- **PII handling:** field-level redaction inherited from EDS-001; overrides logged.
- **Consent:** consent flags checked at admission; missing consent ⇒ stage-level exclusion.
- **Audit logging:** immutable; supports RTBF by tombstoning content pointers while preserving structural audit.
- **Compliance:** aligns with EDS-001 compliance surface (GDPR / regional residency).

---

## 14. Failure Handling

| Failure | Detection | Action |
|---|---|---|
| Assembly error | Stage exception | Fail run; trace |
| Compilation error | IR validator | Fail run |
| Budget overflow | Budgeter | Compress → drop → refuse |
| Safety block | Safety gate | Refuse with reason |
| Provider timeout | Invoker | Retry (≤2) → failover |
| Provider 5xx | Invoker | Failover chain |
| Provider 4xx | Invoker | No retry; classify |
| Stream interruption | Invoker | Resume if idempotent, else fail |
| Validation failure | Validator | 1 repair → fail |
| Tool failure | Tool runner | Structured error to LLM |
| Cancellation | Token | Abort within 250 ms |
| Memory outage | Injector | Degrade stage 12 |
| Dead-letter | Terminal fail | Persist to DLQ for offline analysis |

Graceful degradation is always **explicit and labelled**, never silent.

---

## 15. Testing Strategy

- **Unit:** each stage, injector, adapter, validator, repair strategy.
- **Integration:** end-to-end with Memory Engine, Tools, WIM, TIE using fixtures.
- **Contract:** provider adapters verified against golden IR conversions.
- **Load:** target 10× peak QPS; assembly p95 ≤ 35 ms.
- **Stress:** window saturation, budget exhaustion, tool storms.
- **Chaos:** inject provider outages, memory outages, partial network partitions.
- **Security:** injection corpus, jailbreak set, PII exfiltration tests, tool-abuse tests.
- **Regression:** golden set on every profile change; blocking thresholds §11.2.
- **Performance:** cold vs warm cache, streaming first-token latency, cancellation propagation.
- **Provider compatibility:** matrix run per adapter release.

---

## 16. Engineering Decision Records (EDRs)

**EDR-01 Typed fragments over string templates.** Rationale: prevents accidental injection, enables budgeting, enables per-stage caching. Alt: Handlebars/Jinja templates. Trade-off: authoring overhead. Consequence: strict authoring APIs required.

**EDR-02 Provider-neutral IR (`PromptIR v1`).** Rationale: multi-provider portability. Alt: per-provider builders. Consequence: adapter layer becomes the only place with vendor code.

**EDR-03 17-stage canonical ordering.** Rationale: determinism, review clarity, ordered composition. Alt: free-form composition. Consequence: new capabilities extend via new stages, never reordering.

**EDR-04 Memory injection at stage 12 (post-context, pre-simulation).** Rationale: memory is contextual, not identity; must see journey+goal frame. Alt: earlier injection. Consequence: retrieval budget known.

**EDR-05 One repair attempt maximum.** Rationale: cost + latency ceiling; prevents infinite loops. Alt: N-attempt loops. Consequence: schemas must be robust.

**EDR-06 Provider fallback max 2 hops.** Rationale: bounded latency. Alt: unlimited chain. Consequence: chain design is a policy artefact.

**EDR-07 Fingerprint = SHA-256 of pre-adapter IR.** Rationale: stable dedupe/audit key across providers. Alt: post-adapter hash. Consequence: adapter changes never invalidate audit.

**EDR-08 Streaming validators are prefix-aware.** Rationale: early-cancel bad outputs. Alt: buffered validation only. Consequence: parser complexity.

**EDR-09 Safety gate is non-bypassable.** Rationale: security. Alt: opt-out flag. Consequence: none.

**EDR-10 Assembly runs in-process; retrieval is I/O parallel.** Rationale: assembly is CPU-cheap; retrieval dominates. Alt: separate assembly service. Consequence: fewer network hops.

**EDR-11 Repair uses a distinct profile.** Rationale: separates repair prompt evolution from primary prompt. Alt: reuse primary. Consequence: two profiles to version.

**EDR-12 Canary + shadow are first-class.** Rationale: safe evolution. Alt: hard cutover. Consequence: infra cost.

---

## 17. Production Readiness Checklist

- [ ] Correctness: golden-set pass at or above baseline.
- [ ] Performance: assembly p95 ≤ 35 ms; streaming FTL p95 ≤ 1.2 s.
- [ ] Security: injection corpus recall ≥ 0.97; secret-leak scan pass.
- [ ] Privacy: PII redaction verified; RTBF path exercised.
- [ ] Scalability: 10× peak load test passed.
- [ ] Maintainability: stages documented, EDRs current.
- [ ] Observability: spans, metrics, dashboards, alerts wired.
- [ ] Provider readiness: ≥ 2 adapters certified; failover drill executed.
- [ ] Versioning: profile registry live; rollback drill executed.
- [ ] Rollback readiness: 60-second flag flip verified.
- [ ] Documentation: EDS-002 + runbooks published.
- [ ] Testing: unit ≥ 90%, integration critical paths, chaos scenarios passing.

---

## 18. Future Extensibility

- **New stages:** appended (never reordered) with governance approval.
- **New providers:** new adapter; no core change.
- **New capabilities:** register capability rules stage input; no pipeline change.
- **New memory strategies:** EDS-001 evolves; POE consumes via existing MemoryQuery.
- **New tools:** ToolRegistry entry; no code in POE.
- **New schemas:** ContractRegistry entry.
- **Multi-modal (vision, audio, video):** new `ModalityFragment` type in `PromptIR v1.x` (additive); adapters declare modality support; unsupported modalities dropped with explicit degradation.
- **Voice:** treated as an intent modality; transcription upstream of POE.
- **Reasoning models:** stage 8 (Experience) + stage 13 (Simulation) provide thinking budget hints; adapters expose `reasoning_effort`.
- **Long-context models:** budget policy per model; stages unchanged.
- **Plugin stages (enterprise):** sandboxed plugin stages allowed only in optional slots 8/11/13/15 via MAG governance.
- **Future AI providers:** adapter-only work.

All extensibility paths preserve JIP v1.3 architecture and EDS-001 contracts.

---

## 19. Engineering Consistency Review

| Check | Result |
|---|---|
| Duplicated responsibilities | None — each stage/subsystem has single owner |
| Ordering ambiguity | Resolved by §3.1 total order |
| Undefined ownership | All stages own by named subsystem |
| Circular dependencies | None — DAG verified (Mission→…→User Intent) |
| Provider lock-in | None — IR + adapters isolate |
| Hidden state | None — all state is per-run and traced |
| Prompt leakage | Prevented by structured logging + fingerprint refs |
| Missing observability | Full trace + metrics coverage |
| Missing security | Non-bypassable safety gate + audit |
| EDS-001 compatibility | MemoryQuery + provenance align with §H4 |
| JIP v1.3 compatibility | POE remains the sole prompt path; no boundary changes |
| AI Core compatibility | POE is the engine AI Core invokes; interfaces unchanged |
| TIOS / TIE / Mesh / XE / TEE / UDE | All integrate through existing typed contracts |

No inconsistencies detected.

---

## 20. Final Engineering Assessment

The Prompt Orchestration Engine specification is complete, internally consistent, compatible with JIP v1.3 and EDS-001, and ready to serve as the permanent engineering baseline for all LLM prompt construction and invocation across Easy Trip.

**"EDS-002 Prompt Orchestration Engine Engineering Specification — Frozen"**

Future changes proceed via formal amendments (EDS-002.Ax) rather than document rewrites.
