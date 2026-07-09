# Engineering Roadmap — v1.0

Living document. Governed by `docs/DOCUMENTATION_HUB_v2.0.md` §8.
Owner: Program. Review cadence: monthly.

## Delivery Waves

### Wave 0 — Foundations (Complete)
- Master Vision v1.0 · Frozen
- Journey Studio PRD v2.0 · Approved
- Journey Studio Design v1.0 · Approved
- JIP v1.3 · **Frozen**
- Documentation Hub v2.0 · **Frozen**
- EDS-001 Memory Engine v1.1 · **Frozen**
- EDS-002 Prompt Orchestration Engine v1.0 · **Frozen**

### Wave 1 — Remaining Engineering Specifications
| EDS | Subsystem | Depends On | Status |
|---|---|---|---|
| EDS-003 | Unified Decision Engine (UDE) | JIP v1.3, EDS-001, EDS-002 | Reserved |
| EDS-004 | Knowledge Graph / Intelligence Mesh | JIP v1.3, EDS-001 | Reserved |
| EDS-005 | Journey Intelligence (Journey + Experience Graph) | JIP v1.3, EDS-004 | Reserved |
| EDS-006 | Recommendation & Portfolio Intelligence | EDS-004, EDS-005 | Reserved |
| EDS-007 | Studio Intelligence (Companion + Composer runtime) | EDS-002, EDS-003, EDS-005 | Reserved |
| EDS-008 | Trust & Evidence + Explainability | EDS-002, EDS-003 | Reserved |

### Wave 2 — Implementation
1. Memory Implementation (EDS-001)
2. Prompt Runtime (EDS-002)
3. Decision Engine (EDS-003)
4. Knowledge Graph (EDS-004)
5. Journey Intelligence (EDS-005)
6. Recommendation Engine (EDS-006)
7. Studio Intelligence (EDS-007)
8. Trust & Explainability (EDS-008)

### Wave 3 — Production
- Deployment specification
- Observability specification
- SRE runbooks
- Disaster recovery
- Compliance

## Project Maturity Dashboard

```
Vision            ██████████ 100%
Product           ██████████ 100%
UX Design         ██████████ 100%
Architecture      ██████████ 100%
Documentation     ██████████ 100%
Engineering Specs ██░░░░░░░░  20%
Implementation    ░░░░░░░░░░   0%
Testing           ░░░░░░░░░░   0%
Deployment        ░░░░░░░░░░   0%
Operations        ░░░░░░░░░░   0%
```

Next active work: **implement EDS-001 (Memory Engine)**.
