# Documentation Changelog

Governed by `docs/DOCUMENTATION_HUB_v2.0.md`.

## 2026-07-10 — Sprint I-004 AI Provider Runtime & Model Orchestration Layer
- **Added** `src/lib/provider/` — production AI Provider Runtime (facade `ProviderRuntime`; `ProviderRegistry` + `ProviderManager` + `ProviderFactory` + adapter stubs for openai/anthropic/gemini/groq/nvidia/ollama/openrouter/azure-openai/local/custom — CONTRACT ONLY, no vendor SDKs; `ModelRegistry` with capability/context/status/lifecycle discovery + compatibility validation; `ProviderSelector` deterministic scoring by capability/latency/cost/weight/health/affinity/sticky/routing rules; `ProviderRouter` with primary + fallback chain; `ProviderHealthManager` with circuit breaker (closed/open/half-open, cooldown, recovery) + heartbeat + latency-based state; `withRetry` exponential backoff + jitter + retry budget + cancellation; `ExecutionPipeline` full lifecycle (Request → Provider Selection → Model Selection → Capability Validation → Budget Validation → Execution → Streaming → Validation → Response → Metrics → Completion) with typed lifecycle events at every stage; `UsageTracker` + token/cost accounting + budget + context-window enforcement + forecasting; `SecretProvider` + `CredentialManager` with validation + rotation hooks (no hardcoded secrets, no environment-specific logic); `ProviderMetrics` (counter/histogram/gauge), `ProviderTelemetry` (console/noop spans), `ProviderHealthChecks` aggregated diagnostics; full `ProviderError` hierarchy with severity/retryable classification; immutable env-driven `ProviderConfiguration` covering retry/circuit/health/fallback/budget/execution policies; typed `ProviderEvent` system with correlation/causation IDs, timestamps, versioning (`ProviderRegistered`, `ProviderSelected`, `ProviderUnavailable`, `ProviderRecovered`, `ModelSelected`, `ExecutionStarted`, `ExecutionCompleted`, `ExecutionFailed`, `ExecutionCancelled`, `RetryStarted`, `RetryCompleted`, `FallbackStarted`, `FallbackCompleted`, `BudgetExceeded`, `CostCalculated`, `HealthChanged`, `CircuitOpened/Closed/HalfOpen`).
- **Added** `tests/provider/runtime.test.ts` — 31 unit + integration + routing + selection + retry + fallback + health + circuit breaker + configuration + budget + concurrency + benchmark tests. All pass under Vitest.
- **Governance:** Implementation only. No vendor SDKs, no external API calls, no API-key requirements, no business logic. Memory Engine, Prompt Runtime, and Runtime Kernel NOT modified — Provider Runtime is a peer subsystem accessed via its `ProviderRuntime` façade only. No UI, homepage, Journey Studio, AI Core, TIOS, TIE, backend, APIs, routing, auth, database schema, or frozen documentation touched.


## 2026-07-09 — Sprint I-003 Runtime Core & Intelligence Infrastructure
- **Added** `src/lib/runtime/` — production Runtime Core implementing EBP-001 execution kernel primitives. Components: `RuntimeKernel` (composition root), `ExecutionContext` + `createExecutionContext` / `childContext` (frozen, deterministic, 7 typed sub-contexts: budget/memory/goal/trust/preference/capability/tool + tracing + runtime metadata + AbortSignal), `ContextBuilder` (assembles context from typed ports; Memory Engine accessed exclusively via `MemoryEnginePort`), typed `EventBus` (publish/subscribe/unsubscribe, wildcard, middleware, priority ordering, replay buffer, retry policy w/ backoff, `InMemoryDeadLetterQueue`, idempotency guard, correlation/causation, versioning, metrics), `Container` (singleton/scoped/transient lifetimes, factory + interface tokens, lazy resolution, circular-dependency detection, scoped resolvers — no service-locator anti-pattern), `ServiceRegistry` (discovery, semver validation, metadata, health), `CapabilityRuntime` (register/discover/validate/execute/dispose lifecycle, timeouts, cancellation via AbortSignal, allow/deny lists, backpressure, metrics), `RuntimeHealthChecks` (aggregated status + diagnostics), `InMemoryMetrics` (counter/histogram/gauge), `ConsoleTelemetry`/`NoopTelemetry` (structured logging + tracing spans), immutable frozen `RuntimeConfiguration` (env profiles, feature flags, capability toggles, safety flags, runtime policies), and the full `RuntimeError` hierarchy (`ConfigurationError`, `ContainerError`, `DependencyResolutionError`, `EventBusError`, `ContextError`, `CapabilityError`, `ValidationError`, `TimeoutError`, `CancellationError`) with severity/retryable classification.
- **Added** `tests/runtime/runtime.test.ts` — 22 unit + integration + concurrency + failure-recovery tests (context immutability + child propagation, config validation, event bus dispatch/priority/DLQ/retry/idempotency/middleware, container lifetimes + circular-dep detection, service registry semver + health, context builder from ports, capability execute/deny/timeout/cancellation, kernel end-to-end + parallel execution). All pass under Vitest.
- **Governance:** Runtime infrastructure only. Memory Engine + Prompt Runtime NOT modified — the runtime depends only on `MemoryEnginePort` / `PromptRuntimePort` ports, preserving dependency inversion and zero circular dependencies with Sprints I-001/I-002. No UI, homepage, Journey Studio, AI Core, TIOS, TIE, backend, APIs, routing, auth, database schema, business capabilities, LLM/provider adapters, or frozen documentation were touched.


## 2026-07-09 — Sprint I-002 Prompt Orchestration Runtime Implementation
- **Added** `src/lib/prompt/` — production Prompt Orchestration Runtime implementing EDS-002 v2.0. Components: `PromptRuntime` (facade), `PromptPipeline` (full lifecycle orchestrator), `PromptBuilder`, `PromptAssembler`, `PromptCompiler` (deterministic), `PromptExecutor` (retries, timeouts, streaming, backpressure, cancellation), `PromptRegistry` (semver + activation + rollback + audit), `PromptTemplateRegistry`, `PromptVersionManager`, `PromptContextAssembler` (with `MemoryPort` adapter — Memory Engine accessed only through its public contract), `PromptValidator`, `PromptRepairEngine`, `PromptBudgetManager` (compression + priority-ordered trim), `PromptCache` (compiled/semantic/context/template LRU+TTL, version-aware invalidation), `PromptMetrics`, `PromptTelemetry`, `PromptHealthChecks`, `PromptConfiguration`, typed event system with correlation/causation IDs, and the full `PromptError` hierarchy.
- **Added** `tests/prompt/runtime.test.ts` — 32 unit + integration + benchmark tests covering versioning, registry, templates, budget, validator, repair, cache, assembler/compiler determinism, context assembler + MemoryPort, event system, end-to-end pipeline (success, caching, retries, cancellation, health). All pass under Vitest.
- **Governance:** Implementation only. Provider-independent — no LLM SDK, vector DB, or vendor payload references. Memory Engine remains untouched and is accessed exclusively through `MemoryPort`. No changes to UI, homepage, Journey Studio, AI Core, TIOS, TIE, backend, APIs, routing, auth, database schema, or any frozen documentation.

## 2026-07-09 — Sprint I-001 Memory Engine Implementation
- **Added** `src/lib/memory/` — production Memory Engine implementing EDS-001 v2.0. Components: `MemoryManager` (facade), `MemoryRegistry`, `MemoryStore` abstraction + `InMemoryMemoryStore`, `MemoryRetriever` (10-stage deterministic pipeline), `MemoryRanker` (per-purpose weight profiles), `MemoryLifecycleManager` (soft/hard delete, restore, archive, supersede), `MemoryConfidenceEngine` (signal fusion + exponential decay), `MemoryPromotionEngine` (rules-based class promotion), `MemoryCompressionEngine` (pluggable summariser), `MemoryArchiver` (TTL + soft-delete grace sweeps), `MemoryEventPublisher` (9 typed events with correlation/causation), `MemoryFactories`, `MemoryValidators`, `MemoryTelemetry`, `MemoryMetrics`, `MemoryHealthChecks`, `MemoryConfiguration` (env-driven, no hardcoded values), and the full `MemoryError` hierarchy.
- **Added** `tests/memory/` — 29 unit + integration tests across lifecycle, retrieval, ranking, confidence/decay, promotion, compression, archiver, metrics, and health. All pass under Vitest 4.
- **Governance:** Implementation only. No changes to UI, homepage, Journey Studio, AI Core, TIOS, TIE, backend, APIs, routing, auth, database schema, or any frozen documentation (JIP v1.3, EBP-001, EDS-001 v2.0, EDS-002, Documentation Hub v2.0).


## 2026-07-09 — EDS-001 v2.0 Memory Engine Production Spec Freeze
- **Added** `docs/engineering/EDS-001_MEMORY_ENGINE_v2.0.md` — production-grade engineering specification for the Memory Engine covering purpose/non-responsibilities, 15 memory classes, full lifecycle, envelope object model, retrieval pipeline (10 stages, deterministic), confidence framework, memory graph, privacy/RTBF, retrieval budget, failure modes, reserved interfaces + logical schema, 9 event contracts, integration matrix, 5 sequence diagrams, state machine, 12 EDRs, traceability, and audits. **Frozen.**
- **Superseded** `docs/EDS-001_MEMORY_ENGINE.md` v1.1 — retained as historical predecessor; successor is v2.0.
- **Updated** `docs/DOCUMENTATION_HUB_v2.0.md` — v1.1 marked Superseded, v2.0 registered in dependency graph + ownership matrix; EDS-002 dependency updated to point at v2.0.
- **Updated** `docs/Knowledge_Graph.mmd` — added `EDS001v2` node with edges from JIP and predecessor; POE edge repointed.
- **Governance:** No UI, backend, API, routing, database, auth, JIP, EBP-001, or existing frozen EDS content modified.

## 2026-07-09 — EBP-001 Engineering Constitution Freeze
- **Added** `docs/engineering/EBP-001_ENGINEERING_BLUEPRINT.md` v1.0 — engineering constitution defining philosophy, module boundaries, dependency rules, event standards, error/logging/observability, testing, security, performance budgets, accessibility, design-system engineering, AI engineering standards, Git workflow, Definition of Done, governance, and traceability. **Frozen.**
- **Added** `docs/Knowledge_Graph.mmd` — Mermaid source for the master knowledge graph referenced by Hub v2.0 §1; EBP-001 registered as a governance node.
- **Updated** `docs/DOCUMENTATION_HUB_v2.0.md` — EBP-001 registered in §2 dependency graph and §4 ownership matrix; §1 knowledge graph annotated with EBP node.
- **Governance:** JIP v1.3, EDS-001, EDS-002, Hub v2.0 remain untouched. No product, UI, backend, API, routing, database, or auth code was modified.

## 2026-07-09 — Documentation Hub v2.0 Freeze

- **Added** `docs/DOCUMENTATION_HUB_v2.0.md` — final governance root, supersedes v1.0. Frozen.
- **Added** `docs/ENGINEERING_ROADMAP.md` v1.0 — delivery waves + maturity dashboard.
- **Added** `docs/adr/README.md` (updated) and `docs/edr/README.md` (updated).
- **Added** `docs/reserved/` scaffolding for future specifications (API, DB, infra, security, deployment, observability, plugin SDK, enterprise, runbooks, DR, compliance, guides).
- **Updated** `docs/GLOSSARY.md` → v1.1 (added Agent, Spatial Intelligence, Goal Intelligence, Trust Engine, Relationship Engine, Identity, Evidence, Confidence, Vector Memory, Portfolio Intelligence, World Model, RFC).
- **Governance:** Documentation Hub v1.0 marked Superseded (retained as `docs/DOCUMENTATION_HUB.md`).

## 2026-07-09 — Documentation Hub v1.0
- Initial governance sprint. Hub v1.0, ADR/EDR logs, Glossary v1.0, Changelog established.

## Prior History
- EDS-002 Prompt Orchestration Engine created and Frozen.
- EDS-001 Memory Engine created, hardened, Frozen.
- JIP v1.0 → v1.3 completed; v1.3 Frozen.
- Journey Studio PRD v1.0 → v2.0; v2.0 authoritative.
- Master Vision v1.0 established.
