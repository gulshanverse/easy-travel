# EBP-001 — Engineering Blueprint & Development Constitution

- **Status:** Frozen
- **Version:** 1.0
- **Frozen:** 2026-07-09
- **Owner:** Platform Governance + Engineering Leadership
- **Parent:** `docs/DOCUMENTATION_HUB_v2.0.md`
- **Depends On:** Master Vision v1.0, PRD v2.0, JIP v1.3, EDS-001 v1.1, EDS-002 v1.0
- **Consumers:** All engineering (present and future), all EDS authors, all implementation waves
- **Class:** Governance / Constitution
- **Amendment Policy:** Immutable once Frozen. Changes require an ADR approved by Governance and a versioned supersession (`EBP-001 v1.x`).

> EBP-001 is the **engineering constitution** of Easy Trip. It defines **HOW** the platform is engineered. It does not redefine **WHAT** is built — that authority belongs to the PRD (product), JIP (architecture), and EDS series (engineering specifications). Every future implementation must comply with this document.

---

## 0. Non-Modification Guarantee

This document is strictly additive. It does not modify:
- Homepage, Journey Studio, or any UI component
- Backend, AI Core, TIOS, TIE, capability layer, APIs, routing, database, or authentication
- Existing architecture (JIP v1.3) or engineering specifications (EDS-001, EDS-002)
- Any frozen baseline in the Documentation Hub

EBP-001 sits *alongside* those documents as governance. It changes no runtime behaviour.

---

## 1. Engineering Philosophy

The following principles apply to every engineering activity in Easy Trip. They are ranked; when principles collide, the higher-numbered principle yields to the lower-numbered one only after an ADR justifies the trade-off.

1. **AI-first platform.** Intelligence is a first-class runtime concern, not a feature. Every subsystem exposes signals to the AI layer and consumes decisions from it.
2. **Intelligence-first architecture.** Data, events, and interfaces are designed for reasoning first and CRUD second. If a design cannot be reasoned over, it is redesigned.
3. **Domain-Driven Design (DDD).** Bounded contexts (Journey, Memory, Prompt, Recommendation, Knowledge, Trust, Identity, Relationship, Goal, Capability) own their language, invariants, and storage.
4. **Event-Driven Architecture (EDA).** Cross-context communication happens through domain events with explicit contracts. Synchronous coupling across contexts is a smell.
5. **Modular Monolith with Microservice Readiness.** Ship one deployable today; keep module seams clean enough to extract services tomorrow without redesign.
6. **API-first.** Every capability is defined as a typed contract before implementation. UI, agents, and internal tools consume the same contract.
7. **Documentation-Driven Engineering.** Specs precede code. Behaviour without a spec is a bug in the specification, not the code.
8. **Design System First.** UI is composed from tokens and components, never from ad-hoc styles.
9. **Testability First.** Modules are shaped so that unit, contract, and evaluation tests are trivial to write.
10. **Performance by Default.** Every path has a budget; regressions are treated as defects.
11. **Security by Design.** Threat modelling is part of design, not audit.
12. **Accessibility by Default.** WCAG 2.2 AA is the floor, not the ceiling.
13. **Scalability over shortcuts.** Prefer a slightly slower correct path to a fast fragile one.
14. **Backward Compatibility Strategy.** All contracts follow Expand → Migrate → Contract; no breaking change ships without a deprecation window.
15. **Maintainability over cleverness.** Optimise for the next engineer, not the current one.

---

## 2. Repository Organization

The current repository is a modular monolith rooted in `src/`. EBP-001 defines the **target hierarchy** every new area must adopt as it grows. Reserved directories are created only when their first inhabitant lands.

| Directory | Responsibility | Current Location |
|---|---|---|
| `apps/` | User-facing deployable applications (web, future mobile). | `src/routes/`, `src/components/` |
| `packages/` | Reusable, versioned internal libraries with public APIs. | Reserved |
| `services/` | Extractable domain services (post-monolith split). | Reserved |
| `shared/` | Cross-cutting types, utilities, design tokens. | `src/lib/utils.ts`, `src/styles.css` |
| `docs/` | All governed documentation. | `docs/` |
| `tests/` | Test suites not colocated with source. | Reserved |
| `infra/` | Infrastructure-as-code, environment definitions. | Reserved |
| `scripts/` | Operational and developer tooling scripts. | Reserved |
| `assets/` | Design assets not served as static files. | Reserved (public assets remain in `public/`). |

Rules:
- Every top-level directory has exactly one owning team documented in the Ownership Matrix.
- No directory contains code from more than one bounded context except `shared/`.
- `shared/` is append-mostly; anything domain-specific must migrate to its owning package.

---

## 3. Naming Conventions

One convention, enforced everywhere.

| Concept | Convention | Example |
|---|---|---|
| Components (React) | `PascalCase.tsx` | `JourneyTimeline.tsx` |
| Hooks | `useCamelCase.ts` | `useJourneyDraft.ts` |
| Services | `camelCase.service.ts` or `camelCase.server.ts` | `journey.server.ts` |
| Utilities | `camelCase.ts` | `formatDuration.ts` |
| Events (domain) | `PascalCase.PastTense` | `JourneyCreated`, `MemoryWritten` |
| Capabilities | `kebab-case` id, `PascalCase` type | id `journey-planner`, type `JourneyPlannerCapability` |
| Agents | `PascalCase` suffix `Agent` | `PlannerAgent` |
| Prompts | `kebab-case` id | `journey.compose.system` |
| Tools (AI) | `snake_case` name | `search_flights` |
| Memory objects | `PascalCase` type, `kebab-case` kind | type `EpisodicMemory`, kind `journey-note` |
| Database entities | `snake_case` tables, `snake_case` columns | `user_roles.role` |
| Enums | `PascalCase` type, `SCREAMING_SNAKE_CASE` variants | `MemoryKind.EPISODIC` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_PROMPT_TOKENS` |
| Files (non-component) | `kebab-case` | `prompt-orchestrator.ts` |
| Directories | `kebab-case` | `journey-intelligence/` |
| Branches | `type/scope-short-title` | `feat/memory-episodic-retrieval` |
| Commits | Conventional Commits | `feat(memory): add episodic retrieval` |
| Tags | `vMAJOR.MINOR.PATCH` | `v1.3.0` |

Ambiguous cases are resolved in favour of the row above them (component wins over utility, capability id wins over service name).

---

## 4. Module Boundaries

Bounded contexts and their ownership. Each module owns its data, contracts, events, and internal invariants.

| Module | Owns | Public Surface |
|---|---|---|
| **Journey Engine (TIE)** | Journeys, timeline, versions, drafts | Typed API + `Journey*` events |
| **Memory Engine (EDS-001)** | Episodic / semantic / procedural memory | Retrieval + persistence API + `Memory*` events |
| **Prompt Engine (EDS-002)** | PromptIR, stage pipeline, model I/O | POE `assemble()` / `run()` + `Prompt*` events |
| **Recommendation Engine** | Ranked suggestions, portfolio optimisation | `recommend()` capability + `Recommendation*` events |
| **Knowledge Graph** | Entities, relations, facts | Query API + `Knowledge*` events |
| **Spatial Intelligence** | Geography, routing, distances | Spatial query API |
| **Trust & Evidence Engine (TEE)** | Confidence, citations, provenance | `evidence()` API + validation gates |
| **Relationship Engine** | Companions, groups | Relationship API |
| **Goal Engine** | Traveller goals, goal graph | Goal API |
| **Capability Layer** | Tool contracts and services | `Capability` contracts (`src/lib/capabilities/`) |
| **AI Core** | Agents, providers, gateway | `invoke()` server functions |
| **TIOS** | Runtime, policy, orchestration | `src/lib/tios/index.ts` |
| **TIE** | Domain orchestration for travel | `src/lib/tie/index.ts` |

**Direct-call matrix** (✓ allowed, ✗ forbidden, — via events):

|              | UI | Cap | Journey | Recomm | Memory | Prompt | Know | Trust | AI Core | TIOS | Infra |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **UI**       | — | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Cap**      | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| **Journey**  | — | — | — | — | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| **Recomm**   | — | — | — | — | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| **Memory**   | — | — | — | — | — | — | — | — | — | ✓ | ✓ |
| **Prompt**   | — | — | — | — | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Trust**    | — | — | — | — | ✓ | — | ✓ | — | — | ✓ | ✓ |
| **AI Core**  | — | — | — | — | ✓ | ✓ | — | ✓ | — | ✓ | ✓ |
| **TIOS**     | — | — | — | — | — | — | — | — | — | — | ✓ |

**Forbidden patterns:**
- UI reaching past the capability layer.
- Any domain module importing UI code.
- Memory or Knowledge importing Prompt (reverse-dependency).
- Direct database access from anywhere outside a module's owning service files.

Contracts are Zod-validated at every module boundary.

---

## 5. Dependency Rules

Allowed vertical flow (top depends on bottom, never reverse):

```text
UI
 ↓
Capabilities
 ↓
Journey Intelligence (TIE + Journey/Recommendation/Knowledge/Trust)
 ↓
AI Core (Agents · Prompt Engine · Memory Engine)
 ↓
TIOS (runtime, policy, providers)
 ↓
Infrastructure (Supabase, gateway, providers)
 ↓
Database
```

Rules:
- Reverse dependencies are prohibited. Where a lower layer needs a higher-layer decision, apply **dependency inversion**: the lower layer defines the interface, the higher layer provides the implementation via TIOS registration.
- Cross-context calls at the same level go through **events** or through a **capability contract**, never through direct imports.
- No module may import from another module's internal (non-index) files.

---

## 6. Event Standards

### 6.1 Naming
- Format: `PascalCase` past-tense verb — `JourneyCreated`, `JourneyUpdated`, `RecommendationGenerated`, `MemoryWritten`, `BookingStarted`, `ContextAssembled`, `GoalChanged`, `TripPublished`.
- Events are facts; never imperative (`CreateJourney` is a command, not an event).

### 6.2 Envelope

```
{
  "event_id": "uuid",
  "event_name": "JourneyCreated",
  "event_version": 1,
  "occurred_at": "RFC3339",
  "producer": "tie.journey",
  "correlation_id": "uuid",     // request/session scope
  "causation_id": "uuid|null",  // event that caused this one
  "actor": { "kind": "user|agent|system", "id": "..." },
  "tenant_id": "uuid|null",
  "payload": { ... }            // schema-versioned
}
```

### 6.3 Versioning
- Payload changes follow **Expand → Migrate → Contract**.
- Breaking changes bump `event_version` and ship both versions during migration.
- Consumers must tolerate unknown optional fields.

### 6.4 Rules
- Every event has an owning module and a schema in that module's `events/` folder.
- Events are immutable after emission.
- No PII in event payloads unless the field is explicitly marked and encrypted at rest.

---

## 7. Error Handling

### 7.1 Taxonomy
| Category | Example | Retryable? | User-facing? |
|---|---|---|---|
| Domain error | `JourneyLockedError` | No | Yes, translated |
| Validation error | Zod schema failure | No | Yes, field-scoped |
| Infrastructure error | DB timeout | Yes | Generic |
| AI error | Provider 5xx, safety refusal | Yes / No | Contextual |
| Authorization error | RLS denied | No | Yes, minimal |

### 7.2 Policies
- **Retry:** exponential backoff (100ms → 2s, max 5 attempts) for idempotent infrastructure calls only.
- **Fallback:** every AI call declares a fallback chain (see §15).
- **Circuit breaker:** open after 5 consecutive failures in 30s; half-open after 60s.
- **Graceful degradation:** degrade features, never crash the surface. A dead recommendation service returns an empty list with a `degraded=true` flag, not a 500.
- **User-safe messaging:** never leak stack traces, internal IDs, or provider names to the UI.
- **Internal diagnostics:** every thrown error carries `code`, `correlation_id`, and a sanitised `cause` chain.

---

## 8. Logging Standards

- **Format:** structured JSON, one event per line.
- **Levels:** `debug`, `info`, `warning`, `error`, `critical`.
- **Required fields:** `ts`, `level`, `msg`, `correlation_id`, `module`, `env`.
- **Optional:** `causation_id`, `actor_id`, `tenant_id`, `latency_ms`, `attributes`.
- **Sensitive data policy:** never log passwords, tokens, full prompts, memory contents, PII, or provider API responses. Redact with `[REDACTED:<reason>]`.
- **Sampling:** `debug` off in production by default; `info` sampled at 100% for state-changing paths and 10% for read paths.

---

## 9. Observability

- **Metrics:** RED (Rate, Errors, Duration) per capability + AI-specific (tokens, cost, cache hit, refusal rate, hallucination score from evals).
- **Tracing:** OpenTelemetry semantic conventions; `correlation_id` propagates across UI → capability → AI Core → provider.
- **Health checks:** `/api/public/health` returns `{status, version, checks: [...]}`; each module registers its own probe via TIOS `health` API.
- **Latency budgets:** see §12.
- **Failure monitoring:** alerting on SLO burn rate (2% budget in 1h = page).
- **AI evaluation metrics:** golden-set pass rate, grounded citation coverage, refusal precision/recall — reported per release.
- **Dashboards:** one per bounded context, plus one platform overview. Every dashboard cites the runbook that responds to its alerts.

---

## 10. Testing Philosophy

| Layer | Scope | Required for |
|---|---|---|
| Unit | Pure functions, single module | Every module |
| Integration | Module + its adapters (DB, providers) | Every module with I/O |
| Contract | Provider/consumer schema compatibility | Every cross-module contract & event |
| End-to-End | User journey through UI + backend | Every top-user-flow |
| AI Evaluation | Golden sets + rubric scoring | Every prompt, agent, retrieval |
| Regression | Prior-defect corpus | Any bug fix |
| Accessibility | Axe + manual keyboard | Every UI change |
| Performance | Lab (Lighthouse CI) + field (RUM) | Every release |
| Visual Regression | Screenshot diff for critical surfaces | Design-system-touching changes |

Rules:
- Tests live next to source (`*.test.ts`) or under `tests/` when spanning modules.
- No test is skipped without an accompanying issue and expiry date.
- AI eval failures block release the same way unit failures do.

---

## 11. Security Standards

- **Authentication:** Supabase-managed sessions; MFA optional today, required for admin roles.
- **Authorization:** RLS everywhere; roles in `user_roles` table (see JIP v1.3 §Auth); `has_role()` security-definer function is the only check path.
- **RBAC:** `admin`, `moderator`, `user`. Additional roles require ADR.
- **Secrets management:** never in code, never in client bundles. Server env only. Rotation quarterly, on-demand after any suspected exposure.
- **Prompt injection protection:** POE §Safety Gates is non-bypassable; injection-detection recall ≥ 0.97 (EDS-002 KPI).
- **Tool permission boundaries:** every capability declares an allow-list of roles and effects; agents cannot invoke tools outside their manifest.
- **Memory privacy:** memories are scoped by owner and, where applicable, by companion set; cross-tenant leakage is a P0 defect.
- **Encryption:** TLS in transit; at-rest encryption for PII columns via Supabase; secret envelope for provider tokens.
- **Rate limiting:** per-user, per-IP, per-capability. Defaults defined per capability in its contract.
- **Audit logging:** every privileged action emits an immutable audit event (see §6).
- **PII handling:** classify at capture; redact before logging; honour RTBF within 30 days.

---

## 12. Performance Budgets

Measured on median devices over 4G Fast unless noted.

| Surface / Path | Metric | Budget |
|---|---|---|
| Homepage | LCP | ≤ 1.8s |
| Homepage | INP | ≤ 150ms |
| Homepage | CLS | ≤ 0.05 |
| Journey Studio (cold) | TTI | ≤ 2.5s |
| Journey Studio (warm) | Interaction latency | ≤ 100ms |
| AI response (first token) | FTL | ≤ 1.2s |
| AI response (complete, small) | p95 | ≤ 4s |
| Search results | p95 | ≤ 600ms |
| Recommendation compute | p95 | ≤ 800ms |
| Memory retrieval (vector top-k) | p95 | ≤ 250ms |
| Rendering (any frame) | Long task | ≤ 50ms |
| Animation | FPS | ≥ 60fps sustained |

Regressions ≥ 10% on any metric block release.

---

## 13. Accessibility

- **Keyboard navigation:** every interactive element reachable, visible focus ring, logical tab order.
- **ARIA:** roles, names, states on all custom widgets; no ARIA when a native element exists.
- **Focus management:** modals trap focus; route changes announce and move focus to `<h1>`.
- **Reduced motion:** honour `prefers-reduced-motion`; replace parallax/zoom with fades.
- **Screen reader support:** tested with VoiceOver + NVDA on release candidates.
- **Contrast:** ≥ 4.5:1 for text, ≥ 3:1 for large text and UI glyphs.
- **Touch targets:** ≥ 44×44 CSS px.

Accessibility failures are P1 defects.

---

## 14. Design System Engineering

- **Tokens** in `src/styles.css` `@theme`. Never hard-code colours in components.
- **Spacing scale:** 4px base; only scale values allowed in components.
- **Typography:** Fraunces (headline), Inter Tight (body). No other families without ADR.
- **Motion:** easing curves and durations are tokens; only tokens are used in components.
- **Glass surfaces:** single canonical `glass` utility; opacity/blur values live as tokens.
- **Editorial rhythm:** alternate wide/narrow/editorial sections; density limits documented per surface.
- **Components:** shadcn primitives + local `src/components/*`; variants via `cva`; no ad-hoc `className` overrides for colour or spacing.
- **Transitions:** enter/exit patterns standardised; page transitions use the shared route-transition primitive.
- **Animation philosophy:** invisible luxury (fade, slow zoom, parallax, blur); never bounce, spring, or flashy easing.

---

## 15. AI Engineering Standards

Authoritative specs: EDS-001 (Memory) and EDS-002 (POE). This section codifies the cross-cutting engineering rules.

- **Prompt lifecycle:** author → review (prompt EDR) → register in POE catalogue → golden-set eval → promote → monitor → deprecate.
- **Context assembly:** POE canonical 17-stage pipeline is the only path; no ad-hoc string concatenation.
- **Memory lifecycle:** capture → validate → embed → persist (transactional outbox) → retrieve → decay → forget (RTBF).
- **Memory retrieval:** hybrid (vector + lexical + recency) with confidence-weighted ranking; budget-capped.
- **Memory persistence:** through Memory Engine API only; no direct table writes from agents.
- **Tool routing:** MAG selects tools from an agent's manifest; unknown tools are refused.
- **Reasoning pipeline:** explicit stages (understand → plan → act → verify → explain).
- **Confidence scoring:** every output carries `[0,1]` confidence; downstream consumers may reject below-threshold values.
- **Evidence validation:** every factual claim cites an Evidence record; unsupported claims are demoted or dropped by TEE.
- **Grounding strategy:** retrieval-augmented by default; ungrounded generation is opt-in and logged.
- **Hallucination prevention:** grounded citations required for factual assertions; POE repair loop capped at 2 attempts.
- **Model fallback hierarchy:** primary → secondary (same family, different provider) → tertiary (smaller model, degraded UX flag) → static fallback content.
- **Streaming strategy:** stream by default when supported; server enforces first-token budget and stalls-out at 10s no-token.
- **AI safety boundaries:** safety and injection gates in POE are non-bypassable.
- **Context budgeting:** hierarchical; hard cap enforced by emergency trimming with a logged degradation reason.
- **Token budgeting:** per-call, per-user-per-day, per-tenant-per-day; overrun triggers cost governance in TIOS.

---

## 16. Git Workflow

- **Branching:** trunk-based. Short-lived feature branches from `main`, merged via PR. Long-lived branches require ADR.
- **Branch names:** `feat/…`, `fix/…`, `refactor/…`, `docs/…`, `chore/…`, `test/…`, `perf/…`, `sec/…`.
- **Commit convention:** [Conventional Commits](https://www.conventionalcommits.org/). Scope is the module (`memory`, `journey`, `ui`, `poe`, `tios`, `tie`, `ebp`, …).
- **PR checklist:**
  - [ ] Linked to PRD / EDS / ADR / EDR
  - [ ] Typecheck passes
  - [ ] Production build passes
  - [ ] Tests added/updated and passing
  - [ ] Accessibility audit (if UI)
  - [ ] Performance impact assessed
  - [ ] Documentation updated (Hub, Changelog, owning spec)
  - [ ] No secrets, no PII in logs
  - [ ] Backward compatibility considered (Expand/Migrate/Contract)
- **Code review:** at least one reviewer from the owning module; architecture-touching PRs require Platform reviewer; AI-touching PRs require an eval report.
- **Documentation updates:** any change to a documented behaviour must update the owning document and append to `docs/CHANGELOG.md` in the same PR.

Example commits:

```text
feat(memory): implement episodic memory retrieval
feat(journey): add collaborative planning engine
fix(ui): improve homepage accessibility contrast
refactor(tie): simplify orchestration pipeline
docs(ebp): finalize engineering constitution
```

---

## 17. Definition of Done

A feature is complete **only when all** of the following hold:

- [ ] Functional requirements from the PRD/EDS are satisfied
- [ ] Architecture (JIP v1.3) preserved; no boundary violations (§4)
- [ ] Dependency rules respected (§5)
- [ ] Typecheck passes
- [ ] Production build passes
- [ ] Accessibility audit passes (§13)
- [ ] Performance budgets met (§12)
- [ ] Tests added and passing (§10)
- [ ] Documentation updated (Hub, owning spec, Changelog)
- [ ] No `TODO`, `FIXME`, or dead code introduced
- [ ] No console errors or unhandled rejections in critical paths
- [ ] No regressions in golden-set AI evaluations
- [ ] Observability (metrics, logs, traces) in place for new paths
- [ ] Security review completed for privileged surfaces

---

## 18. Engineering Governance

- **Architecture changes** require an ADR (`docs/adr/ADR-NNNN-*.md`) approved by Platform + Governance.
- **Engineering decisions** require an EDR — project-wide in `docs/edr/` or spec-local within the owning EDS.
- **JIP modifications** require Governance review and versioned supersession (JIP v1.3 is frozen).
- **EDS modifications** require Engineering Review and versioned supersession.
- **Documentation Hub** (`docs/DOCUMENTATION_HUB_v2.0.md`) is the single navigation source. Every new document is registered there.
- **Cross-document references** are mandatory: every EDS cites its parent JIP section; every implementation PR cites its EDS clause.
- **Frozen documents** cannot be modified. Changes ship as `vX.Y` successors with an ADR explaining the transition and a supersession pointer on the prior version.

---

## 19. Traceability

EBP-001 threads through the documentation ecosystem as follows:

| Document | Relationship to EBP-001 |
|---|---|
| Master Vision v1.0 | Provides product philosophy; EBP encodes it as engineering principles (§1, §14). |
| PRD v2.0 (Journey Studio) | Source of functional requirements; EBP defines how they are engineered (§17). |
| Journey Studio Design | Consumed by §14 (Design System Engineering). |
| Documentation Hub v2.0 | Parent governance document; EBP is registered here (see Changelog). |
| JIP v1.3 (Frozen) | Source of module map; EBP §4 encodes boundaries, §5 encodes flow. |
| EDS-001 Memory Engine (Frozen) | Authoritative for Memory; EBP §15 codifies cross-cutting rules. |
| EDS-002 POE (Frozen) | Authoritative for Prompt Orchestration; EBP §15 codifies cross-cutting rules. |
| Knowledge Graph (`Knowledge_Graph.mmd`) | EBP-001 registered as a governance node under Governance domain. |
| TIE Architecture (`docs/TIE.md`) | Consumed by §4 module map. |
| ER Diagram (reserved `docs/database/`) | Will inherit §3 naming and §11 security rules once authored. |
| Glossary v1.1 | Canonical terms used throughout EBP. |
| Engineering Roadmap | Sequences the work EBP governs. |

Every future document MUST state its relationship to EBP-001 in its front-matter under a `Depends On` or `Governed By` field.

---

## 20. Audit Summary

| Check | Result | Evidence |
|---|---|---|
| Constitution addresses all 19 mandated sections | PASS | §1–§19 |
| No modification to frozen baselines | PASS | JIP v1.3, EDS-001, EDS-002 untouched |
| No implementation code introduced | PASS | Docs-only diff |
| Registered in Documentation Hub v2.0 | PASS | Hub §4 ownership + §2 dependency updated |
| Registered in Knowledge Graph | PASS | Governance node added |
| Cross-references complete | PASS | §19 traceability |
| Naming conventions single-source | PASS | §3 sole authority |
| Dependency rules non-contradictory with JIP v1.3 | PASS | §5 mirrors JIP layering |
| Every module has an owner | PASS | §4 table |
| Every event has an envelope schema | PASS | §6.2 |
| DoD enforces typecheck + build + a11y + perf + docs | PASS | §17 |
| Governance path defined for changes | PASS | §18 |

**Audit result: PASS.**

---

## Freeze Declaration

**EBP-001 Engineering Blueprint & Development Constitution — Frozen (2026-07-09).**

Amendments require an ADR and a versioned successor (`EBP-001 v1.x`). Every subsequent implementation wave — starting with EDS-001 (Memory Engine) — operates under this constitution.
