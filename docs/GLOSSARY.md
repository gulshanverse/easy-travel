# Glossary — v1.0

Canonical definitions for Easy Trip. Documents link here; they do not redefine terms.

- **AI Core** — Central orchestrator that invokes LLMs on behalf of every agent, feature, and capability. Sole caller of the Prompt Orchestration Engine.
- **TIOS (Travel Intelligence Operating System)** — Contract, policy, dependency, and observability substrate for capabilities.
- **TIE (Travel Intelligence Engine)** — Domain engine for journeys, itineraries, budgets, timelines, collaboration.
- **JIP (Journey Intelligence Platform)** — Architectural umbrella defining every intelligence subsystem. Baseline: v1.3, frozen.
- **EDS (Engineering Design Specification)** — Implementation-grade specification for a JIP subsystem. Numbered EDS-NNN.
- **ADR (Architecture Decision Record)** — Permanent record of an architectural decision.
- **EDR (Engineering Decision Record)** — Permanent record of an engineering decision (may be inline within an EDS or a top-level file).
- **Memory Engine** — Persistence and recall substrate; spec = EDS-001.
- **Prompt Orchestration Engine (POE)** — Deterministic prompt assembly + invocation engine; spec = EDS-002.
- **Prompt Runtime** — Execution surface of POE (admission → assembly → compilation → dispatch → validation → emit).
- **Intelligence Mesh** — Typed event/message bus connecting intelligence subsystems.
- **Journey Graph** — Structured representation of a journey (nodes, transitions, states).
- **Experience Graph** — Structured representation of experience quality signals (flow, mood, serendipity).
- **Identity Intelligence Engine (IIE)** — Models durable traveller identity and personality drift.
- **Simulation Engine** — Runs hypothetical trip variations for planning and comparison.
- **Unified Decision Engine (UDE)** — Central arbitration core; composes proposals into explainable Decision Records.
- **Multi-Agent Governance (MAG)** — Sandbox + arbitration layer for specialised agents.
- **Companion** — User-facing agent persona (Concierge, Planner, Curator, etc.).
- **Provider** — External LLM / travel content / payment provider abstracted behind adapters.
- **Capability** — Named, contracted domain skill exposed via TIOS (planner, search, weather, etc.).
- **Tool** — Callable function surface exposed to an LLM by POE via the Tools Registry.
- **Memory** — A stored, addressable unit of user or platform knowledge (working, session, journey, DNA, etc.).
- **Context** — Ephemeral input frame assembled for a single prompt or decision.
- **PromptIR** — Provider-neutral intermediate representation of a compiled prompt.
- **Fragment** — Typed output of a single POE assembly stage.
- **Fingerprint** — SHA-256 of a compiled PromptIR; stable audit + cache key.
- **Trace** — Structured, spanned record of a prompt run consumable by Explainability, Trust & Evidence, and observability.
- **Frozen** — Document state indicating no further edits without amendment.
- **Canary** — Progressive rollout of a new version to a small traffic slice with SLO gates.
- **Shadow** — Parallel execution of a candidate version without user-visible effect.
