# Documentation Changelog

Governed by `docs/DOCUMENTATION_HUB_v2.0.md`.

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
