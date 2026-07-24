# ADR-006 — Journey Studio Runtime consumes only the Agent Runtime

Status: Accepted
Date: 2026-07-24

## Context
Journey Studio Runtime (JSR) owns the presentation state of planning sessions.
Business intelligence, reasoning, and execution live in the domain engines and
in the Agent Runtime / CTOR.

## Decision
JSR communicates with the rest of the platform through exactly one port:
`StudioAgentPort`, which is satisfied by the Agent Runtime. Any capability
call, memory access, or decision request is reached transitively via
Agent → CTOR → Engines.

## Consequences
- `src/lib/studio/**` MUST NOT import from `@/lib/{memory,journey,decision,trust,goal,spatial,graph,prompt,provider,runtime,ctor}`.
- Enforced by architecture-fitness tests in `tests/studio/runtime.test.ts`.
- New capabilities are surfaced to Studio by wiring them through the Agent Runtime.
