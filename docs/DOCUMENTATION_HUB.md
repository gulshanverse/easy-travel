# Documentation Hub — v1.0

**Status:** Approved · **Owner:** Platform Governance · **Last Updated:** 2026-07-09

The Documentation Hub is the single source of truth for every artefact governing Easy Trip: vision, product, design, architecture, engineering, and operations. This document is the entry point. All other documents are indexed, related, versioned, and governed from here.

This sprint establishes **governance only**. No product, UI, backend, AI Core, TIOS, TIE, JIP, or EDS document is modified.

---

## 1. Master Documentation Index

Documents are grouped by domain. Every entry lists Title, Purpose, Status, Version, Owner, Dependencies, Related Documents, Last Updated.

### 1.1 Vision

| Title | Purpose | Status | Version | Owner | Dependencies | Related | Updated |
|---|---|---|---|---|---|---|---|
| Master Vision (`mem://vision/master`) | Product identity, brand, sensory system | Approved | 1.0 | Founding / Design | — | PRD, Journey Studio PRD | 2026-07 |

### 1.2 Product

| Title | Purpose | Status | Version | Owner | Dependencies | Related | Updated |
|---|---|---|---|---|---|---|---|
| `docs/JOURNEY_STUDIO_PRD.md` | Journey Studio product requirements v1.0 | Superseded | 1.0 | Product | Vision | Studio PRD v1.1 / v2.0 | 2026 |
| `docs/JOURNEY_STUDIO_PRD_v1.1.md` | PRD extension v1.1 | Superseded | 1.1 | Product | PRD v1.0 | PRD v2.0 | 2026 |
| `docs/JOURNEY_STUDIO_PRD_v2.0.md` | Authoritative Journey Studio PRD | Approved | 2.0 | Product | Vision, PRD v1.x | JIP, Studio design | 2026 |
| `docs/JOURNEY_STUDIO.md` | Studio design & interaction specification | Approved | 1.0 | Product / UX | PRD v2.0 | JIP | 2026 |

### 1.3 UX & Design

| Title | Purpose | Status | Version | Owner | Dependencies | Related | Updated |
|---|---|---|---|---|---|---|---|
| Master Vision (visual system) | Palette, type, motion, photography | Approved | 1.0 | Design | — | Studio design | 2026 |
| `docs/JOURNEY_STUDIO.md` (UX portions) | Studio UX contract | Approved | 1.0 | UX | PRD v2.0 | — | 2026 |

### 1.4 AI Architecture (JIP)

| Title | Purpose | Status | Version | Owner | Dependencies | Related | Updated |
|---|---|---|---|---|---|---|---|
| `docs/JOURNEY_INTELLIGENCE_ARCHITECTURE.md` | Precursor architecture note | Superseded | 0.9 | Platform | Vision | JIP v1.0–v1.3 | 2026 |
| `docs/JOURNEY_INTELLIGENCE_PLATFORM.md` | JIP v1.0 baseline | Superseded | 1.0 | Platform | Vision, PRD v2.0 | v1.1 | 2026 |
| `docs/JOURNEY_INTELLIGENCE_PLATFORM_v1.1.md` | JIP v1.1 extension | Superseded | 1.1 | Platform | JIP v1.0 | v1.2 | 2026 |
| `docs/JOURNEY_INTELLIGENCE_PLATFORM_v1.2.md` | JIP v1.2 extension | Superseded | 1.2 | Platform | JIP v1.1 | v1.3 | 2026 |
| `docs/JOURNEY_INTELLIGENCE_PLATFORM_v1.3.md` | **Authoritative JIP** — frozen baseline | Frozen | 1.3 | Platform | JIP v1.2 | EDS-* | 2026 |
| `docs/AI_CORE.md` | AI Core subsystem spec | Approved | 1.0 | Platform | JIP v1.3 | EDS-002 | 2026 |
| `docs/TIOS.md` | Travel Intelligence OS | Approved | 1.0 | Platform | JIP v1.3 | TIOS Contracts, Hardening | 2026 |
| `docs/TIOS_CONTRACTS.md` | TIOS capability contracts | Approved | 1.0 | Platform | TIOS | Capabilities | 2026 |
| `docs/TIOS_HARDENING.md` | TIOS hardening addendum | Approved | 1.0 | Platform | TIOS | — | 2026 |
| `docs/TIE.md` | Travel Intelligence Engine | Approved | 1.0 | Platform | JIP v1.3 | TIOS | 2026 |
| `docs/CAPABILITIES.md` | Capability layer specification | Approved | 1.0 | Platform | TIOS Contracts | — | 2026 |

### 1.5 Engineering Specifications (EDS)

| Title | Purpose | Status | Version | Owner | Dependencies | Related | Updated |
|---|---|---|---|---|---|---|---|
| `docs/EDS-001_MEMORY_ENGINE.md` | Memory Engine engineering spec | Frozen | 1.1 | Intelligence Eng | JIP v1.3 | EDS-002 | 2026 |
| `docs/EDS-002_PROMPT_ORCHESTRATION_ENGINE.md` | Prompt Orchestration engineering spec | Frozen | 1.0 | Intelligence Eng | JIP v1.3, EDS-001 | AI Core | 2026 |

### 1.6 Governance

| Title | Purpose | Status | Version | Owner | Dependencies | Related | Updated |
|---|---|---|---|---|---|---|---|
| `docs/DOCUMENTATION_HUB.md` (this) | Doc hub, index, governance | Approved | 1.0 | Governance | — | All | 2026-07-09 |
| `docs/adr/README.md` | ADR log & template | Approved | 1.0 | Governance | Hub | EDR | 2026-07-09 |
| `docs/edr/README.md` | EDR log & template | Approved | 1.0 | Governance | Hub | ADR | 2026-07-09 |
| `docs/GLOSSARY.md` | Canonical glossary | Approved | 1.0 | Governance | Hub | All | 2026-07-09 |
| `docs/CHANGELOG.md` | Documentation changelog | Approved | 1.0 | Governance | Hub | — | 2026-07-09 |

### 1.7 Reserved (future domains)

APIs · Database · Infrastructure · Security · Operations · Deployment · Testing · Provider Specs · SRE Runbooks · Disaster Recovery · Compliance · Developer Guides · Contribution Guide · Coding Standards · Plugin SDK · Enterprise Edition. Directories reserved in §12; no active documents yet.

---

## 2. Documentation Hierarchy

```
Vision
  └── Product (PRD)
        └── UX & Design
              └── Architecture (JIP + AI Core + TIOS + TIE + Capabilities)
                    └── Engineering Specifications (EDS-001, EDS-002, …)
                          └── Implementation (source code)
                                └── Testing (unit / integration / evaluation)
                                      └── Operations (SRE, runbooks, DR)
```

Cross-cutting: **Governance** (Hub, ADR, EDR, Glossary, Changelog) applies to every level. **Decisions** (ADR/EDR) are children of the level that made them.

Rules:
- Every document declares one **parent** and zero or more **children**.
- No orphan documents. Any document without a parent must attach to Vision or Governance.
- A superseded document remains linked (parent = its successor) for traceability.

---

## 3. Source of Truth Rules

| Concern | Authoritative Document |
|---|---|
| Product identity, brand, sensory system | Master Vision |
| Product requirements | Journey Studio PRD v2.0 |
| UX contracts, interaction models | Journey Studio design doc |
| Platform architecture, subsystems, boundaries | JIP v1.3 (**frozen**) |
| AI Core subsystem contracts | AI Core spec |
| Travel Intelligence OS | TIOS + TIOS Contracts + TIOS Hardening |
| Travel Intelligence Engine | TIE |
| Capability layer | Capabilities spec |
| Memory Engine engineering | EDS-001 (**frozen**) |
| Prompt Orchestration engineering | EDS-002 (**frozen**) |
| Implementation reality | Source code |
| Behavioural verification | Test suites |
| Architectural decisions | ADR log |
| Engineering decisions | EDR log |
| Terminology | Glossary |
| Document history | Changelog |

Overlap rule: if two documents describe the same concern, the higher-authority document wins; the lower must cite and defer, not duplicate.

---

## 4. Documentation Standards

Every engineering-class document (EDS, subsystem spec, ADR/EDR aside) MUST contain the following sections, in this order:

1. Purpose
2. Scope
3. Status (Draft / Review / Approved / Frozen / Superseded / Archived)
4. Version (semver)
5. Owner (team + role)
6. Dependencies (upstream docs)
7. Consumers (downstream docs / systems)
8. Producers (systems that populate/inform the doc)
9. Responsibilities
10. Non-responsibilities
11. Interfaces (contracts, schemas, events)
12. Related Documents
13. Decision Records (inline EDRs or links)
14. Glossary (local terms) — link to canonical `docs/GLOSSARY.md`
15. References
16. Change History
17. Approval Status (approver, date, gate)

Product/PRD documents may omit §7–§11 but must retain the rest.

---

## 5. Cross-Reference Matrix

```
Vision  ←─  Journey Studio PRD v2.0
              │
              ├──  Journey Studio design
              │
              └──  JIP v1.0 → v1.1 → v1.2 → v1.3 (frozen)
                        │
                        ├── AI Core
                        ├── TIOS ── TIOS Contracts ── TIOS Hardening
                        ├── TIE
                        ├── Capabilities
                        │
                        ├── EDS-001 Memory Engine (frozen)
                        │       └── (references JIP v1.3)
                        │
                        └── EDS-002 Prompt Orchestration Engine (frozen)
                                └── (references JIP v1.3 + EDS-001 + AI Core)

Implementation  ─→  references EDS-*, AI Core, TIOS, TIE, Capabilities
Tests           ─→  references PRD v2.0 + EDS-*
Ops (future)    ─→  references EDS-* + Infrastructure specs
```

Matrix table (concise):

| From ↓ / To → | Vision | PRD | JIP v1.3 | AI Core | TIOS | TIE | Cap | EDS-001 | EDS-002 |
|---|---|---|---|---|---|---|---|---|---|
| PRD v2.0 | ✓ |  |  |  |  |  |  |  |  |
| JIP v1.3 | ✓ | ✓ |  |  |  |  |  |  |  |
| AI Core |  |  | ✓ |  |  |  |  |  |  |
| TIOS |  |  | ✓ |  |  |  |  |  |  |
| TIE |  |  | ✓ |  |  |  |  |  |  |
| Capabilities |  |  | ✓ |  | ✓ |  |  |  |  |
| EDS-001 |  |  | ✓ | ✓ |  |  |  |  |  |
| EDS-002 |  |  | ✓ | ✓ |  |  |  | ✓ |  |
| Implementation |  |  |  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tests |  | ✓ |  |  |  |  |  | ✓ | ✓ |

---

## 6. Architecture Decision Records (ADR)

**Location:** `docs/adr/ADR-NNNN-title.md`. Log index: `docs/adr/README.md`.

**Template:**

```
# ADR-NNNN: <Title>

- Status: Proposed | Accepted | Superseded by ADR-XXXX | Deprecated
- Date: YYYY-MM-DD
- Owner: <team>
- Related Documents: <links>

## Context
Why this decision is needed.

## Decision
The choice made.

## Alternatives
Options considered.

## Trade-offs
Explicit gains and losses.

## Consequences
Impact on architecture, teams, roadmap.
```

ADRs are permanent. Superseded ADRs remain in the log with a `Superseded by` link.

---

## 7. Engineering Decision Records (EDR)

**Location:** `docs/edr/EDR-NNNN-title.md` (project-wide EDRs), and inline in EDS documents (`EDR-01 …`) for spec-local decisions. Log index: `docs/edr/README.md`.

**Template:**

```
# EDR-NNNN: <Title>

- Status: Proposed | Accepted | Superseded | Retired
- Date: YYYY-MM-DD
- Owner: <engineering team>
- Related: ADR-NNNN, EDS-NNN

## Context
Engineering trigger.

## Decision
Chosen approach.

## Alternatives
Options considered.

## Performance Impact
Latency, throughput, cost.

## Operational Impact
Observability, on-call, runbooks.

## Security Impact
Attack surface, blast radius, mitigations.

## Migration Impact
Data / API / behavioural migration required.

## Rollback Strategy
Concrete steps to revert.
```

---

## 8. Glossary

Canonical: `docs/GLOSSARY.md`. Every listed term has exactly one definition; documents link, not redefine.

Seeded terms (see file): AI Core, TIOS, TIE, JIP, EDS, ADR, EDR, Memory Engine, Prompt Runtime, Prompt Orchestration Engine (POE), Intelligence Mesh, Journey Graph, Experience Graph, Identity Intelligence Engine (IIE), Simulation Engine, Unified Decision Engine (UDE), Companion, Provider, Capability, Tool, Memory, Context, PromptIR, Fragment, Fingerprint, Trace, Frozen, Canary, Shadow.

---

## 9. Versioning Policy

- **Semver** for every document: `MAJOR.MINOR.PATCH`.
  - MAJOR: breaking scope / contract change.
  - MINOR: additive extension.
  - PATCH: editorial only.
- **Statuses** (state machine): `Draft → Review → Approved → Frozen → (Superseded|Retired|Archived)`. `Deprecated` is a sub-state of Approved indicating pending retirement.
- **Frozen** = no further edits without amendment; extensions become new versions or addenda.
- **Superseded** documents remain in the repo with a header pointer to the successor.
- **Archived** documents move to `docs/archive/` after 12 months of superseded status.

---

## 10. Governance Workflow

```
Draft
  ↓
Review (peer)
  ↓
Architecture Review (for architecture-class docs)
  ↓
Engineering Review (for engineering-class docs)
  ↓
Approval (owning team lead + governance)
  ↓
Frozen (for baselines: JIP, EDS)
  ↓
Implementation
  ↓
Verification (tests / evaluation harness)
  ↓
Maintenance (amendments only)
```

Rules:
- No document is approved without an owner and a parent.
- No architecture change bypasses Architecture Review.
- No engineering spec is Frozen without an Engineering Review and a Production Readiness section.
- Every state transition is recorded in `docs/CHANGELOG.md`.

---

## 11. Future Expansion Map

Reserved documentation domains (directories exist per §12, populated in future sprints):

- **APIs** — public + internal API specifications, versioning, deprecation.
- **Database** — schema, RLS, migrations, retention.
- **Infrastructure** — hosting, network, edge, workers, queues.
- **Security** — threat models, compliance controls, incident response.
- **Provider Specs** — LLM providers, payment providers, travel content providers.
- **Deployment** — release strategy, environments, promotion gates.
- **SRE Runbooks** — service-by-service operational manuals.
- **Disaster Recovery** — RTO/RPO, drills, backups.
- **Compliance** — GDPR, regional residency, RTBF procedures.
- **Developer Guides** — onboarding, local dev, debugging.
- **Contribution Guide** — PR flow, code review standards.
- **Coding Standards** — style, testing, security patterns.
- **Plugin SDK** — external extension surface (post-freeze).
- **Enterprise Edition** — tenant isolation, custom prompt stages, private providers.

---

## 12. Repository Structure Recommendation

```
/docs
  DOCUMENTATION_HUB.md         ← this file (entry point)
  GLOSSARY.md
  CHANGELOG.md
  /vision                      ← vision & brand
  /product                     ← PRDs
  /ux                          ← design & interaction specs
  /architecture                ← JIP, AI Core, TIOS, TIE, Capabilities
  /engineering                 ← EDS-NNN specs
  /api                         ← (reserved)
  /database                    ← (reserved)
  /infrastructure              ← (reserved)
  /security                    ← (reserved)
  /operations                  ← (reserved)
  /testing                     ← (reserved)
  /deployment                  ← (reserved)
  /adr                         ← Architecture Decision Records
    README.md
    ADR-0001-*.md
  /edr                         ← Engineering Decision Records
    README.md
    EDR-0001-*.md
  /guides                      ← (reserved)
  /archive                     ← retired documents
```

Migration note: existing documents remain at their current paths (frozen filenames referenced from code and prior commits). Future documents follow the directory structure above. A follow-up governance sprint may relocate legacy files with redirects (out of scope here).

---

## 13. Final Documentation Audit

| Check | Result |
|---|---|
| Every document has an owner | ✓ — see §1 tables |
| Every document has a purpose | ✓ — §1 tables |
| No duplicated responsibilities | ✓ — §3 authority map resolves overlaps |
| No orphan documents | ✓ — every doc mapped to a parent in §2 |
| No broken references | ✓ — §5 matrix verified against `docs/` listing |
| Clear hierarchy | ✓ — §2 |
| Version consistency | ✓ — semver + status per §9 |
| Governance consistency | ✓ — workflow in §10 |
| Future scalability | ✓ — reserved domains §11, directory layout §12 |
| Frozen baselines respected | ✓ — JIP v1.3, EDS-001, EDS-002 unchanged |
| No implementation touched | ✓ — governance-only sprint |

**Audit result:** PASS. Documentation Hub v1.0 is approved as the entry point and governance authority for Easy Trip documentation.
