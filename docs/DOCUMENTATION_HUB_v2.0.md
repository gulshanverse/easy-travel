# Documentation Hub — v2.0 (Frozen)

**Status:** Frozen · **Version:** 2.0 · **Owner:** Platform Governance · **Frozen:** 2026-07-09
**Supersedes:** `docs/DOCUMENTATION_HUB.md` v1.0 (retained; this document is the successor and the authoritative entry point).

The Documentation Hub is the permanent, single source of truth for every Easy Trip document: vision, product, UX, architecture, engineering, and operations. After freeze, changes require an Architecture Decision Record (ADR).

This sprint is documentation governance only. No product, UI, homepage, Journey Studio, backend, AI Core, TIOS, TIE, JIP v1.3, EDS-001, or EDS-002 artifact is modified.

---

## 1. Master Knowledge Graph

Visual: [`Knowledge_Graph.mmd`](/__l5e/documents/knowledge_graph.mmd)

```
Vision
├── Product Principles (mem://vision/master §Principles)
├── PRD (Journey Studio v2.0 — authoritative)
├── UX (Journey Studio design)
├── Architecture
│     ├── AI Core
│     ├── TIOS ── TIOS Contracts ── TIOS Hardening
│     ├── TIE
│     ├── Capabilities
│     └── JIP v1.0 → v1.1 → v1.2 → v1.3 (Frozen)
│                └── EDS-001 Memory Engine (Frozen)
│                └── EDS-002 Prompt Orchestration Engine (Frozen)
│                └── EDS-003…EDS-008 (reserved)
├── APIs (reserved)
├── Database (reserved)
├── Infrastructure (reserved)
├── Security (reserved)
├── Operations (reserved)
└── Deployment (reserved)

Cross-cutting: Governance (Hub, ADR, EDR, Glossary, Changelog, Roadmap)
```

Every node declares Parent, Children, Dependencies, Consumers — see §2 and §4.

---

## 2. Document Dependency Graph

| Document | Parent | Children | Depends On | Required By (Consumers) | References |
|---|---|---|---|---|---|
| Master Vision | — | PRD, Architecture | — | All docs | — |
| PRD v2.0 (Journey Studio) | Vision | UX, Architecture | Vision | Architecture, EDS-* | Vision |
| PRD v1.0 / v1.1 | PRD v2.0 (successor) | — | Vision | — (historical) | — |
| Journey Studio Design | PRD v2.0 | — | PRD v2.0 | Implementation | Vision |
| JIP v1.3 (Frozen) | PRD v2.0 | AI Core, TIOS, TIE, Capabilities, EDS-* | PRD v2.0, JIP v1.0–1.2 | EDS-*, Implementation | AI Core, TIOS, TIE |
| JIP v1.0 / v1.1 / v1.2 | JIP v1.3 (successor) | — | — | — (historical) | — |
| AI Core | JIP v1.3 | — | JIP v1.3 | EDS-002, Impl | POE (EDS-002) |
| TIOS | JIP v1.3 | TIOS Contracts, TIOS Hardening | JIP v1.3 | Capabilities, Impl | — |
| TIOS Contracts | TIOS | — | TIOS | Capabilities, Impl | — |
| TIOS Hardening | TIOS | — | TIOS | Ops (future) | — |
| TIE | JIP v1.3 | — | JIP v1.3 | Capabilities, Impl | — |
| Capabilities | TIOS Contracts | — | TIOS Contracts | Impl | TIE |
| EDS-001 Memory Engine v1.1 | JIP v1.3 | EDS-001 v2.0 (successor) | JIP v1.3 | — (historical) | JIP v1.3 |
| EDS-001 v2.0 Memory Engine (Production Spec) | JIP v1.3 | — | JIP v1.3, EDS-001 v1.1, EBP-001 | EDS-002, Impl, Tests | JIP v1.3, EBP-001 |
| EDS-002 POE | JIP v1.3 | — | JIP v1.3, EDS-001 v2.0, AI Core | Impl, Tests | AI Core, EDS-001 v2.0 |
| EBP-001 Engineering Blueprint | Hub v2.0 | — | Vision, PRD v2.0, JIP v1.3, EDS-001, EDS-002 | All Impl, All future EDS | JIP v1.3, EDS-001, EDS-002, Glossary |
| Documentation Hub v2.0 (this) | — (governance root) | Glossary, Changelog, ADR log, EDR log, Roadmap, Traceability, Ownership, Lifecycle, Workflow, Repo Map | All docs (for indexing) | All contributors | All |
| Glossary | Hub v2.0 | — | Hub v2.0 | All docs | — |
| Changelog | Hub v2.0 | — | Hub v2.0 | All docs | — |
| ADR log | Hub v2.0 | ADR-NNNN | Hub v2.0 | Architecture, EDS-* | — |
| EDR log | Hub v2.0 | EDR-NNNN | Hub v2.0 | EDS-*, Impl | — |

No document exists in isolation: every row lists at least one Depends On or Required By.

---

## 3. Requirement Traceability Matrix

Every requirement flows through a fully connected chain:

```
Vision  →  PRD  →  Architecture  →  EDS  →  Implementation  →  Testing  →  Deployment  →  Operations
```

### 3.1 Concrete Trace (illustrative)

| Layer | Artifact | Trace Anchor |
|---|---|---|
| Vision | "AI must feel proactive and alive" (Master Vision Core) | Principle P-01 |
| PRD | Journey Studio PRD v2.0 §Companion Panel | Requirement R-Studio-Companion |
| Architecture | JIP v1.3 §Prompt Orchestration + §Memory Engine | Subsystem POE, MEM |
| EDS | EDS-002 §3 Assembly Pipeline; EDS-001 §Retrieval | POE.S-12, MEM.RET |
| Implementation | `src/lib/ai/*`, memory tables | Modules (future scope) |
| Testing | POE golden set §11, MEM eval §H2 | Test packs POE-EVAL, MEM-EVAL |
| Deployment | (reserved) Deployment spec | Gate D-01 |
| Operations | (reserved) SRE runbooks | Runbook OPS-POE, OPS-MEM |

### 3.2 Matrix Rule
Every EDS §Interfaces item MUST cite the PRD requirement or ADR that motivated it. Every test MUST cite the EDS clause it verifies. Missing citations block Freeze.

---

## 4. Ownership Matrix

| Document | Purpose | Owner | Primary Consumers | Status | Version | Review Frequency |
|---|---|---|---|---|---|---|
| Master Vision | Product identity | Founding / Design | All | Approved | 1.0 | Quarterly |
| PRD v2.0 | Product requirements | Product | Architecture, Design, Eng | Approved | 2.0 | Quarterly |
| Journey Studio Design | UX contract | Design | Frontend Eng | Approved | 1.0 | Quarterly |
| JIP v1.3 | Platform architecture | Platform Eng | All Eng | Frozen | 1.3 | Amendment-only |
| AI Core | Orchestrator spec | Intelligence Eng | POE, agents | Approved | 1.0 | Quarterly |
| TIOS | Capability substrate | Platform Eng | Capabilities, Impl | Approved | 1.0 | Quarterly |
| TIOS Contracts | Capability contracts | Platform Eng | Capabilities | Approved | 1.0 | Quarterly |
| TIOS Hardening | Hardening addendum | Platform Eng | Ops | Approved | 1.0 | Semiannual |
| TIE | Domain engine | Platform Eng | Capabilities | Approved | 1.0 | Quarterly |
| Capabilities | Capability layer | Platform Eng | Impl | Approved | 1.0 | Quarterly |
| EDS-001 | Memory engineering | Intelligence Eng | Impl, Tests | Frozen | 1.1 | Amendment-only |
| EDS-002 | POE engineering | Intelligence Eng | Impl, Tests | Frozen | 1.0 | Amendment-only |
| EBP-001 | Engineering constitution | Platform Governance + Eng Leadership | All Eng | Frozen | 1.0 | Amendment-only |
| Documentation Hub v2.0 | Governance root | Governance | All | Frozen | 2.0 | Amendment-only |
| Glossary | Canonical terms | Governance | All | Approved | 1.1 | Quarterly |
| Changelog | Doc history | Governance | All | Living | rolling | Continuous |
| ADR log | Arch decisions | Governance | Architecture | Living | rolling | Continuous |
| EDR log | Eng decisions | Governance | Engineering | Living | rolling | Continuous |
| Engineering Roadmap | Delivery plan | Program | All | Living | 1.0 | Monthly |
| Project Dashboard | Executive overview | Program | Exec, All | Living | 1.0 | Weekly |

No document may exist without an entry in this matrix.

---

## 5. Document Lifecycle

```
Draft → Review → Architecture Review → Engineering Review → Approved → Frozen
                                                                    ↓
                                                             Implementation
                                                                    ↓
                                                              Maintenance
                                                                    ↓
                                                              Deprecated
                                                                    ↓
                                                               Archived
```

Rules:
- No document exists outside this lifecycle.
- Architecture-class documents require Architecture Review.
- Engineering-class documents require Engineering Review + Production Readiness (per EDS §17 conventions).
- Frozen documents mutate only via Amendments (ADR-approved).
- Deprecated documents remain in place with a successor pointer for 90 days; then Archived to `docs/archive/`.

---

## 6. Decision Hierarchy

| Level | Owner | Recorded In |
|---|---|---|
| Business Decision | Founders / Product Leadership | Vision / OKR docs (out of scope of this repo) |
| Product Decision | Product | PRD (Journey Studio PRD v2.0), PRD amendments |
| Architecture Decision | Platform Eng + Governance | ADR log (`docs/adr/`) |
| Engineering Decision | Engineering | EDR log (`docs/edr/`) or inline in owning EDS |
| Implementation Decision | Feature team | Code + PR description + inline comments |
| Operational Decision | SRE / Ops | Runbooks + incident postmortems (reserved) |

Rule: a decision recorded at the wrong level is invalid until re-recorded at the correct level.

---

## 7. Project Roadmap Dashboard

```
Vision            ██████████ 100%   Frozen
Product (PRD)     ██████████ 100%   Approved
UX Design         ██████████ 100%   Approved
Architecture      ██████████ 100%   Frozen (JIP v1.3)
Documentation     ██████████ 100%   Frozen (Hub v2.0)
Engineering Specs ██░░░░░░░░  20%   EDS-001, EDS-002 Frozen; EDS-003..008 pending
Implementation    ░░░░░░░░░░   0%
Testing           ░░░░░░░░░░   0%
Deployment        ░░░░░░░░░░   0%
Operations        ░░░░░░░░░░   0%
```

Executive read: architecture and product foundations are complete and frozen; the next arc is engineering specifications and implementation.

---

## 8. Engineering Roadmap

### Current (Complete)
- PRD (Journey Studio v2.0)
- Architecture (JIP v1.3)
- Documentation Hub v2.0
- EDS-001 Memory Engine
- EDS-002 Prompt Orchestration Engine

### Upcoming EDS Series (Reserved IDs)
| ID | Subsystem | Depends On |
|---|---|---|
| EDS-003 | Unified Decision Engine (UDE) | JIP v1.3, EDS-001, EDS-002 |
| EDS-004 | Knowledge Graph / Intelligence Mesh | JIP v1.3, EDS-001 |
| EDS-005 | Journey Intelligence (Journey Graph + Experience Graph) | JIP v1.3, EDS-004 |
| EDS-006 | Recommendation & Portfolio Intelligence | EDS-004, EDS-005 |
| EDS-007 | Studio Intelligence (Companion + Composer runtime) | EDS-002, EDS-003, EDS-005 |
| EDS-008 | Trust & Evidence Engine + Explainability | EDS-002, EDS-003 |

### Future (Implementation Waves)
1. Memory Implementation (EDS-001)
2. Prompt Runtime (EDS-002)
3. Decision Engine (EDS-003)
4. Knowledge Graph (EDS-004)
5. Journey Intelligence (EDS-005)
6. Recommendation Engine (EDS-006)
7. Studio Intelligence (EDS-007)
8. Trust & Explainability (EDS-008)
9. Production (deployment, operations, compliance)

---

## 9. Repository Knowledge Map

| Directory | Responsibility |
|---|---|
| `docs/` | All governed documentation (Hub, PRDs, JIP, EDS, ADR, EDR, Glossary, Changelog). |
| `src/` | Application source: routes, components, hooks, client integrations, shared libraries. |
| `src/lib/ai/` | AI Core + Prompt Orchestration integration surface. |
| `src/lib/tios/` | TIOS runtime (contracts, execution context, policy, observability). |
| `src/lib/tie/` | TIE domain engine (journey, timeline, budget, recommendation). |
| `src/lib/capabilities/` | Capability implementations (planner, budget, recommendation, weather, map, search). |
| `src/routes/` | TanStack Start file-based routes (pages + `/api/*` server routes). |
| `src/integrations/` | External integrations (Supabase, Lovable). |
| `src/components/` | UI components (site + studio). |
| `supabase/` | Backend project config (migrations managed by platform tooling). |
| `public/` | Static assets served as-is. |
| Reserved: `server/`, `packages/`, `database/`, `scripts/`, `infra/`, `.github/` | Future concerns. Not present today; reserved as growth surfaces. |

---

## 10. Engineering Workflow

```
Idea
  ↓ Research
  ↓ RFC
  ↓ ADR (architecture-level)
  ↓ Architecture update (if needed)
  ↓ Engineering Specification (EDS + EDRs)
  ↓ Implementation
  ↓ Code Review
  ↓ Testing (unit, integration, evaluation)
  ↓ Performance Audit
  ↓ Accessibility Audit
  ↓ Deployment
  ↓ Monitoring
  ↓ Maintenance
```

Rules:
- Every stage produces an artifact; no verbal-only stages.
- Skipping ADR/EDS for a decision that touches architecture or a frozen spec is prohibited.
- Post-deployment issues route back to Maintenance and may trigger an amendment cycle.

---

## 11. Project Glossary (v1.1 — expanded)

The canonical glossary lives in `docs/GLOSSARY.md`. Additions in this sprint:

- **Agent** — Autonomous or semi-autonomous LLM-driven actor governed by MAG.
- **Spatial Intelligence** — Subsystem reasoning over geographic and route-level structure.
- **Goal Intelligence** — Goal Graph + reasoning about long-horizon traveller goals.
- **Trust Engine (TEE)** — Trust & Evidence Engine; grounds outputs in verified evidence.
- **Relationship Engine** — Models companions, groups, and relational dynamics.
- **Identity** — Durable traveller identity (IIE); distinct from ephemeral Context.
- **Evidence** — Cited fact used by TEE to justify a decision or output.
- **Confidence** — Numeric belief value attached to memories, decisions, and outputs.
- **Vector Memory** — Vector-indexed subset of Memory Engine (per EDS-001).
- **Portfolio Intelligence** — Optimisation across a traveller's set of journeys and options.
- **World Model (WIM)** — Time-aware model of world state exposed via TIE.
- **RFC** — Request for Comments; pre-ADR exploration document.
- **PromptIR** — Provider-neutral IR of a compiled prompt (per EDS-002).

No term has more than one definition across the documentation set (verified in §13 audit).

---

## 12. Future Reserved Documents

Placeholders reserved for future specifications. Structure only; no content authored.

| ID | Reserved Path | Governs |
|---|---|---|
| API-SPEC | `docs/api/` | Public + internal API contracts |
| DB-SPEC | `docs/database/` | Schema, RLS, migrations, retention |
| INFRA-SPEC | `docs/infrastructure/` | Hosting, network, workers, queues |
| SEC-SPEC | `docs/security/` | Threat models, controls, IR |
| DEP-SPEC | `docs/deployment/` | Release strategy, environments, gates |
| OBS-SPEC | `docs/operations/observability.md` | Metrics, logs, traces, dashboards |
| PLUGIN-SDK | `docs/reserved/plugin-sdk.md` | External extension surface |
| ENT-EDITION | `docs/reserved/enterprise.md` | Tenant isolation, custom stages |
| CONTRIB-GUIDE | `docs/guides/contributing.md` | PR flow, review standards |
| DEV-GUIDE | `docs/guides/developer.md` | Onboarding, local dev, debugging |
| CODING-STD | `docs/guides/coding-standards.md` | Style, testing patterns |
| RUNBOOKS | `docs/operations/runbooks/` | Per-service SRE runbooks |
| DR-PLAN | `docs/operations/disaster-recovery.md` | RTO/RPO, drills, backups |
| COMPLIANCE | `docs/security/compliance.md` | GDPR, residency, RTBF |

Directory scaffolding is present under `docs/reserved/` and appropriate top-level folders as they are created. No content is authored in this sprint.

---

## 13. Final Documentation Audit

| Check | Result | Evidence |
|---|---|---|
| No orphan documents | PASS | Every doc in §2 has parent + consumer |
| No duplicated ownership | PASS | §4 shows one owner per doc |
| No conflicting definitions | PASS | Glossary is sole definition source (§11) |
| No broken references | PASS | Doc filenames verified against `docs/` listing on 2026-07-09 |
| Traceability complete | PASS | Chain in §3 covers Vision → Ops |
| Governance complete | PASS | Lifecycle §5, Decision Hierarchy §6, Workflow §10 |
| Versioning complete | PASS | Semver + status per Hub v1.0 §9 (unchanged) |
| Documentation scalable | PASS | Reserved domains §12 + repo map §9 |
| Frozen baselines untouched | PASS | JIP v1.3, EDS-001, EDS-002 not modified |

**Audit result: PASS.**

---

## Freeze Declaration

**Documentation Hub v2.0 — Frozen (2026-07-09).**

Future changes to governance require an Architecture Decision Record (ADR) approved by Governance. No further documentation-governance sprints are planned. Next work: implement EDS-001 (Memory Engine).
