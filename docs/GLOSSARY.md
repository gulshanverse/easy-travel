# Glossary — v1.1

Canonical definitions for Easy Trip. Documents link here; they do not redefine terms.
Governed by `docs/DOCUMENTATION_HUB_v2.0.md` §11.

## Platform & Architecture
- **AI Core** — Central orchestrator that invokes LLMs on behalf of every agent, feature, and capability. Sole caller of the Prompt Orchestration Engine.
- **TIOS (Travel Intelligence Operating System)** — Contract, policy, dependency, and observability substrate for capabilities.
- **TIE (Travel Intelligence Engine)** — Domain engine for journeys, itineraries, budgets, timelines, collaboration.
- **JIP (Journey Intelligence Platform)** — Architectural umbrella defining every intelligence subsystem. Baseline: v1.3, frozen.
- **Intelligence Mesh** — Typed event/message bus connecting intelligence subsystems.
- **Capability** — Named, contracted domain skill exposed via TIOS (planner, search, weather, etc.).
- **Tool** — Callable function surface exposed to an LLM by POE via the Tools Registry.
- **Provider** — External LLM / travel content / payment provider abstracted behind adapters.
- **Companion** — User-facing agent persona (Concierge, Planner, Curator, etc.).
- **Agent** — Autonomous or semi-autonomous LLM-driven actor governed by MAG.

## Intelligence Subsystems
- **Memory Engine** — Persistence and recall substrate; spec = EDS-001.
- **Vector Memory** — Vector-indexed subset of Memory Engine.
- **Prompt Orchestration Engine (POE)** — Deterministic prompt assembly + invocation engine; spec = EDS-002.
- **Prompt Runtime** — Execution surface of POE (admission → assembly → compilation → dispatch → validation → emit).
- **PromptIR** — Provider-neutral intermediate representation of a compiled prompt.
- **Fragment** — Typed output of a single POE assembly stage.
- **Fingerprint** — SHA-256 of a compiled PromptIR; stable audit + cache key.
- **Trace** — Structured, spanned record of a prompt run consumable by Explainability, Trust & Evidence, and observability.
- **Unified Decision Engine (UDE)** — Central arbitration core; composes proposals into explainable Decision Records.
- **Multi-Agent Governance (MAG)** — Sandbox + arbitration layer for specialised agents.
- **Simulation Engine** — Runs hypothetical trip variations for planning and comparison.
- **Identity Intelligence Engine (IIE) / Identity** — Models durable traveller identity and personality drift. Distinct from ephemeral Context.
- **Relationship Engine** — Models companions, groups, and relational dynamics.
- **Goal Intelligence** — Goal Graph and long-horizon goal reasoning.
- **Spatial Intelligence** — Reasoning over geographic + route-level structure.
- **Journey Graph** — Structured representation of a journey (nodes, transitions, states).
- **Experience Graph** — Structured representation of experience quality signals (flow, mood, serendipity).
- **World Model (WIM)** — Time-aware model of world state exposed via TIE.
- **Portfolio Intelligence** — Optimisation across a traveller's set of journeys and options.
- **Trust Engine (TEE)** — Trust & Evidence Engine; grounds outputs in verified evidence.
- **Evidence** — Cited fact used by TEE to justify a decision or output.
- **Confidence** — Numeric belief value attached to memories, decisions, and outputs.
- **Memory** — Stored, addressable unit of user or platform knowledge.
- **Context** — Ephemeral input frame assembled for a single prompt or decision.

## Governance
- **EDS (Engineering Design Specification)** — Implementation-grade specification for a JIP subsystem. Numbered EDS-NNN.
- **ADR (Architecture Decision Record)** — Permanent record of an architectural decision.
- **EDR (Engineering Decision Record)** — Permanent record of an engineering decision (inline in an EDS or top-level).
- **RFC** — Request for Comments; pre-ADR exploration document.
- **Frozen** — Document state indicating no further edits without amendment.
- **Canary** — Progressive rollout of a new version to a small traffic slice with SLO gates.
- **Shadow** — Parallel execution of a candidate version without user-visible effect.

Every term appears exactly once. No competing definitions.
